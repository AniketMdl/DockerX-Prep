/**
 * DocerX Free Document & Custom PDF Editor Workbench
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, FileText, Download, Send, RotateCw, Check, AlertCircle, FileEdit, HelpCircle } from 'lucide-react';

interface DocumentEditorProps {
  token: string | null;
  onInitiateSignFlow: (pdfData: string, title: string, fileName: string) => void;
}

interface DefaultTemplate {
  id: string;
  title: string;
  subtitle: string;
  content: string;
}

export default function DocumentEditor({ token, onInitiateSignFlow }: DocumentEditorProps) {
  const [title, setTitle] = useState('Consulting Services Agreement');
  const [content, setContent] = useState('');
  const [templates, setTemplates] = useState<DefaultTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  // AI assist states
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState(false);

  // Compile and Action states
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState('');
  const [lastCompiledFile, setLastCompiledFile] = useState<any | null>(null);

  // Load standard pre-written template drafts on startup
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/editor/defaults', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTemplates(data);
          if (data.length > 0) {
            setSelectedTemplateId(data[0].id);
            setContent(data[0].content);
            setTitle(data[0].title);
          }
        }
      } catch (err) {
        console.warn('Failed to load standard default templates');
      }
    };
    fetchTemplates();
  }, [token]);

  // Handle template switch
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tplId = e.target.value;
    setSelectedTemplateId(tplId);
    const chosen = templates.find(t => t.id === tplId);
    if (chosen) {
      setContent(chosen.content);
      setTitle(chosen.title);
    }
  };

  // Consult Gemini AI to draft custom contract
  const handleAiDraft = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiSuccess(false);

    try {
      const res = await fetch('/api/editor/ai-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: aiPrompt.trim(), type: 'Custom Draft' })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI Drafting service returned an error');
      }
      if (data.draft) {
        setContent(data.draft);
        setTitle(aiPrompt.trim().substring(0, 45) + ' Agreement');
        setAiSuccess(true);
        setTimeout(() => setAiSuccess(false), 4000);
      }
    } catch (err: any) {
      setAiError(err.message || 'Gemini system failed to construct query.');
    } finally {
      setAiLoading(false);
    }
  };

  // Compile PDF via Back-end
  const compilePdf = async (): Promise<{ fileData: string; fileName: string } | null> => {
    if (!title.trim() || !content.trim()) {
      setCompileError('Title and Document Content cannot be left empty.');
      return null;
    }
    setCompiling(true);
    setCompileError('');

    try {
      const res = await fetch('/api/editor/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: title.trim(), content: content.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to compile custom document.');
      }
      return data;
    } catch (err: any) {
      setCompileError(err.message || 'PDF Assembly aborted.');
      return null;
    } finally {
      setCompiling(false);
    }
  };

  // Download PDF locally
  const handleDownload = async () => {
    const result = await compilePdf();
    if (!result) return;

    try {
      // Decode Base64 to ArrayBuffer to download standard attachment PDF safely
      const byteCharacters = atob(result.fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setCompileError('Blob allocation failure: ' + err.message);
    }
  };

  // Instantly pipe compiled PDF into Sign-off Coordination modal props
  const handleInitiateSign = async () => {
    const result = await compilePdf();
    if (!result) return;
    onInitiateSignFlow(result.fileData, title.trim(), result.fileName);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 text-white h-full" id="docerx_editor_workspace">
      {/* LEFT COLUMN: Controls, Edit text, and Gemini AI */}
      <div className="flex-1 flex flex-col gap-5 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <FileEdit className="w-5 h-5" id="editor_icon" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white leading-tight">Drafting Office Workbench</h2>
            <p className="text-xs text-slate-400 mt-0.5">Author standard contracts or invoke Gemini to draft fresh parameters</p>
          </div>
        </div>

        <hr className="border-slate-800" />

        {/* Form elements row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5" htmlFor="contract-title-input">Document Title</label>
            <input
              id="contract-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 text-sm font-semibold rounded-xl px-4 py-2.5 outline-none transition-all placeholder-slate-600"
              placeholder="e.g. Mutual Freelance Agreement"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5" htmlFor="contract-preset-dropdown">Load Default Template Preset</label>
            <select
              id="contract-preset-dropdown"
              value={selectedTemplateId}
              onChange={handleTemplateChange}
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 text-sm font-semibold text-slate-300 rounded-xl px-4 py-2.5 outline-none transition-all appearance-none cursor-pointer"
            >
              {templates.map(tpl => (
                <option key={tpl.id} value={tpl.id} className="bg-slate-950 text-slate-300">
                  {tpl.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Text Area Content Box */}
        <div className="flex-1 flex flex-col gap-2 min-h-[300px]">
          <div className="flex justify-between items-center bg-slate-950 border-t border-x border-slate-800 px-4 py-2 rounded-t-xl text-xs text-slate-400 font-medium">
            <span>Contract Content Markdown Markup</span>
            <div className="flex gap-2 text-[10px]">
              <span className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-500">### Section</span>
              <span className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-500">**Bold Text**</span>
            </div>
          </div>
          <textarea
            id="contract-content-raw-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full flex-1 min-h-[250px] bg-slate-950 border-b border-x border-slate-800 focus:border-blue-500 text-sm rounded-b-xl p-4 outline-none transition-all resize-none font-mono text-slate-300 leading-relaxed placeholder-slate-700"
            placeholder="Type any contract or text variables here. You can make custom headers using ### or wrap items in ** to bold them."
          />
        </div>

        {/* AI Drafting Area */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" id="sparkles_icon" />
            <span>Consult Gemini AI Draft Autocomplete</span>
          </div>
          <p className="text-[11px] text-slate-400">Describe what kind of agreement or key clauses you need, and Gemini will model a legal draft context</p>
          <div className="flex gap-2">
            <input
              id="ai_draft_prompt_input"
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={aiLoading}
              className="flex-1 bg-slate-900 border border-slate-800/80 focus:border-indigo-500 text-xs text-slate-200 rounded-lg px-3 py-2 outline-none transition-all placeholder-slate-500 disabled:opacity-55"
              placeholder="e.g. A consulting contract for web development with weekly milestone payouts"
              onKeyDown={(e) => e.key === 'Enter' && handleAiDraft()}
            />
            <button
              id="trigger_gemini_draft_btn"
              onClick={handleAiDraft}
              disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all text-white shrink-0"
            >
              {aiLoading ? (
                <>
                  <RotateCw className="w-3 h-3 animate-spin" id="spin_anim_icon" />
                  Drawing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" id="inner_sparkles_icon" />
                  Gemini AI Draft
                </>
              )}
            </button>
          </div>

          {aiError && (
            <div className="p-2.5 bg-red-950/40 border border-red-900/30 text-red-400 text-xs rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" id="ai_error_icon" />
              <span>{aiError}</span>
            </div>
          )}

          {aiSuccess && (
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 text-xs rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" id="ai_success_icon" />
              <span>Prisine draft successfully populated in editor above! Feel free to customize.</span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Real-Time formatted sheet simulation preview */}
      <div className="xl:w-[480px] shrink-0 flex flex-col gap-5 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" id="file_text_preview_icon" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Wysiwyg Paper Preview</span>
            </div>
            <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">PDF Format Sheet</span>
          </div>

          <hr className="border-slate-800" />

          {/* SIMULATED SHEET WRAPPER PAGE */}
          <div className="bg-white text-slate-950 w-full min-h-[500px] border border-slate-300 rounded mb-4 shadow p-6 flex flex-col justify-between font-serif relative overflow-hidden select-none">
            {/* Header watermarking and inner border */}
            <div className="absolute inset-4 border border-slate-200/80 pointer-events-none p-3 flex flex-col justify-between">
              <div className="flex justify-between items-center text-[7px] text-slate-400/80 font-sans tracking-wide">
                <span>DOCERX DIGITAL WORKBENCH DRAFT</span>
                <span>AUTHENTIC CLOUD FILE</span>
              </div>
              <div className="flex justify-between items-center text-[7px] text-slate-400/80 font-sans tracking-wide">
                <span>ID: SECURE-DX-FORMULATED-STAMP</span>
                <span>PRE-VERIFIED APPARATUS</span>
              </div>
            </div>

            <div className="z-10 px-2 mt-4">
              {/* Draft Document Name */}
              <h3 className="font-sans font-bold text-slate-900 text-sm tracking-tight border-b pb-1.5 mb-3 uppercase">
                {title || 'Untitled Custom agreement'}
              </h3>

              {/* Parsed paragraphs render */}
              <div className="space-y-2 text-[9px] text-slate-800 leading-relaxed font-sans max-h-[340px] overflow-y-auto pr-1">
                {content ? (
                  content.split('\n').map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={idx} className="h-2" />;
                    if (trimmed.startsWith('###') || (trimmed.startsWith('**') && trimmed.endsWith('**'))) {
                      const heading = trimmed.replace(/^###\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '');
                      return (
                        <h4 key={idx} className="font-bold text-slate-900 border-b border-b-slate-100 pt-1.5 pb-0.5 text-[10px] tracking-tight">
                          {heading}
                        </h4>
                      );
                    }
                    return <p key={idx} className="text-[8.5px] leading-relaxed text-slate-700 font-sans">{trimmed}</p>;
                  })
                ) : (
                  <div className="text-slate-400 italic text-[10px] text-center pt-24 font-sans">
                    Document is empty. Preset loaded or typing text displays custom print layouts.
                  </div>
                )}
              </div>
            </div>

            {/* Signature Stamps rows */}
            <div className="z-10 grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-3 mt-4 text-[7px] font-sans text-slate-500">
              <div>
                <p className="font-bold text-slate-700 uppercase">First Signatory Stamp:</p>
                <div className="font-serif italic text-[10px] text-emerald-600 font-black tracking-wide my-1">
                  PRE-SIGNED (DocerX)
                </div>
                <div className="border-t border-slate-300 w-full pt-1">
                  Initiator Deploy Email
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-700 uppercase">Signatory Recipient Balance:</p>
                <div className="font-mono text-amber-600 font-bold my-1 flex items-center gap-0.5">
                  <Check className="w-2.5 h-2.5 line-through opacity-40 shrink-0" />
                  AWAITING SEAL STAMP
                </div>
                <div className="border-t border-slate-300 w-full pt-1">
                  Authorized Legal Signer
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM CONTAINER: Compile action triggers */}
        <div className="flex flex-col gap-3">
          {compileError && (
            <div className="bg-red-950/50 border border-red-900/30 text-red-400 p-2.5 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" id="compile_error_icon" />
              <span>{compileError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3" id="compile_action_grid">
            <button
              id="download_compiled_pdf_btn"
              onClick={handleDownload}
              disabled={compiling || !content.trim()}
              className="px-4 py-3 bg-slate-950 border border-slate-800 hover:border-slate-700 disabled:opacity-50 disabled:border-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-slate-200 hover:text-white"
            >
              <Download className="w-4 h-4 text-slate-400" id="download_icon" />
              <span>Download Draft</span>
            </button>
            <button
              id="initiate_sign_request_from_editor_btn"
              onClick={handleInitiateSign}
              disabled={compiling || !content.trim()}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-white shadow-lg shadow-blue-500/10"
            >
              <Send className="w-4 h-4 text-blue-100" id="send_for_signing_icon" />
              <span>Send for Signing</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500 text-center uppercase tracking-wider">
            Electronically seal draft as legally binding under ESIGN parameters
          </p>
        </div>
      </div>
    </div>
  );
}
