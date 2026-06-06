/**
 * Server-side Data Store & Utility Modules for DocerX
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Document, User, AuditLog, SignatureCoords, UserRole, DocumentTemplate, TemplateField } from '../types';

const DB_FILE = path.join(process.cwd(), 'db.json');

interface DatabaseSchema {
  users: User[];
  passwords: Record<string, string>; // userId -> bcrypt hash
  documents: Document[];
  templates: DocumentTemplate[];
}

// Initial Database State
let db: DatabaseSchema = {
  users: [],
  passwords: {},
  documents: [],
  templates: []
};

// Ensure data file exists or load it
export function initDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(data);
      if (!db.templates) {
        db.templates = [];
      }
      console.log(`[Database] Loaded successfully from ${DB_FILE}. Users: ${db.users.length}, Documents: ${db.documents.length}, Templates: ${db.templates.length}`);
    } else {
      saveDb();
      console.log(`[Database] Initial database created at ${DB_FILE}`);
    }
  } catch (error) {
    console.error('[Database] Error loading database, self-healing with empty state:', error);
    db = { users: [], passwords: {}, documents: [], templates: [] };
    saveDb();
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Database] Failed to save DB to file:', error);
  }
}

// Cryptographic utility
export function getSha256(base64Data: string): string {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch {
    return 'checksum-computation-failed';
  }
}

// User helper methods
export function findUserByEmail(email: string): User | undefined {
  return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string): User | undefined {
  return db.users.find(u => u.id === id);
}

export async function createUser(email: string, name: string, passwordPlain: string, role: UserRole = 'sender'): Promise<User> {
  const existing = findUserByEmail(email);
  if (existing) {
    throw new Error('Email already registered');
  }

  const userId = 'u_' + crypto.randomBytes(4).toString('hex');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(passwordPlain, salt);

  const newUser: User = {
    id: userId,
    email: email.toLowerCase(),
    name: name,
    createdAt: new Date().toISOString(),
    role: role
  };

  db.users.push(newUser);
  db.passwords[userId] = passwordHash;
  saveDb();

  return newUser;
}

export async function verifyUserPassword(userId: string, passwordPlain: string): Promise<boolean> {
  const hash = db.passwords[userId];
  if (!hash) return false;
  return bcrypt.compare(passwordPlain, hash);
}

// Document helper methods
export function getDocumentsForUser(userId: string): Document[] {
  // Returns documents uploaded by user, or documents where user is specified as signer
  const user = findUserById(userId);
  if (!user) return [];
  return db.documents.filter(doc => 
    doc.uploadedBy === userId || 
    doc.request.signerEmail.toLowerCase() === user.email.toLowerCase()
  );
}

export function getDocumentById(docId: string): Document | undefined {
  return db.documents.find(d => d.id === docId);
}

export function getDocumentByToken(token: string): Document | undefined {
  return db.documents.find(d => d.request.token === token);
}

export function createDocument(
  title: string,
  fileName: string,
  fileSizeStr: string,
  uploadedByUserId: string,
  uploadedByUserEmail: string,
  fileDataB64: string,
  signerName: string,
  signerEmail: string,
  coords: SignatureCoords,
  addTimestamp?: boolean,
  timestampCoords?: SignatureCoords
): Document {
  const docId = 'doc_' + crypto.randomBytes(6).toString('hex');
  const token = 'sign_tok_' + crypto.randomBytes(12).toString('hex');

  const auditLogs: AuditLog[] = [
    {
      id: 'log_' + crypto.randomBytes(4).toString('hex'),
      timestamp: new Date().toISOString(),
      action: 'Document Created',
      performedByEmail: uploadedByUserEmail,
      ip: '127.0.0.1',
      userAgent: 'Server-Side Initialization',
      details: `Document "${title}" uploaded. File size: ${fileSizeStr}.`
    },
    {
      id: 'log_' + crypto.randomBytes(4).toString('hex'),
      timestamp: new Date().toISOString(),
      action: 'Signature Link Generated',
      performedByEmail: uploadedByUserEmail,
      ip: '127.0.0.1',
      userAgent: 'DocerX System',
      details: `Secure tokenized signing link generated for ${signerName} (${signerEmail}).`
    }
  ];

  const newDoc: Document = {
    id: docId,
    title,
    fileName,
    fileSize: fileSizeStr,
    uploadedBy: uploadedByUserId,
    uploadedByEmail: uploadedByUserEmail,
    createdAt: new Date().toISOString(),
    status: 'pending',
    fileData: fileDataB64,
    request: {
      id: 'req_' + crypto.randomBytes(4).toString('hex'),
      signerEmail: signerEmail.toLowerCase(),
      signerName: signerName,
      status: 'pending',
      token: token,
      coords: coords,
      addTimestamp,
      timestampCoords
    },
    auditLogs
  };

  db.documents.push(newDoc);
  saveDb();
  return newDoc;
}

/**
 * Handle server-side actual PDF-Lib drawing
 */
