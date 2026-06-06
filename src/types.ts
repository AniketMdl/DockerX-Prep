/**
 * Shared type definitions for DocerX
 * SPDX-License-Identifier: Apache-2.0
 */

export type DocumentStatus = 'pending' | 'signed' | 'rejected';
export type UserRole = 'admin' | 'sender' | 'signer';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  role: UserRole;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  performedByEmail: string;
  ip: string;
  userAgent: string;
  details: string;
}

export interface SignatureCoords {
  x: number; // Percentage relative layout (0 to 100)
  y: number; // Percentage relative layout (0 to 100)
  page: number; // 1-indexed
  width: number; // Pixel width
  height: number; // Pixel height;
}

export interface SignatureRequest {
  id: string;
  signerEmail: string;
  signerName: string;
  token: string;
  status: DocumentStatus;
  coords: SignatureCoords;
  timestampCoords?: SignatureCoords; // Independent location for timestamp stamp
  addTimestamp?: boolean; // Option to stamp timestamp
  signedAt?: string;
  signatureImage?: string; // Base64 of signature drawing or stylized SVG
}

export interface Document {
  id: string;
  title: string;
  fileName: string;
  fileSize: string;
  uploadedBy: string; // User ID
  uploadedByEmail: string;
  createdAt: string;
  status: DocumentStatus;
  fileData: string; // Base64 representation of original PDF
  signedFileData?: string; // Base64 of signed PDF
  request: SignatureRequest;
  auditLogs: AuditLog[];
  docHash?: string; // SHA-256 secure hash
}

export interface TemplateField {
  id: string;
  type: 'signature' | 'text' | 'checkbox' | 'timestamp';
  name: string;
  x: number; // Percentage (0 to 100)
  y: number; // Percentage (0 to 100)
  page: number; // 1-indexed
  width: number; // Pixel width
  height: number; // Pixel height
  required: boolean;
  value?: string; // Prepopulated default or user-filled value
}

export interface DocumentTemplate {
  id: string;
  title: string;
  fileName: string;
  fileSize: string;
  uploadedBy: string; // User ID
  uploadedByEmail: string;
  createdAt: string;
  fileData: string; // Base64 representation of template PDF
  fields: TemplateField[];
}

export interface DashboardStats {
  total: number;
  signed: number;
  pending: number;
  rejected: number;
}
