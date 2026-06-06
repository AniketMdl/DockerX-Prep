/**
 * DocerX Full-Stack Express Server with Vite Middleware Integration
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import {
  initDb,
  createUser,
  verifyUserPassword,
  findUserByEmail,
  findUserById,
  createDocument,
  getDocumentsForUser,
  getDocumentById,
  getDocumentByToken,
  signDocumentOnServer,
  rejectDocumentOnServer,
  createSamplePdf,
  createTemplate,
  getTemplates,
  deleteTemplate,
  deleteDocument,
  editDocumentTitle,
  getAllUsers,
  compileCustomPdf
} from './src/server/db';
import { SignatureCoords } from './src/types';
import { GoogleGenAI } from '@google/genai';

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'docerx-super-secure-jwt-secret-key-2026';

// Lazy-loaded Google GenAI client to preserve service integrity
let googleAI: GoogleGenAI | null = null;
function getGoogleAI() {
  if (!googleAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    googleAI = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return googleAI;
}

// Initialize the Database JSON file
initDb();

const app = express();

// Increase JSON body limits to support raw Base64 PDF uploads seamlessly
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * Authentication Middleware
 */
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Token is invalid or has expired' });
    }
    req.user = decoded;
    next();
  });
}

/**
 * API Endpoints
 */

// Auth - Signup
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  try {
    const existing = findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const newUser = await createUser(email, name, password, role || 'sender');
    const token = jwt.sign({ id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user: newUser, token });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error occurred during signup' });
  }
});

// Auth - Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password credentials' });
    }

    const valid = await verifyUserPassword(user.id, password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error occurred during login' });
  }
});

// Auth - Get current user profile
app.get('/api/auth/me', authenticateToken, (req: any, res) => {
  const user = findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User profile not found' });
  }
  res.json({ user });
});