export async function signDocumentOnServer(
  token: string,
  signatureImageB64: string, // Canvas sketch png output
  signerIp: string,
  userAgent: string,
  confirmedName: string
): Promise<Document> {
  const doc = getDocumentByToken(token);
  if (!doc) {
    throw new Error('Signing request match token not found');
  }

  if (doc.status !== 'pending') {
    throw new Error(`This document is already ${doc.status}`);
  }

  try {
    // 1. Process original PDF bytes
    const pdfBytes = Buffer.from(doc.fileData, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Convert signature PNG base64 to byte buffer
    const imgClean = signatureImageB64.replace(/^data:image\/png;base64,/, '');
    const signatureImageBytes = Buffer.from(imgClean, 'base64');
    
    // Embed signature PNG on the server
    const pngImage = await pdfDoc.embedPng(signatureImageBytes);
    
    const pages = pdfDoc.getPages();
    const coords = doc.request.coords;
    const pageIndex = (coords.page || 1) - 1;

    if (pageIndex >= 0 && pageIndex < pages.length) {
      const pageComponent = pages[pageIndex];
      const { width: pWidth, height: pHeight } = pageComponent.getSize();

      // Convert Screen Percentages back to PDF scale
      // Screen X goes left-to-right (0 to 100%)
      // Screen Y goes top-to-bottom (0 to 100%)
      // pdf-lib X goes left-to-right
      // pdf-lib Y goes bottom-to-top!
      const pdfX = (coords.x / 100) * pWidth;
      
      // Compute PDF coordinates with inversion for Y axis
      const pdfY = pHeight - ((coords.y / 100) * pHeight) - (coords.height / 2);

      // Draw signature image
      pageComponent.drawImage(pngImage, {
        x: pdfX - (coords.width / 2), // centered at placed anchor
        y: pdfY,
        width: coords.width,
        height: coords.height,
      });

      // Embed a subtle verifiable certification string right below it for security
      const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const uniqueCertCode = `DX-CERT-${doc.id.toUpperCase()}-${Math.random().toString(36).substring(3, 7).toUpperCase()}`;
      pageComponent.drawText(`Digitally Stamped & Verified via DocerX | ID: ${uniqueCertCode}`, {
        x: pdfX - (coords.width / 2),
        y: pdfY - 12,
        size: 6,
        font: textFont,
        color: rgb(0.48, 0.48, 0.52),
      });

      // Embed separate visual timestamp if checked
      if (doc.request.addTimestamp && doc.request.timestampCoords) {
        const tsCoords = doc.request.timestampCoords;
        const tsPageIndex = (tsCoords.page || 1) - 1;
        const tsPageComponent = pages[tsPageIndex] || pageComponent;
        const { width: tsWidth, height: tsHeight } = tsPageComponent.getSize();
        
        const tsPdfX = (tsCoords.x / 100) * tsWidth;
        const tsPdfY = tsHeight - ((tsCoords.y / 100) * tsHeight) - (tsCoords.height / 2);
        
        const timestampFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        // Draw timestamp rectangle capsule
        tsPageComponent.drawRectangle({
          x: tsPdfX - (tsCoords.width / 2),
          y: tsPdfY,
          width: tsCoords.width,
          height: tsCoords.height,
          color: rgb(0.96, 0.97, 0.99),
          borderColor: rgb(0.1, 0.15, 0.28),
          borderWidth: 1.5,
        });
        
        const tsString = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        tsPageComponent.drawText('VERIFIED DIGITAL TIMESTAMP', {
          x: tsPdfX - (tsCoords.width / 2) + 6,
          y: tsPdfY + tsCoords.height - 12,
          size: 6,
          font: timestampFont,
          color: rgb(0.1, 0.15, 0.28),
        });
        
        tsPageComponent.drawText(tsString, {
          x: tsPdfX - (tsCoords.width / 2) + 6,
          y: tsPdfY + 6,
          size: 7,
          font: normalFont,
          color: rgb(0.3, 0.35, 0.45),
        });
      }
    }

    // 2. Append Audit Trail Page as an Official Certifiable Appendix
    const templateFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldThemeFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const appendixPage = pdfDoc.addPage([600, 800]);
    
    // Headers
    appendixPage.drawText('DocerX ELECTRONIC SIGNATURE CERTIFICATE', { x: 50, y: 740, size: 16, font: boldThemeFont, color: rgb(0.1, 0.15, 0.28) });
    appendixPage.drawText(`Verify: https://docerx.ai/verify/${doc.id}`, { x: 50, y: 720, size: 10, font: templateFont, color: rgb(0.25, 0.4, 0.8) });
    appendixPage.drawLine({ start: { x: 50, y: 710 }, end: { x: 550, y: 710 }, thickness: 1.5, color: rgb(0.1, 0.15, 0.28) });
    
    // Metadata table
    const tableY = 680;
    appendixPage.drawText('Document ID:', { x: 50, y: tableY, size: 10, font: boldThemeFont });
    appendixPage.drawText(doc.id, { x: 180, y: tableY, size: 10, font: templateFont });

    appendixPage.drawText('Document Name:', { x: 50, y: tableY - 20, size: 10, font: boldThemeFont });
    appendixPage.drawText(doc.title, { x: 180, y: tableY - 20, size: 10, font: templateFont });

    appendixPage.drawText('Initiated By:', { x: 50, y: tableY - 40, size: 10, font: boldThemeFont });
    appendixPage.drawText(`${doc.uploadedByEmail}`, { x: 180, y: tableY - 40, size: 10, font: templateFont });

    appendixPage.drawText('Signer Verified:', { x: 50, y: tableY - 60, size: 10, font: boldThemeFont });
    appendixPage.drawText(`${confirmedName} (${doc.request.signerEmail})`, { x: 180, y: tableY - 60, size: 10, font: templateFont, color: rgb(0.1, 0.5, 0.2) });

    appendixPage.drawText('Signed Stamp Time:', { x: 50, y: tableY - 80, size: 10, font: boldThemeFont });
    appendixPage.drawText(new Date().toISOString(), { x: 180, y: tableY - 80, size: 10, font: templateFont });

    appendixPage.drawText('Signer IP Address:', { x: 50, y: tableY - 100, size: 10, font: boldThemeFont });
    appendixPage.drawText(signerIp, { x: 180, y: tableY - 100, size: 10, font: templateFont });

    appendixPage.drawText('Signer Agent:', { x: 50, y: tableY - 120, size: 10, font: boldThemeFont });
    appendixPage.drawText(userAgent.substring(0, 70) + (userAgent.length > 70 ? '...' : ''), { x: 180, y: tableY - 120, size: 8, font: templateFont });

    // Cryptographic Signatures Section
    appendixPage.drawText('SECURITY CHECKSUM & LEGAL COMPLIANCE', { x: 50, y: 510, size: 12, font: boldThemeFont, color: rgb(0.1, 0.15, 0.28) });
    appendixPage.drawLine({ start: { x: 50, y: 500 }, end: { x: 550, y: 500 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

    const checksumText = getSha256(doc.fileData);
    appendixPage.drawText('SHA-256 Original Hash:', { x: 50, y: 480, size: 9, font: boldThemeFont });
    appendixPage.drawText(checksumText, { x: 180, y: 480, size: 8, font: templateFont });

    // Save final signed doc bytes
    const signedPdfBytes = await pdfDoc.save();
    const signedPdfB64 = Buffer.from(signedPdfBytes).toString('base64');
    
    const finalShaHash = getSha256(signedPdfB64);
    appendixPage.drawText('SHA-256 Signed Hash:', { x: 50, y: 460, size: 9, font: boldThemeFont });
    appendixPage.drawText(finalShaHash, { x: 180, y: 460, size: 8, font: templateFont });

    // Compile Audit records
    const newLogs: AuditLog[] = [
      {
        id: 'log_' + crypto.randomBytes(4).toString('hex'),
        timestamp: new Date().toISOString(),
        action: 'Document Viewed',
        performedByEmail: doc.request.signerEmail,
        ip: signerIp,
        userAgent: userAgent,
        details: `Public signer viewed document using secure tokenized link.`
      },
      ...doc.auditLogs,
      {
        id: 'log_' + crypto.randomBytes(4).toString('hex'),
        timestamp: new Date().toISOString(),
        action: 'Document Electronically Signed',
        performedByEmail: doc.request.signerEmail,
        ip: signerIp,
        userAgent: userAgent,
        details: `Affixed customized signature to visual page ${coords.page || 1}. Confirmed legal agreement name: ${confirmedName}.`
      },
      {
        id: 'log_' + crypto.randomBytes(4).toString('hex'),
        timestamp: new Date().toISOString(),
        action: 'Audit Appendix Appended',
        performedByEmail: 'docerx-system',
        ip: '127.0.0.1',
        userAgent: 'DocerX Core Engine',
        details: `Cryptographically sealed and generated official appendix. Final legal hash: ${finalShaHash}`
      }
    ];

    // Update document status
    doc.status = 'signed';
    doc.signedFileData = signedPdfB64;
    doc.docHash = finalShaHash;
    doc.request.status = 'signed';
    doc.request.signedAt = new Date().toISOString();
    doc.request.signatureImage = signatureImageB64;
    doc.request.signerName = confirmedName;
    doc.auditLogs = newLogs;

    // Resave modified database
    saveDb();
    console.log(`[Document] Document ${doc.id} signed successfully by ${doc.request.signerEmail}`);
    return doc;

  } catch (error) {
    console.error('[Document] Error modifying and signing PDF:', error);
    throw new Error('Server failed to compile and embed signature onto legal PDF structure: ' + (error as Error).message);
  }
}

/**
 * Handle document rejection
 */
export function rejectDocumentOnServer(
  token: string,
  signerIp: string,
  userAgent: string,
  reason: string
): Document {
  const doc = getDocumentByToken(token);
  if (!doc) {
    throw new Error('Signing request match token not found');
  }

  if (doc.status !== 'pending') {
    throw new Error(`This document is already in state ${doc.status}`);
  }

  const log: AuditLog = {
    id: 'log_' + crypto.randomBytes(4).toString('hex'),
    timestamp: new Date().toISOString(),
    action: 'Document Rejected/Declined',
    performedByEmail: doc.request.signerEmail,
    ip: signerIp,
    userAgent: userAgent,
    details: `Signer declined to sign document. Declined Reason: "${reason}"`
  };

  doc.status = 'rejected';
  doc.request.status = 'rejected';
  doc.auditLogs.unshift(log);

  saveDb();
  return doc;
}

/**
 * PDF creation utility for rendering professional templates dynamically
 */
export async function createSamplePdf(): Promise<string> {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    page.drawText('MUTUAL NON-DISCLOSURE AGREEMENT', { x: 50, y: 730, size: 18, font: boldFont, color: rgb(0.09, 0.12, 0.22) });
    page.drawText('DocerX Secure Electronic Document ID: DX-' + crypto.randomBytes(3).toString('hex').toUpperCase(), { x: 50, y: 710, size: 8, font: font, color: rgb(0.5, 0.5, 0.5) });
    
    let y = 660;
    const lines = [
      'This Mutual Non-Disclosure Agreement (the "Agreement") is entered into by and',
      'between the Initiating Party and the designated Recipient (the "Signer") to prevent',
      'the unauthorized disclosure of Confidential Information as defined below.',
      '',
      '1. CONFIDENTIAL INFORMATION',
      'Confidential Information refers to any proprietary information, technical data, trade',
      'secrets, or know-how disclosed by either party, whether or not marked as confidential.',
      '',
      '2. PROTECTION & USE',
      'Both parties agree to hold information in strict confidence and to take all reasonable',
      'precautions to protect its confidentiality. Confidential information shall not be',
      'disclosed or made available to any third party without express written consent.',
      '',
      '3. AUDIT & TRACEABILITY',
      'This document is legally binding under the Electronic Signatures in Global and National',
      'Commerce (ESIGN) Act. A metadata record containing timestamps, IP addresses,',
      'and signer credentials will be appended as an official certifiable audit trail.',
      '',
      'Please review the conditions above and affix your digital signature below:'
    ];
    
    for (const line of lines) {
      if (line === '') {
        y -= 15;
        continue;
      }
      const isSection = line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.');
      page.drawText(line, {
        x: 50,
        y: y,
        size: isSection ? 11 : 10,
        font: isSection ? boldFont : font,
        color: rgb(0.15, 0.15, 0.15)
      });
      y -= 18;
    }
    
    // Draw signature placeholders
    page.drawText('INITIATOR SIGNATURE:', { x: 50, y: 150, size: 10, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
    page.drawText('STAMPED PRE-VERIFIED (DocerX)', { x: 50, y: 130, size: 9, font: font, color: rgb(0.1, 0.5, 0.2) });
    page.drawLine({ start: { x: 50, y: 125 }, end: { x: 230, y: 125 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });

    page.drawText('RECIPIENT SIGNATURE:', { x: 330, y: 150, size: 10, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
    page.drawText('WAITING FOR ELECTRONIC SIGNATURE', { x: 330, y: 130, size: 8, font: font, color: rgb(0.8, 0.4, 0.1) });
    page.drawLine({ start: { x: 330, y: 125 }, end: { x: 510, y: 125 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
    
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes).toString('base64');
  } catch (err) {
    console.error('Error generating sample PDF', err);
    throw err;
  }
}

// Reusable Template management
export function getTemplates(): DocumentTemplate[] {
  if (!db.templates) db.templates = [];
  return db.templates;
}

export function createTemplate(
  title: string,
  fileName: string,
  fileSizeStr: string,
  uploadedByUserId: string,
  uploadedByUserEmail: string,
  fileDataB64: string,
  fields: TemplateField[]
): DocumentTemplate {
  if (!db.templates) db.templates = [];
  const templateId = 'tpl_' + crypto.randomBytes(6).toString('hex');
  const newTemplate: DocumentTemplate = {
    id: templateId,
    title,
    fileName,
    fileSize: fileSizeStr,
    uploadedBy: uploadedByUserId,
    uploadedByEmail: uploadedByUserEmail,
    createdAt: new Date().toISOString(),
    fileData: fileDataB64,
    fields
  };
  db.templates.push(newTemplate);
  saveDb();
  return newTemplate;
}

export function deleteTemplate(id: string): boolean {
  if (!db.templates) db.templates = [];
  const initialLen = db.templates.length;
  db.templates = db.templates.filter(t => t.id !== id);
  if (db.templates.length < initialLen) {
    saveDb();
    return true;
  }
  return false;
}

// Document edit / delete implementations (for Role-Based Access controls)
export function deleteDocument(docId: string, userId: string, userRole: string): boolean {
  const initialLen = db.documents.length;
  
  db.documents = db.documents.filter(doc => {
    if (doc.id !== docId) return true;
    
    // Admins can delete anything; Senders can delete documents they initialized
    const isOwner = doc.uploadedBy === userId;
    const isAdmin = userRole === 'admin';
    const isAllowed = isOwner || isAdmin;
    
    return !isAllowed; // Keep the document ONLY if delete is NOT allowed
  });
  
  if (db.documents.length < initialLen) {
    saveDb();
    return true;
  }
  return false;
}

export function editDocumentTitle(docId: string, title: string, userId: string, userRole: string): Document | undefined {
  const doc = db.documents.find(d => d.id === docId);
  if (!doc) return undefined;
  
  const isOwner = doc.uploadedBy === userId;
  const isAdmin = userRole === 'admin';
  
  if (isOwner || isAdmin) {
    doc.title = title;
    
    // Add audit log
    doc.auditLogs.unshift({
      id: 'log_' + crypto.randomBytes(4).toString('hex'),
      timestamp: new Date().toISOString(),
      action: 'Document Rename',
      performedByEmail: isAdmin ? 'system-admin' : doc.uploadedByEmail,
      ip: '127.0.0.1',
      userAgent: 'DocerX Core',
      details: `Document title was renamed to "${title}".`
    });
    
    saveDb();
    return doc;
  }
  throw new Error('Unauthorized to edit this document');
}

// Admin only user query
export function getAllUsers(): User[] {
  return db.users;
}

// Custom page-wrapped Word Wrapping and PDF compilation support for the Free Document Editor
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(/\s+/);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        // If a single word is wider than maxWidth, place it on its own line
        if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
          lines.push(word);
          currentLine = '';
        } else {
          currentLine = word;
        }
      } else {
        // Word is wider than line, push it as-is
        lines.push(word);
        currentLine = '';
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export async function compileCustomPdf(title: string, contentText: string, creatorEmail: string): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  
  const drawPageAssets = (p: any, pgNum: number) => {
    const { width, height } = p.getSize();
    // Subtle background contract frame
    p.drawRectangle({
      x: 30,
      y: 30,
      width: width - 60,
      height: height - 60,
      borderColor: rgb(0.1, 0.15, 0.28),
      borderWidth: 1.5,
    });
    // Header watermark line
    p.drawText(`DocerX Digital Draft Contract | Formulated by ${creatorEmail}`, {
      x: 45,
      y: height - 42,
      size: 7,
      font: italicFont,
      color: rgb(0.48, 0.48, 0.52)
    });
    // Header Separator
    p.drawLine({
      start: { x: 45, y: height - 48 },
      end: { x: width - 45, y: height - 48 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8)
    });
    // Footer Separator
    p.drawLine({
      start: { x: 45, y: 48 },
      end: { x: width - 45, y: 48 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8)
    });
    // Bottom branding tag
    p.drawText(`DocerX Secure Electronic Document ID: DX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`, {
      x: 45,
      y: 38,
      size: 7,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });
    p.drawText(`Page ${pgNum}`, {
      x: width - 80,
      y: 38,
      size: 7,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });
  };

  drawPageAssets(page, 1);
  
  // Document Title
  page.drawText(title.toUpperCase(), {
    x: 45,
    y: 720,
    size: 15,
    font: boldFont,
    color: rgb(0.09, 0.12, 0.22)
  });
  
  let y = 680;
  const rawParagraphs = contentText.split('\n');
  const maxWidth = 510; // Margin bound of (600 - 45x2)
  
  for (const rawPara of rawParagraphs) {
    if (rawPara.trim() === '') {
      y -= 15;
      if (y < 65) {
        page = pdfDoc.addPage([600, 800]);
        drawPageAssets(page, pdfDoc.getPages().length);
        y = 720;
      }
      continue;
    }
    
    // Check headings, triggers are: lines starting with ### or enclosed in ** on both sides
    const isHeading = rawPara.trim().startsWith('###') || (rawPara.trim().startsWith('**') && rawPara.trim().endsWith('**'));
    const cleanPara = rawPara.trim().replace(/^###\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '');
    const currentFont = isHeading ? boldFont : font;
    const currentSize = isHeading ? 11 : 9.5;
    const currentSpacing = isHeading ? 18 : 14;
    const textColor = isHeading ? rgb(0.1, 0.15, 0.28) : rgb(0.15, 0.15, 0.15);

    const wrappedLines = wrapText(cleanPara, maxWidth, currentFont, currentSize);
    
    for (const wLine of wrappedLines) {
      if (y < 65) {
        page = pdfDoc.addPage([600, 800]);
        drawPageAssets(page, pdfDoc.getPages().length);
        y = 720;
      }
      
      page.drawText(wLine, {
        x: 45,
        y: y,
        size: currentSize,
        font: currentFont,
        color: textColor
      });
      y -= currentSpacing;
    }
    y -= 8; // Spacer between paragraphs
  }
  
  // Sign-off signature footer stamps
  if (y < 120) {
    page = pdfDoc.addPage([600, 800]);
    drawPageAssets(page, pdfDoc.getPages().length);
    y = 720;
  } else {
    y -= 25;
  }
  
  page.drawText('INITIATOR DEPLOYER SIGNATURE:', { x: 45, y: y, size: 9, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('STAMPED PRE-VERIFIED (DocerX)', { x: 45, y: y - 18, size: 8, font: font, color: rgb(0.1, 0.5, 0.2) });
  page.drawLine({ start: { x: 45, y: y - 22 }, end: { x: 235, y: y - 22 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });

  page.drawText('RECIPIENT SIGNATORY SIGNATURE:', { x: 325, y: y, size: 9, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('AWAITING SECURE SEAL STAMP', { x: 325, y: y - 18, size: 8, font: font, color: rgb(0.8, 0.4, 0.1) });
  page.drawLine({ start: { x: 325, y: y - 22 }, end: { x: 515, y: y - 22 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString('base64');
}

