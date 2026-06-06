/**
 * DocerX Secure Public Signature Portal
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, FileText, CheckCircle2, AlertCircle, XCircle, 
  Download, Sparkles, Send, Mail, Eye, Info, Clock, MapPin, Check, Trash2
} from 'lucide-react';
import SignaturePad from './SignaturePad';
import AuditTrail from './AuditTrail';

const SIGNATURE_FONTS = [
  { id: 'dancing-script', name: 'Dancing Script', font: 'Dancing Script' },
  { id: 'great-vibes', name: 'Great Vibes', font: 'Great Vibes' },
  { id: 'sacramento', name: 'Sacramento', font: 'Sacramento' },
  { id: 'yellowtail', name: 'Yellowtail', font: 'Yellowtail' }
];

interface SigningPortalProps {
  tokenSlug: string;
}

export default function SigningPortal({ tokenSlug }: SigningPortalProps) {
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Signature logic
  const [signatureImage, setSignatureImage] = useState('');
  const [signerName, setSignerName] = useState('');
  const [fontFamily, setFontFamily] = useState('dancing-script');
  const [resetKey, setResetKey] = useState(0);

  const handleResetSignature = () => {
    setSignatureImage('');
    setFontFamily('dancing-script');
    setResetKey(prev => prev + 1);
  };
  
  // Reject reason flow
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  // Transaction states
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasScrolledTerms, setHasScrolledTerms] = useState(false);

  // Fetch document by public security token slug
  const syncDocument = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/signing-request/${tokenSlug}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'This secure signing request was not found, or it was revoked.');
      }
      setDoc(data);
      // Pre-populate signer name from metadata
      setSignerName(data.request.signerName || '');
    } catch (err: any) {
      setError(err.message || 'Signature network connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tokenSlug) {
      syncDocument();
    }
  }, [tokenSlug]);

  // Download PDF locally from Base64 stream
  const handlePdfDownload = (base64Data: string, titleName: string, isSignedFile = false) => {
    try {
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const docUrl = URL.createObjectURL(blob);
      
      const cleanTitle = titleName.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
      const finalFileName = isSignedFile ? `DocerX_Signed_${cleanTitle}.pdf` : `DocerX_Original_${cleanTitle}.pdf`;

      const downloadTrigger = document.createElement('a');
      downloadTrigger.href = docUrl;
      downloadTrigger.download = finalFileName;
      
      document.body.appendChild(downloadTrigger);
      downloadTrigger.click();
      document.body.removeChild(downloadTrigger);
      URL.revokeObjectURL(docUrl);
    } catch (err) {
      alert('Verification binary download error: ' + (err as Error).message);
    }
  };

  // Submit Signature transaction
  const executeSignatureProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatureImage) {
      setError('Please draw or type your digital stamp signature in the pad below.');
      return;
    }
    if (!signerName.trim()) {
      setError('Please confirm your full legal name to legally witness this transaction.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/signing-request/${tokenSlug}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signatureImage,
          signerName: signerName.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'The system could not embed this signature onto the file structural blocks.');
      }

      setDoc(data);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Server-side PDF compile failure');
    } finally {
      setSubmitting(false);
    }
  };

  // Decline/Reject signature transaction
  const executeRejection = async () => {
    if (!rejectReason.trim()) {
      setError('Please provide a short reason for declining/rejecting this contract.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/signing-request/${tokenSlug}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: rejectReason.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Platform failed to register document decline signals.');
      }

      setDoc(data);
      setShowRejectForm(false);
    } catch (err: any) {
      setError(err.message || 'Server signal failure');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 select-none font-sans">
        <div className="bg-slate-950 p-3 rounded-2xl mb-4 border-2 border-slate-950 animate-bounce">
          <ShieldCheck className="w-8 h-8 text-white stroke-[2.5px]" />
        </div>
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-slate-950 mb-3" />
        <span className="text-xs font-black text-slate-900 uppercase tracking-widest">VERIFYING TOKEN CREDENTIALS...</span>
        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-mono font-bold leading-none">Resolving blockchain and hash verification tunnels</p>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="bg-white border-4 border-slate-950 p-8 rounded-3xl max-w-sm space-y-4 shadow-xl">
          <XCircle className="w-14 h-14 text-rose-600 mx-auto animate-pulse" />
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Security Integrity Fault</h3>
          <p className="text-xs text-slate-500 font-bold leading-relaxed uppercase tracking-wider italic">{error}</p>
          <div className="pt-2">
            <button
              onClick={() => window.location.reload()}
              className="bg-slate-950 hover:bg-slate-900 text-white text-xs font-black uppercase tracking-widest px-5 py-3 rounded-lg cursor-pointer border-2 border-slate-950"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If document already signed, presentation view
  const isAlreadySigned = doc.status === 'signed';
  const isAlreadyRejected = doc.status === 'rejected';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans" id="signing-portal-viewport">
      {/* Visual Public Brand Header */}
      <header className="bg-slate-950 text-white border-b-4 border-slate-950 p-5 px-6 md:px-12 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-white text-slate-900 border-2 border-slate-950 p-1.5 rounded-lg shadow-sm">
            <ShieldCheck className="w-5 h-5 text-slate-900 stroke-[3px]" />
          </div>
          <span className="text-lg font-black tracking-tight uppercase">DocerX</span>
          <span className="text-[9px] bg-slate-900 text-slate-400 font-mono font-black border border-slate-800 px-2.5 py-1 rounded leading-none flex items-center gap-1 uppercase tracking-widest">
            SECURE LINK PORTAL
          </span>
        </div>

        <div className="text-right hidden md:block">
          <span className="text-[9px] text-slate-400 block uppercase font-black tracking-widest">Document Initiator Coordinator</span>
          <span className="text-xs font-mono font-black text-blue-400">{doc.uploadedByEmail}</span>
        </div>
      </header>

      {/* Main Signing Area Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 lg:p-12 space-y-8">
        
        {success || isAlreadySigned ? (
          /* Signature Completed Certification card */
          <div className="bg-white border-4 border-slate-950 text-slate-800 rounded-3xl shadow-2xl p-6 md:p-10 space-y-6 max-w-2xl mx-auto" id="signing-success-certificate">
            <div className="text-center space-y-3">
              <div className="inline-flex bg-slate-900 text-white p-4 rounded-full shadow-lg">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase">Document Sealed Successfully</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto uppercase tracking-wide font-bold">
                Electronic transaction record locked on server. This certificate proves mutual consent and cryptographic integrity under the ESIGN Act parameters.
              </p>
            </div>

            <div className="border-2 border-slate-900 bg-slate-100/50 rounded-2xl p-5 space-y-3 font-semibold uppercase text-xs tracking-wider">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                <span className="font-bold text-slate-500">Document ID Code</span>
                <span className="font-mono font-black text-slate-900 bg-slate-200 px-2.5 py-1 rounded-md border border-slate-350">{doc.id}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                <span className="font-bold text-slate-500">Witness Legal Name</span>
                <span className="font-black text-slate-900">{doc.request.signerName} ({doc.request.signerEmail})</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                <span className="font-bold text-slate-500">UTC System Timestamp</span>
                <span className="font-mono text-slate-650 font-black">{new Date(doc.request.signedAt || new Date()).toISOString()}</span>
              </div>
              {doc.docHash && (
                <div className="flex flex-col gap-1 pt-1">
                  <span className="font-bold text-slate-500">Secure Cryptographic Checksum</span>
                  <span className="font-mono text-[11px] text-yellow-600 lowercase font-extrabold break-all bg-white p-3 rounded-xl border border-slate-300 shadow-inner select-all">{doc.docHash}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                id="success-download-btn"
                onClick={() => handlePdfDownload(doc.signedFileData, doc.title, true)}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-200 uppercase tracking-widest cursor-pointer select-none transition-all duration-300 border-2 border-blue-700 hover:scale-[1.01]"
              >
                <Download className="w-4 h-4 text-white" /> Download Signed PDF + Verification seal
              </button>
            </div>

            <div className="pt-6 border-t-2 border-slate-200">
              <AuditTrail logs={doc.auditLogs} docHash={doc.docHash} />
            </div>
          </div>
        ) : isAlreadyRejected ? (
          /* Rejection Alert Presentation Card */
          <div className="bg-white border-4 border-slate-950 rounded-3xl p-8 max-w-lg mx-auto text-center space-y-5 shadow-xl" id="signing-rejected-card">
            <XCircle className="w-16 h-16 text-rose-600 mx-auto animate-pulse" />
            <div className="space-y-1.5">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Contract Declined</h2>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-extrabold">
                You chose to decline or reject this document on the platform. The legal seal is dissolved and the request coordinator has been notified.
              </p>
            </div>

            <div className="bg-rose-50 border-2 border-rose-900 text-rose-900 p-4.5 rounded-xl text-xs text-left font-bold uppercase tracking-wider">
              <strong className="text-rose-950 font-black block mb-1">Decline Argument:</strong> {doc.auditLogs[0]?.details || 'No argument reason registered.'}
            </div>

            <div className="text-[10px] text-slate-450 font-mono flex justify-center gap-4 uppercase font-bold tracking-wider">
              <span>IP Locked ID: {doc.auditLogs[0]?.ip || 'Unknown'}</span>
              <span>Clock: {new Date(doc.auditLogs[0]?.timestamp).toLocaleString()}</span>
            </div>
          </div>
        ) : (
          /* Standard interactive Signing Portal Form UI */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Integrated Preview sheet paper */}
            <div className="lg:col-span-12 xl:col-span-5 flex flex-col space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                <FileText className="w-4 h-4 text-slate-800" />
                <span>CONTRACT REAL-TIME SHEET DEPICTION</span>
              </div>

              <div className="relative w-full aspect-[4/5] bg-white border-2 border-slate-900 rounded-2xl shadow-xl p-8 flex flex-col justify-between text-slate-800 overflow-hidden select-none">
                {/* Simulated Contract Typography Overlay */}
                <div className="space-y-4">
                  <div className="border-b border-slate-200 pb-3 flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-black tracking-tight text-slate-900 uppercase">Mutual Agreement Terms</h4>
                      <p className="text-[8px] text-slate-400 font-mono tracking-wider">DOCERX LEGAL TRANS-ID: DX-{doc.id.toUpperCase()}</p>
                    </div>
                    <span className="text-[8px] bg-slate-900 text-white px-2 py-0.5 rounded font-mono font-black leading-none">PAGE 1</span>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <h5 className="text-[12px] font-extrabold text-slate-800 tracking-tight leading-snug">{doc.title}</h5>
                    <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
                      This formal bilateral protocol serves as an Electronic ESIGN execution record between <span className="text-indigo-600 font-bold">{doc.uploadedByEmail}</span> and the designated recipient <span className="text-slate-900 font-black underline select-all">{doc.request.signerName}</span>. Any digital stamps registered will be cryptographically locked on server-side databases utilizing binary SHA-256 integrity checkers...
                    </p>
                    
                    {/* Simulated visual layout lines */}
                    <div className="space-y-2 pt-2 opacity-30">
                      <div className="h-2 bg-slate-400 rounded-full w-5/6" />
                      <div className="h-2 bg-slate-400 rounded-full w-full" />
                      <div className="h-2 bg-slate-300 rounded-full w-11/12" />
                      <div className="h-2 bg-slate-300 rounded-full w-4/5" />
                    </div>
                  </div>
                </div>

                {/* Live Placed Coordinates signature visual overlay preview */}
                <div
                  style={{
                    left: `${doc.request.coords.x}%`,
                    top: `${doc.request.coords.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className="absolute"
                >
                  {signatureImage ? (
                    <div className="relative border-2 border-dashed border-slate-900 p-1 bg-white/95 rounded shadow-lg animate-fade-in w-[120px] aspect-[4/1.5] flex items-center justify-center overflow-hidden">
                      <img 
                        src={signatureImage} 
                        alt="Canvas placement preview overlay" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain filter drop-shadow-sm pointer-events-none" 
                      />
                      <span className="absolute right-0.5 bottom-0.5 text-[6px] text-blue-600 font-mono font-black uppercase leading-none">PREVIEW</span>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-amber-550 bg-amber-50/90 text-amber-900 rounded font-black px-2 py-1 select-none flex flex-col justify-center items-center w-[110px] h-[40px] text-[8px] animate-pulse">
                      <span>STAMP TARGET</span>
                      <span className="font-mono text-[7px] text-amber-600 font-black">X: {doc.request.coords.x}% Y: {doc.request.coords.y}%</span>
                    </div>
                  )}
                </div>

                {/* Footer simulation */}
                <div className="flex justify-between items-end border-t border-slate-100 pt-3 opacity-30" id="paper-doc-footer-sim">
                  <div className="space-y-1">
                    <div className="h-2 bg-slate-400 rounded-full w-16" />
                    <div className="h-2 bg-slate-400 rounded-full w-10" />
                  </div>
                  <span className="text-[8px] font-mono leading-none">Page 1 of 1</span>
                </div>
              </div>
            </div>

            {/* Right Column: Execution Form Controls */}
            <div className="lg:col-span-12 xl:col-span-7 space-y-6">
              
              <div className="bg-white p-6 md:p-8 rounded-3xl border-2 border-slate-900 shadow-md space-y-4">
                <div className="flex items-center gap-3 mb-2 border-b border-slate-200 pb-4" id="signer-identity-header">
                  <span className="bg-slate-900 p-2 rounded-xl border border-slate-900">
                    <Clock className="w-5 h-5 text-white" />
                  </span>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight text-slate-900">Recipient Witness Block</h3>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-black leading-none mt-1">Witness Witness Standard</p>
                  </div>
                </div>

                {error && (
                  <div className="bg-rose-950/5 border-2 border-rose-900 text-rose-900 p-3 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1.5" id="signing-error-banner">
                    <AlertCircle className="w-4 h-4 text-rose-800 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {showRejectForm ? (
                  /* Decline input box */
                  <div className="bg-rose-950/5 border-2 border-rose-900 rounded-2xl p-5 space-y-4" id="decline-expansion">
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-rose-900 uppercase tracking-widest font-sans">Confirm decline details</h4>
                      <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide leading-normal">Tell the initiator why you are rejecting/declining this signing order:</p>
                    </div>

                    <textarea
                      id="reject-reason-textarea"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="E.g., Section 3 about legal ownership clauses needs modification..."
                      rows={3}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-sans"
                    />

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        id="cancel-reject-btn"
                        onClick={() => {
                          setError('');
                          setShowRejectForm(false);
                        }}
                        className="text-xs font-black text-slate-600 hover:text-slate-900 px-4 py-2 uppercase tracking-widest cursor-pointer select-none"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        id="submit-reject-btn"
                        onClick={executeRejection}
                        disabled={submitting}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 px-5 rounded-lg text-xs cursor-pointer select-none border-2 border-rose-700 transition uppercase tracking-wider disabled:opacity-50"
                      >
                        {submitting ? 'Decline processing...' : 'Confirm legal decline'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Form main fields */
                  <form onSubmit={executeSignatureProcess} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block font-sans">Verify Your Full Legal Name</label>
                      <input
                        type="text"
                        id="signing-name-field"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="John Doe"
                        required
                        className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl py-3 px-4 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block font-sans">Choose Signature Cursive Font</label>
                        <span className="text-[10px] text-indigo-650 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded shadow-xs font-mono font-bold uppercase tracking-wider">Type Stamp Style</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border-2 border-slate-900 p-3 rounded-2xl">
                        {SIGNATURE_FONTS.map((f) => {
                          const isSelected = fontFamily === f.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setFontFamily(f.id)}
                              className={`py-3 px-2 border-2 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[64px] ${isSelected ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-black shadow-sm scale-[1.01]' : 'border-slate-100 bg-slate-50/50 hover:border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                            >
                              <span style={{ fontFamily: f.font }} className="text-xl leading-none mb-1 text-slate-900 font-medium">
                                {signerName.trim() || 'Signature'}
                              </span>
                              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold leading-none">{f.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block font-sans">Affix Pen Signature Stamp</label>
                        {(signatureImage || fontFamily !== 'dancing-script') && (
                          <button
                            type="button"
                            id="reset-signature-btn"
                            onClick={handleResetSignature}
                            className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider"
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[2.5px]" />
                            Reset Signature
                          </button>
                        )}
                      </div>
                      <SignaturePad 
                        key={resetKey}
                        signerName={signerName} 
                        fontFamily={fontFamily}
                        onFontFamilyChange={(fId) => setFontFamily(fId)}
                        onSave={(b64) => setSignatureImage(b64)} 
                      />
                    </div>

                    <div className="text-[11px] text-slate-500 border-t border-slate-200 pt-4 leading-relaxed flex items-start gap-2 bg-slate-100/50 p-4 rounded-xl font-medium">
                      <Info className="w-5 h-5 text-slate-700 flex-shrink-0 mt-0.5" />
                      <span>
                        By clicking <strong className="text-slate-900 uppercase font-black">"APPLY DIGITAL STAMP & SIGN"</strong>, you acknowledge your electronic agreement is legally equivalent to your physical hand-written signature under the Electronic Signatures in Global and National Commerce (ESIGN) Act principles.
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        type="button"
                        id="decline-shortcut-btn"
                        onClick={() => setShowRejectForm(true)}
                        className="px-5 py-3 bg-white hover:bg-slate-50 text-rose-650 border-2 border-rose-900/60 text-xs font-black rounded-lg transition overflow-hidden cursor-pointer select-none uppercase tracking-widest"
                      >
                        Decline Order
                      </button>

                      <button
                        type="submit"
                        id="signing-submit-btn"
                        disabled={submitting || !signatureImage}
                        className="flex-1 bg-slate-900 hover:bg-slate-950 text-white font-black py-3.5 px-6 rounded-lg text-xs transition flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none uppercase tracking-widest border-2 border-slate-900"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {submitting ? 'Sealing Cryptography Block...' : 'Apply Digital Stamp & Sign'}
                      </button>
                    </div>
                  </form>
                )}

              </div>

              {/* Information disclaimer card */}
              <div className="bg-slate-950 text-slate-200 p-6 md:p-8 rounded-3xl border-2 border-slate-900 flex flex-col md:flex-row gap-4 items-start select-none shadow" id="signing-portal-info-banner">
                <ShieldCheck className="w-10 h-10 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">DocerX Cryptographic Cybersecurity Verification</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed uppercase tracking-wider font-semibold">
                    This document utilizes advanced asymmetric SHA-256 checksum tags. Any pixel modifications made inside the PDF structural blocks are permanently stamped with the signer's internet server IP address, timestamp geolocation records, and browser identification. This guarantees complete, tamperproof non-repudiation in judicial or corporate audit settings.
                  </p>
                </div>
              </div>

            </div>

          </div>
        )}

      </main>

      <footer className="bg-slate-950 py-6 border-t-2 border-slate-900 text-center text-[10px] text-slate-400 font-mono select-none mt-auto uppercase tracking-widest font-black">
        <span>DocerX Digital Trust Management Engine • Fully SHA-256 Sealed compliant • Enterprise Standard</span>
      </footer>
    </div>
  );
}