// Documents - Get user dashboard & files list
app.get('/api/documents', authenticateToken, (req: any, res) => {
  try {
    const list = getDocumentsForUser(req.user.id);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
});

// Documents - Initiate signing request & upload PDF
app.post('/api/documents', authenticateToken, (req: any, res) => {
  const { title, fileName, fileSize, fileData, signerName, signerEmail, coords, addTimestamp, timestampCoords } = req.body;
  if (!title || !fileData || !signerName || !signerEmail || !coords) {
    return res.status(400).json({ error: 'Missing required parameters for uploading document' });
  }

  try {
    const doc = createDocument(
      title,
      fileName || 'document.pdf',
      fileSize || 'Unknown',
      req.user.id,
      req.user.email,
      fileData,
      signerName,
      signerEmail,
      coords as SignatureCoords,
      addTimestamp,
      timestampCoords
    );

    // WebSocket notify target
    if ((global as any).broadcastNotification) {
      (global as any).broadcastNotification(signerEmail, {
        type: 'document_assigned',
        message: `You have been assigned a new document to sign: "${title}" by ${req.user.email}`,
        title,
        token: doc.request.token,
        docId: doc.id
      });
    }

    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create document: ' + err.message });
  }
});

// Documents - Generate a pre-written template PDF contract directly
app.post('/api/documents/sample', authenticateToken, async (req: any, res) => {
  const { title, signerName, signerEmail, coords, addTimestamp, timestampCoords } = req.body;
  if (!title || !signerName || !signerEmail || !coords) {
    return res.status(400).json({ error: 'Missing template parameters' });
  }

  try {
    // Generate professional non-disclosure agreement via PDF-Lib
    const sampleB64 = await createSamplePdf();
    
    const doc = createDocument(
      title,
      'NDA_Agreement_Template.pdf',
      '14 KB',
      req.user.id,
      req.user.email,
      sampleB64,
      signerName,
      signerEmail,
      coords as SignatureCoords,
      addTimestamp,
      timestampCoords
    );

    // WebSocket notify target
    if ((global as any).broadcastNotification) {
      (global as any).broadcastNotification(signerEmail, {
        type: 'document_assigned',
        message: `You have been assigned a new document to sign: "${title}" by ${req.user.email}`,
        title,
        token: doc.request.token,
        docId: doc.id
      });
    }

    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate template NDA agreement: ' + err.message });
  }
});

// Documents - Fetch details of a specific document (Authorized)
app.get('/api/documents/:id', authenticateToken, (req: any, res) => {
  const doc = getDocumentById(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Ensure user owns or is requested to sign this document
  const isOwner = doc.uploadedBy === req.user.id;
  const isSigner = doc.request.signerEmail.toLowerCase() === req.user.email.toLowerCase();

  if (!isOwner && !isSigner) {
    return res.status(403).json({ error: 'You do not have keys to check this document' });
  }

  res.json(doc);
});

// Public Portal - Retrieve signing request & basic document context (Unauthenticated bypass using secure slug)
app.get('/api/signing-request/:token', (req, res) => {
  const doc = getDocumentByToken(req.params.token);
  if (!doc) {
    return res.status(404).json({ error: 'This secure signing request was not found, or it might have been deleted.' });
  }

  // Expose document to guest signer but omit raw PDF source if unwanted or return basic info
  // For the frontend signature pad to load page previews properly, we can return fileData
  // because guest needs the PDF view. We keep it secure with tokenization access control!
  res.json({
    id: doc.id,
    title: doc.title,
    fileName: doc.fileName,
    createdAt: doc.createdAt,
    uploadedByEmail: doc.uploadedByEmail,
    status: doc.status,
    request: doc.request,
    fileData: doc.fileData, // Raw file for interactive signing coordinates
    signedFileData: doc.signedFileData, // Completed file
    docHash: doc.docHash,
    auditLogs: doc.auditLogs
  });
});

// Public Portal - Perform signature and modify PDF (Unauthenticated guest endpoint secured by crypt-token)
app.post('/api/signing-request/:token/sign', async (req, res) => {
  const { signatureImage, signerName } = req.body;
  if (!signatureImage || !signerName) {
    return res.status(400).json({ error: 'Signature canvas image data and signer confirmation name are required' });
  }

  const token = req.params.token;
  const signerIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Web Browser';

  try {
    const updatedDoc = await signDocumentOnServer(token, signatureImage, signerIp, userAgent, signerName);

    // Broadcast WebSocket notification to BOTH sender and signer
    if ((global as any).broadcastNotification) {
      // notify creator
      (global as any).broadcastNotification(updatedDoc.uploadedByEmail, {
        type: 'document_signed',
        message: `Your document "${updatedDoc.title}" has been signed by ${signerName}!`,
        title: updatedDoc.title,
        docId: updatedDoc.id,
        signerEmail: updatedDoc.request.signerEmail
      });
      // notify signed signer as well (to refresh view)
      (global as any).broadcastNotification(updatedDoc.request.signerEmail, {
        type: 'document_signed_client',
        message: `You have successfully signed "${updatedDoc.title}"`,
        title: updatedDoc.title,
        docId: updatedDoc.id
      });
    }

    res.json(updatedDoc);
  } catch (err: any) {
    res.status(422).json({ error: err.message });
  }
});

// Public Portal - Reject signature request
app.post('/api/signing-request/:token/reject', (req, res) => {
  const { reason } = req.body;
  const token = req.params.token;
  const signerIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Web Browser';

  try {
    const updatedDoc = rejectDocumentOnServer(token, signerIp, userAgent, reason || 'No reason provided');

    // Broadcast WebSocket notification to sender
    if ((global as any).broadcastNotification) {
      (global as any).broadcastNotification(updatedDoc.uploadedByEmail, {
        type: 'document_rejected',
        message: `Your document "${updatedDoc.title}" was declined by ${updatedDoc.request.signerName || 'the signer'}. Reason: "${reason || 'No reason specified'}"`,
        title: updatedDoc.title,
        docId: updatedDoc.id
      });
    }

    res.json(updatedDoc);
  } catch (err: any) {
    res.status(422).json({ error: err.message });
  }
});

/**
 * Reusable Templates APIs (RBAC Checked)
 */
app.get('/api/templates', authenticateToken, (req: any, res) => {
  if (req.user.role === 'signer') {
    return res.status(403).json({ error: 'Access denied: Signers do not have template privileges.' });
  }
  res.json(getTemplates());
});

app.post('/api/templates', authenticateToken, (req: any, res) => {
  if (req.user.role === 'signer') {
    return res.status(403).json({ error: 'Access denied: Signers cannot create reusable document templates.' });
  }
  const { title, fileName, fileSize, fileData, fields } = req.body;
  if (!title || !fileData) {
    return res.status(400).json({ error: 'Template title and PDF base64 fileData are required' });
  }
  try {
    const tpl = createTemplate(
      title,
      fileName || 'reusable_template.pdf',
      fileSize || 'Standard',
      req.user.id,
      req.user.email,
      fileData,
      fields || []
    );
    res.status(201).json(tpl);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/templates/:id', authenticateToken, (req: any, res) => {
  if (req.user.role === 'signer') {
    return res.status(403).json({ error: 'Access denied: Signers cannot delete templates.' });
  }
  const deleted = deleteTemplate(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Template not found or could not be removed' });
  }
  res.json({ success: true, message: 'Document template destroyed successfully' });
});

/**
 * Document Deletion & Editing APIs (Role-Based Access Control)
 */
app.delete('/api/documents/:id', authenticateToken, (req: any, res) => {
  try {
    const deleted = deleteDocument(req.params.id, req.user.id, req.user.role);
    if (!deleted) {
      return res.status(403).json({ error: 'Unauthorized: Only the original Sender or system Admins are permitted to delete documents.' });
    }
    res.json({ success: true, message: 'Document removed successfully from servers' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/documents/:id', authenticateToken, (req: any, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Rename operations require a non-empty title parameter.' });
  }
  try {
    const doc = editDocumentTitle(req.params.id, title, req.user.id, req.user.role);
    if (!doc) {
      return res.status(404).json({ error: 'Document was not found.' });
    }
    res.json(doc);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

/**
 * Admin Panel APIs
 */
app.get('/api/admin/users', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: System administration clearance required.' });
  }
  res.json(getAllUsers());
});

/**
 * Free Document Editor APIs
 */
app.get('/api/editor/defaults', authenticateToken, (req: any, res) => {
  res.json([
    {
      id: 'default-nda',
      title: 'Mutual Non-Disclosure Agreement',
      subtitle: 'Standard corporate confidentiality agreement',
      content: `### MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (the "Agreement") is entered into to protect Confidential Information disclosed between the parties.

### 1. DEFINITION OF CONFIDENTIAL INFORMATION
Confidential Information refers to any proprietary information, technical data, trade secrets, software designs, or business operations disclosed by one party to another.

### 2. OBLIGATIONS OF CONFIDENTIALITY
The Recipient agrees to hold all Confidential Information in absolute trust. The Recipient shall not disclose, copy, or distribute any such information to third parties without express prior written consent from the Discloser.

### 3. TERM OF AGREEMENT
This confidentiality restriction shall survive for a duration of five (5) years following the original execution date of this Agreement.

### 4. GOVERNING LAW
This contract is formulated and shall be governed under the laws of the State of Delaware.`
    },
    {
      id: 'default-contractor',
      title: 'Independent Contractor Agreement',
      subtitle: 'Freelance & consulting service engagement',
      content: `### INDEPENDENT CONTRACTOR SERVICE AGREEMENT

This Agreement is made between the Client and the Independent Contractor to establish the terms of consulting service engagement.

### 1. SCOPE OF SERVICES
The Contractor agrees to perform software development, interface design, secure systems architecture, and surrounding tech consulting services as assigned by the Client from time to time.

### 2. COMPENSATION & INVOICING
Services shall be billed at a standard pre-negotiated rate. The Contractor shall submit itemized invoices bi-weekly, payable within thirty (30) days of receipt.

### 3. INTELLECTUAL PROPERTY
Any code, components, graphics, designs, or systems developed under this contract shall belong solely to the Client upon full clearance of the corresponding invoices.

### 4. INDEPENDENT STATUS
The Contractor operates as an independent entity. Nothing herein shall construct an employer-employee partnership, joint enterprise, or permanent agency between the parties.`
    },
    {
      id: 'default-advisory',
      title: 'Advisor Agreement',
      subtitle: 'Startup advisory and equity terms template',
      content: `### STRATEGIC ADVISORY BOARD AGREEMENT

This Startup Advisor Agreement is entered into to define startup mentorship, consulting sessions, and surrounding equity/compliance structures.

### 1. ADVISORY SERVICES
The Advisor agrees to attend monthly advisory board meetings and provide high-level tech product roadmap guidance, industry introductions, and operational mentorship as requested.

### 2. COMPENSATION (STOCK OPTIONS)
Subject to company Board of Directors approval, the Advisor shall be granted stock options representing 0.25% of the company's fully-diluted equity, vesting over a standard 2-year vesting schedule.

### 3. NO CONFLICT OF INTEREST
The Advisor represents that their consulting services do not conflict with active corporate employments, academic researcher contracts, or prior advisory arrangements.

### 4. CONFIDENTIALITY
All operational details, cap tables, private technical roadmap specifications, and confidential designs disclosed shall remain strictly confidential under standard non-disclosure rules.`
    },
    {
      id: 'default-sale',
      title: 'Bill of Sale',
      subtitle: 'General property or equipment purchase record',
      content: `### GENERAL BILL OF SALE & PURCHASE RECEIPT

This document serves as an legal and official receipt and contract for the transfer of ownership of described private asset property.

### 1. DESCRIPTION OF ACQUIRED PROPERTY
The Seller hereby sells, assigns, and transfers all rights, interests, and title in the specified equipment and assets to the Buyer.

### 2. PURCHASE PRICE & TRANSFER
The agreed purchase price has been paid in full via electronic bank wire or direct draft. The Seller hereby acknowledges receipt of the full payment.

### 3. WARRANTY DISCLAIMER (AS-IS)
The property is sold entirely "AS-IS", without any warranties of any kind, express or implied. The Buyer accepts all present conditions upon transfer.

### 4. SELLER REPRESENTATION
The Seller certifies they hold sole, clear, and unencumbered title to the property and are authorized to execute this transfer without external liens or liabilities.`
    }
  ]);
});

app.post('/api/editor/ai-draft', authenticateToken, async (req: any, res) => {
  const { prompt, type } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'A descriptive prompt or type is required' });
  }

  try {
    const ai = getGoogleAI();
    const systemInstruction = `You are a professional legal draft assistant in DocerX.
Your task is to write a highly professional, pristine, well-structured legal contract/document based on the user's prompt.
Do not output markdown block wrappers like \`\`\`markdown or \`\`\`. Start writing the document content directly.
Use Heading weights using "### " or "**" wrapping on both sides for headings (e.g., "### 1. SCOPE OF SERVICES" or "**1. COMPLY COVENANTS**").
Keep the terminology crisp, formal, corporate, and highly legal-grade. Do not add conversational fillers or greetings at the start or completion.`;

    const userPrompt = `Draft a professional contract with legal terminology for: "${prompt}" (Category: ${type || 'Custom'}).`;

    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    res.json({ draft: result.text || 'Failed to generate content.' });
  } catch (err: any) {
    console.error('[Gemini AI Draft Error]', err);
    res.status(500).json({ error: 'Gemini service failed. Please check that GEMINI_API_KEY is configured in Settings > Secrets. Error: ' + err.message });
  }
});

app.post('/api/editor/compile', authenticateToken, async (req: any, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'A valid document title and text body content are required.' });
  }

  try {
    const base64Pdf = await compileCustomPdf(title, content, req.user.email);
    res.json({
      fileData: base64Pdf,
      fileName: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_draft.pdf`
    });
  } catch (err: any) {
    console.error('[Editor Compile Error]', err);
    res.status(500).json({ error: 'PDF Compilation failed: ' + err.message });
  }
});


/**
 * Handle Frontend routing context
 */
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

/**
 * Handle Frontend routing context and WebSocket Server bindings
 */
async function startServer() {
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  const clients = new Map<WebSocket, { userId?: string; email?: string }>();

  wss.on('connection', (ws) => {
    console.log('[WebSocket] Real-time client connected.');
    clients.set(ws, {});

    ws.on('message', (message) => {
      try {
        const payload = JSON.parse(message.toString());
        if (payload.type === 'register') {
          clients.set(ws, { 
            userId: payload.userId, 
            email: payload.email?.toLowerCase() 
          });
          console.log(`[WebSocket] Client registered for notification events: ${payload.email}`);
        }
      } catch (err) {
        // Ignore parsing errors
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('[WebSocket] Real-time client disconnected.');
    });
  });

  // Global broadcaster for the server endpoints
  (global as any).broadcastNotification = (targetEmailOrId: string, payload: any) => {
    const ident = targetEmailOrId?.toLowerCase();
    for (const [ws, info] of clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        const isTarget = !targetEmailOrId || info.email === ident || info.userId === targetEmailOrId;
        if (isTarget) {
          ws.send(JSON.stringify(payload));
        }
      }
    }
  };

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[DocerX Server] Server running actively at http://localhost:${PORT}`);
  });
}

startServer();
