/**
 * DocerX Document Initiator Modal & Visual Coordinate Placement Stage
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, FileUp, Sparkles, Send, Move, Calendar, AlertCircle, Check, Settings, LayoutGrid } from 'lucide-react';
import { SignatureCoords, TemplateField } from '../types';

interface DocumentModalProps {
  onClose: () => void;
  onCreated: (newDoc: any) => void;
  token: string | null;
  initialFileData?: string;
  initialFileName?: string;
  initialTitle?: string;
}

export default function DocumentModal({ onClose, onCreated, token, initialFileData, initialFileName, initialTitle }: DocumentModalProps) {
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Config Meta/File, Step 2: Visual Placement
  const [title, setTitle] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  
  // File variables
  const [isTemplate, setIsTemplate] = useState(true); // default to template for easy testing
  const [fileDataB64, setFileDataB64] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  
  // Prepopulate if compiled from free editor
  useEffect(() => {
    if (initialFileData) {
      setFileDataB64(initialFileData);
      setFileName(initialFileName || 'compiled_document.pdf');
      setTitle(initialTitle || 'Custom Compiled Contract');
      setFileSize('Custom Draft');
      setIsTemplate(false);
    }
  }, [initialFileData, initialFileName, initialTitle]);
  
  // Reusable templates catalog support
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Focus alignment toggle
  const [activePlacement, setActivePlacement] = useState<'signature' | 'timestamp'>('signature');

  // Position Signature Coordinates (Resizable)
  const [coords, setCoords] = useState<SignatureCoords>({
    x: 65, // percentage from left
    y: 75, // percentage from top
    page: 1,
    width: 170,
    height: 60
  });

  // Separate Option for Timestamp (Resizable)
  const [addTimestamp, setAddTimestamp] = useState(false);
  const [timestampCoords, setTimestampCoords] = useState<SignatureCoords>({
    x: 25, // percentage from left
    y: 75, // percentage from top
    page: 1,
    width: 150,
    height: 45
  });

  const uploadContainerRef = useRef<HTMLDivElement | null>(null);

  // Load custom templates list
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/templates', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const tpls = await response.json();
          setAvailableTemplates(tpls);
        }
      } catch (err) {
        console.warn('Could not sync custom reusable templates catalog');
      }
    };
    fetchTemplates();
  }, [token]);

  // Handle template selection change
  const handleTemplateSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tplId = e.target.value;
    setSelectedTemplateId(tplId);
    if (!tplId) return;

    const chosen = availableTemplates.find(t => t.id === tplId);
    if (chosen) {
      setTitle(chosen.title.replace('Template: ', ''));
      setFileDataB64(chosen.fileData);
      setFileName(chosen.fileName);
      setFileSize(chosen.fileSize);
      setIsTemplate(false);
      setError('');

      // Auto-load coordinate slots from designated template fields
      if (chosen.fields && chosen.fields.length > 0) {
        const sigField = chosen.fields.find((f: any) => f.type === 'signature');
        if (sigField) {
          setCoords({
            x: sigField.x,
            y: sigField.y,
            page: sigField.page || 1,
            width: sigField.width || 170,
            height: sigField.height || 60
          });
        }
        const timeField = chosen.fields.find((f: any) => f.type === 'timestamp');
        if (timeField) {
          setAddTimestamp(true);
          setTimestampCoords({
            x: timeField.x,
            y: timeField.y,
            page: timeField.page || 1,
            width: timeField.width || 150,
            height: timeField.height || 45
          });
        } else {
          setAddTimestamp(false);
        }
      }
    }
  };

  // Handle local PDF upload conversion to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Only PDF documents are supported for legal cryptography standards');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      const base64Data = resultStr.split(',')[1];
      setFileDataB64(base64Data);
      setFileName(file.name);
      setFileSize(`${(file.size / 1024).toFixed(1)} KB`);
      setIsTemplate(false);
      setSelectedTemplateId('');
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const proceedToPlacement = () => {
    setError('');
    if (!title.trim()) {
      setError('Please input a document query title');
      return;
    }
    if (!signerName.trim() || !signerEmail.trim()) {
      setError('Target Signer name and email address are required');
      return;
    }
    
    // Regular expression for simple email format validate
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signerEmail.trim())) {
      setError('Please provide a valid recipient email address format');
      return;
    }

    if (!isTemplate && !fileDataB64) {
      setError('Please attach a PDF file or select professional NDA Template');
      return;
    }

    setStep(2);
  };

  // Drag and Drop simulation coordinates handler
  const paperStageRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Standard click positioning based on active focus node
  const handleStageClickOrPlace = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!paperStageRef.current) return;
    const stageRect = paperStageRef.current.getBoundingClientRect();
    
    const clickX = ((e.clientX - stageRect.left) / stageRect.width) * 100;
    const clickY = ((e.clientY - stageRect.top) / stageRect.height) * 100;

    const boundedX = Math.min(Math.max(clickX, 10), 90);
    const boundedY = Math.min(Math.max(clickY, 15), 85);

    if (activePlacement === 'signature') {
      setCoords(prev => ({
        ...prev,
        x: Math.round(boundedX),
        y: Math.round(boundedY)
      }));
    } else {
      setTimestampCoords(prev => ({
        ...prev,
        x: Math.round(boundedX),
        y: Math.round(boundedY)
      }));
    }
  };

  // Drag coordination supports for active focus target
  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>, targetNode: 'signature' | 'timestamp') => {
    setIsDragging(false);
    if (!paperStageRef.current) return;
    const stageRect = paperStageRef.current.getBoundingClientRect();
    
    const dragX = ((e.clientX - stageRect.left) / stageRect.width) * 100;
    const dragY = ((e.clientY - stageRect.top) / stageRect.height) * 100;

    const boundedX = Math.min(Math.max(dragX, 10), 90);
    const boundedY = Math.min(Math.max(dragY, 15), 85);

    if (targetNode === 'signature') {
      setCoords(prev => ({
        ...prev,
        x: Math.round(boundedX),
        y: Math.round(boundedY)
      }));
    } else {
      setTimestampCoords(prev => ({
        ...prev,
        x: Math.round(boundedX),
        y: Math.round(boundedY)
      }));
    }
  };

  // Submit request to network Express endpoints
  const createRequestInstance = async () => {
    setLoading(true);
    setError('');

    const isSample = isTemplate;
    const endpoint = isSample ? '/api/documents/sample' : '/api/documents';
    
    const payload = {
      title,
      signerName,
      signerEmail,
      coords,
      addTimestamp,
      timestampCoords: addTimestamp ? timestampCoords : undefined,
      ...(isSample ? {} : { fileName, fileSize, fileData: fileDataB64 })
    };

    try {
      // 1. If checked, save current layout design as a reusable templates catalog item
      if (saveAsTemplate) {
        let savedB64 = fileDataB64;
        
        // If it's a sample agreement template, fetch a generated PDF first
        if (isSample && !savedB64) {
          try {
            const demoResponse = await fetch('/api/documents/sample', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                title,
                signerName,
                signerEmail,
                coords
              })
            });
            if (demoResponse.ok) {
              const demoDoc = await demoResponse.json();
              savedB64 = demoDoc.fileData;
            }
          } catch (e) {
            console.warn('Template pre-rendering skipped');
          }
        }

        await fetch('/api/templates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: `Template: ${title}`,
            fileName: fileName || 'NDA_Agreement_Template.pdf',
            fileSize: fileSize || '14 KB',
            fileData: savedB64 || 'NDA_Agreement_Template.pdf',
            fields: [
              { type: 'signature', x: coords.x, y: coords.y, width: coords.width, height: coords.height },
              ...(addTimestamp ? [{ type: 'timestamp', x: timestampCoords.x, y: timestampCoords.y, width: timestampCoords.width, height: timestampCoords.height }] : [])
            ]
          })
        });
      }

      // 2. Dispatch primary signature request creation
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server rejected document publishing');
      }

      onCreated(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Signature request network crash');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div 
        id="document-modal-box"
        className="bg-white rounded-3xl w-full max-w-2xl border-2 border-slate-900 overflow-hidden shadow-2xl flex flex-col my-auto"
      >
        {/* Modal Header */}
        <div className="flex bg-slate-900 text-white p-6 justify-between items-center px-8 border-b-2 border-slate-950">
          <div>
            <h2 className="text-xl font-black tracking-tight uppercase">Initiate Request</h2>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">Step {step} of 2: {step === 1 ? 'Configure Metadata & File' : 'Drag-and-drop target alignment'}</p>
          </div>
          <button 
            type="button" 
            id="close-modal-btn"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 md:p-8 overflow-y-auto max-h-[75vh] space-y-6">
          
          {error && (
            <div className="bg-rose-950/5 border-2 border-rose-900 text-rose-900 p-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 italic">
              <AlertCircle className="w-4 h-4 text-rose-800 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-6">
              {/* Templates catalog fast selection */}
              {availableTemplates.length > 0 && (
                <div className="p-4 bg-slate-900 text-white rounded-2xl border-2 border-slate-950 space-y-2">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-black uppercase tracking-widest text-blue-400">DocerX Template Catalog</span>
                  </div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Deploy a pre-configured template to save coordinate mapping and setup times:</p>
                  <select
                    id="template-catalog-dropdown"
                    value={selectedTemplateId}
                    onChange={handleTemplateSelection}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white uppercase font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Apply a Reusable Template Layout --</option>
                    {availableTemplates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.fileName} - fields: {t.fields?.length || 0})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Form Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block font-sans">Document Title</label>
                  <input
                    type="text"
                    id="doc-modal-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="E.g., NDA NON-DISCLOSURE AGREEMENT, MUTUAL BINDING"
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block font-sans">Recipient Legal Name (Signer)</label>
                  <input
                    type="text"
                    id="doc-modal-signer-name"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Dr. Mary Vance"
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block font-sans">Recipient Email (Signer)</label>
                  <input
                    type="email"
                    id="doc-modal-signer-email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold"
                  />
                </div>
              </div>

              {/* Source selection tab */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block font-sans">File Source Setup</label>
                
                <div className="grid grid-cols-2 gap-4 pb-1" id="file-source-selector">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTemplate(true);
                      setFileDataB64('');
                      setFileName('');
                      setFileSize('');
                      setSelectedTemplateId('');
                    }}
                    className={`flex items-center justify-center gap-2 p-4 border-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer select-none ${isTemplate ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Sparkles className="w-4 h-4" /> BINDING NDA TEMPLATE
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTemplate(false)}
                    className={`flex items-center justify-center gap-2 p-4 border-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer select-none ${!isTemplate ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    <FileUp className="w-4 h-4" /> CUSTOM UPLOAD FILE
                  </button>
                </div>

                {isTemplate ? (
                  <div className="bg-blue-50/50 border-2 border-slate-200 rounded-2xl p-5 text-xs leading-relaxed text-slate-655 font-bold uppercase tracking-wider">
                    <strong className="text-blue-600 font-extrabold">⚡ STANDARD AGREEMENT ENFORCED:</strong> Generates a clean, legally structured 1-page Mutual Non-Disclosure Agreement dynamically on the server utilizing certified systems font embeddings. No external file attachment needed to evaluate this workflow.
                  </div>
                ) : (
                  <div 
                    ref={uploadContainerRef}
                    onClick={() => document.getElementById('pdf-file-picker')?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 hover:border-slate-900 cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 bg-slate-50/50 select-none"
                  >
                    <input
                      type="file"
                      id="pdf-file-picker"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <FileUp className="w-10 h-10 text-slate-400" />
                    
                    {fileName ? (
                      <div className="space-y-1">
                        <p className="text-sm font-black text-emerald-700 underline truncate max-w-[320px] uppercase">{fileName}</p>
                        <p className="text-xs text-slate-500 font-mono font-bold leading-none">{fileSize}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Select PDF Document</p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-mono font-bold">Max Binary Size 10MB • ESIGN Standard PDF</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Toggle to persist as custom reusable template */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3 select-none">
                <input
                  type="checkbox"
                  id="checkbox-save-as-template"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                  className="w-4.5 h-4.5 text-blue-650 bg-slate-100 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer mt-0.5"
                />
                <div className="flex flex-col gap-0.5">
                  <label htmlFor="checkbox-save-as-template" className="text-xs font-black text-slate-900 uppercase tracking-wider cursor-pointer">
                    💾 Save Document Layout as a Reusable Template
                  </label>
                  <p className="text-[10.5px] text-slate-500 font-bold uppercase tracking-wide">
                    Checking this saves the file and mapped coordinate zones so you can re-deploy this exact package with one click in the dropdown template list!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Left Control Panel Column: Resizing Sliders & Timestamps Options */}
              <div className="md:col-span-5 space-y-5" id="alignment-control-sidebar">
                
                {/* Checkbox to add a separate timestamp option */}
                <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="add-timestamp-checkbox"
                      checked={addTimestamp}
                      onChange={(e) => {
                        setAddTimestamp(e.target.checked);
                        if (e.target.checked) {
                          setActivePlacement('timestamp');
                        } else {
                          setActivePlacement('signature');
                        }
                      }}
                      className="w-4.5 h-4.5 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="add-timestamp-checkbox" className="text-xs font-black text-slate-900 uppercase tracking-widest cursor-pointer flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-indigo-600" /> Independent Timestamp option
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase leading-normal">
                    When enabled, provides a separate placement zone capsule rendering the official cryptographic signature timestamp string (UTC).
                  </p>
                </div>

                {/* Target node selector tabs */}
                <div className="space-y-2">
                  <p className="text-[9.5px] font-black uppercase text-slate-400 tracking-wider">Placement Focus Node</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setActivePlacement('signature')}
                      className={`p-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg border-2 transition-all cursor-pointer ${activePlacement === 'signature' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      🖋️ Signature
                    </button>
                    <button
                      type="button"
                      disabled={!addTimestamp}
                      onClick={() => setActivePlacement('timestamp')}
                      className={`p-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg border-2 transition-all cursor-pointer ${!addTimestamp ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-405' : activePlacement === 'timestamp' ? 'bg-indigo-900 border-indigo-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50'}`}
                    >
                      📅 Timestamp Block
                    </button>
                  </div>
                  <p className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wide">
                    {activePlacement === 'signature' ? '📍 Clicking the sheet aligns signature stamp coordinates.' : '📍 Clicking the sheet aligns separate official timestamp coordinates.'}
                  </p>
                </div>

                {/* Customizable dimensions (free to resize coordinates width and height sliders) */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl border-2 border-slate-950 space-y-4">
                  <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2">
                    <Settings className="w-4 h-4 text-yellow-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Dimension Calipers</span>
                  </div>

                  {/* Resizer sliders for active selection */}
                  {activePlacement === 'signature' ? (
                    <div className="space-y-3.5">
                      <div className="flex justify-between items-center text-[10.5px] font-mono uppercase font-black">
                        <span className="text-slate-405">Signature Stamp Width</span>
                        <span className="text-blue-400">{coords.width} px</span>
                      </div>
                      <input
                        type="range"
                        min="100"
                        max="300"
                        value={coords.width || 170}
                        onChange={(e) => setCoords(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                        className="w-full bg-slate-850 h-2 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />

                      <div className="flex justify-between items-center text-[10.5px] font-mono uppercase font-black">
                        <span className="text-slate-405">Signature Stamp Height</span>
                        <span className="text-blue-400">{coords.height} px</span>
                      </div>
                      <input
                        type="range"
                        min="40"
                        max="120"
                        value={coords.height || 60}
                        onChange={(e) => setCoords(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                        className="w-full bg-slate-850 h-2 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      <div className="flex justify-between items-center text-[10.5px] font-mono uppercase font-black">
                        <span className="text-slate-405">Timestamp Box Width</span>
                        <span className="text-indigo-400">{timestampCoords.width} px</span>
                      </div>
                      <input
                        type="range"
                        min="100"
                        max="300"
                        value={timestampCoords.width || 150}
                        onChange={(e) => setTimestampCoords(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                        className="w-full bg-slate-850 h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />

                      <div className="flex justify-between items-center text-[10.5px] font-mono uppercase font-black">
                        <span className="text-slate-405">Timestamp Box Height</span>
                        <span className="text-indigo-400">{timestampCoords.height} px</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="100"
                        value={timestampCoords.height || 45}
                        onChange={(e) => setTimestampCoords(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                        className="w-full bg-slate-850 h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  )}

                  <div className="text-[9.5px] text-slate-400 font-semibold uppercase leading-normal border-t border-slate-850 pt-3">
                    Drag sliders to change stamp dimensions. Size parameters are encoded into the compiled PDF matrix structure.
                  </div>
                </div>

              </div>

              {/* Interactive Virtual Sheet Area Column */}
              <div className="md:col-span-7 space-y-3">
                <div className="bg-slate-905 bg-slate-900 border border-slate-950 rounded-xl p-3 text-[10.5px] font-bold text-white uppercase tracking-wider flex justify-between">
                  <span>Sign: <strong className="text-blue-450 font-mono text-yellow-400 font-extrabold">{coords.x}%, {coords.y}% ({coords.width}x{coords.height})</strong></span>
                  {addTimestamp && (
                    <span>Time: <strong className="text-indigo-400 font-mono font-extrabold">{timestampCoords.x}%, {timestampCoords.y}%</strong></span>
                  )}
                </div>

                <div 
                  id="stage-canvas-sandbox"
                  ref={paperStageRef}
                  onClick={handleStageClickOrPlace}
                  onDragOver={handleDragOver}
                  className="relative w-full aspect-[4/5] bg-slate-100 border-2 border-slate-950 rounded-2xl shadow-xl cursor-crosshair flex flex-col justify-between p-6 select-none bg-gradient-to-b from-white to-slate-50 overflow-hidden"
                >
                  {/* Subtle document content lines placeholders */}
                  <div className="space-y-3 opacity-20">
                    <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                      <div className="h-4 bg-slate-900 rounded-full w-1/3" />
                      <div className="h-2 bg-slate-400 rounded-full w-20" />
                    </div>
                    <div className="h-2.5 bg-slate-500 rounded-full w-5/6" />
                    <div className="h-2.5 bg-slate-400 rounded-full w-full" />
                    <div className="h-2.5 bg-slate-450 rounded-full w-full" />
                    <div className="h-2.5 bg-slate-400 rounded-full w-11/12" />
                    <div className="h-2 rounded-full bg-slate-350 w-2/3" />
                  </div>

                  {/* Dynamic Signature overlay frame (resizable) */}
                  <div
                    draggable
                    onDragStart={handleDragStart}
                    onDragEnd={(e) => handleDragEnd(e, 'signature')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePlacement('signature');
                    }}
                    style={{
                      left: `${coords.x}%`,
                      top: `${coords.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: `${coords.width}px`,
                      height: `${coords.height}px`
                    }}
                    className={`absolute border-2 border-dashed bg-white/90 text-slate-900 rounded-lg p-2 cursor-grab shadow-lg flex flex-col justify-center items-center select-none transition-all ${activePlacement === 'signature' ? 'border-blue-600 ring-2 ring-blue-450/40 z-20 scale-105' : 'border-slate-400 z-10 opacity-70 hover:opacity-100'}`}
                  >
                    <div className="flex items-center gap-1 font-black text-blue-600 tracking-wider uppercase text-[8.5px] leading-tight select-none">
                      <Move className="w-2.5" /> SIGN HERE
                    </div>
                    <span className="font-mono text-[8px] text-slate-500 font-black uppercase mt-0.5 max-w-full truncate leading-none">
                      {signerName || 'Mary Vance'}
                    </span>
                  </div>

                  {/* Independent Optional Timestamp overlay frame */}
                  {addTimestamp && (
                    <div
                      draggable
                      onDragStart={handleDragStart}
                      onDragEnd={(e) => handleDragEnd(e, 'timestamp')}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePlacement('timestamp');
                      }}
                      style={{
                        left: `${timestampCoords.x}%`,
                        top: `${timestampCoords.y}%`,
                        transform: 'translate(-50%, -50%)',
                        width: `${timestampCoords.width}px`,
                        height: `${timestampCoords.height}px`
                      }}
                      className={`absolute border-2 border-dashed bg-white/95 rounded-lg p-1.5 cursor-grab shadow-lg flex flex-col justify-center items-center select-none transition-all ${activePlacement === 'timestamp' ? 'border-amber-600 ring-2 ring-amber-400/40 z-20 scale-105' : 'border-indigo-400 z-10 opacity-70 hover:opacity-100'}`}
                    >
                      <div className="flex items-center gap-1 font-black text-amber-700 tracking-wider uppercase text-[8px] leading-tight select-none">
                        <Calendar className="w-2.5 text-amber-600" /> UTC TIMESTAMP
                      </div>
                      <span className="font-mono text-[7px] text-slate-500 font-black uppercase mt-0.5 max-w-full truncate leading-none">
                        CRYPTO REGISTER SEAL
                      </span>
                    </div>
                  )}

                  <div className="space-y-2 opacity-20">
                    <div className="h-2.5 bg-slate-500 rounded-full w-full" />
                    <div className="h-2.5 bg-slate-400 rounded-full w-3/4" />
                  </div>

                  {/* Footer metadata */}
                  <div className="flex justify-between items-end border-t border-slate-300 pt-2 relative text-[8px] text-slate-400 font-mono font-black uppercase">
                    <span>SECURITY CLASSIFICATION: ENVELOPE-94A</span>
                    <span>PG 1 OF 1</span>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 p-5 px-8 bg-slate-50">
          <div>
            {step === 2 && (
              <button
                type="button"
                id="doc-modal-back-btn"
                onClick={() => setStep(1)}
                className="text-xs font-black text-slate-655 hover:text-slate-900 transition-all uppercase tracking-widest py-2 select-none cursor-pointer"
              >
                Back To Details
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              id="doc-modal-cancel-btn"
              onClick={onClose}
              className="text-xs font-black text-slate-800 hover:bg-slate-100 transition-all py-3 px-5 border-2 border-slate-900 bg-white rounded-lg cursor-pointer shadow-xs select-none uppercase tracking-wider"
            >
              Cancel
            </button>
            
            {step === 1 ? (
              <button
                type="button"
                id="doc-modal-continue-btn"
                onClick={proceedToPlacement}
                className="text-xs font-black text-white bg-slate-900 hover:bg-slate-950 transition-all py-3 px-5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm select-none uppercase tracking-widest"
              >
                Assign Coordinate Seal
              </button>
            ) : (
              <button
                type="button"
                id="doc-modal-submit-btn"
                onClick={createRequestInstance}
                disabled={loading}
                className="text-xs font-black text-white bg-blue-600 hover:bg-blue-700 transition-all py-3 px-6 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-200 disabled:opacity-50 select-none uppercase tracking-widest font-sans"
              >
                <Send className="w-4 h-4 text-white" />
                {loading ? 'Publishing Request...' : 'Lock Seal & Send Link'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
