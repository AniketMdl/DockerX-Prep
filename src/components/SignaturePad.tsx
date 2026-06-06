/**
 * DocerX Interactive Signature Canvas/Pad Component
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { Edit3, Type, Trash2, CheckCircle2 } from 'lucide-react';

interface SignaturePadProps {
  key?: string | number;
  onSave: (base64Png: string) => void;
  signerName: string;
  fontFamily?: string;
  onFontFamilyChange?: (fontId: string) => void;
}

const SIGNATURE_FONTS = [
  { id: 'great-vibes', name: 'Elegant Calligraphy', css: '"Great Vibes", cursive', font: 'Great Vibes' },
  { id: 'dancing-script', name: 'Artistic Flow', css: '"Dancing Script", cursive', font: 'Dancing Script' },
  { id: 'sacramento', name: 'Monoline Script', css: '"Sacramento", cursive', font: 'Sacramento' },
  { id: 'yellowtail', name: 'Sleek Retro', css: '"Yellowtail", cursive', font: 'Yellowtail' },
  { id: 'playfair', name: 'Prestigious Serif Italic', css: 'italic "Playfair Display", Georgia, serif', font: 'Playfair Display' },
  { id: 'cursive', name: 'Classic Cursive', css: '"Brush Script MT", cursive', font: 'Brush Script MT' },
  { id: 'courier', name: 'Vintage Typewriter', css: 'italic "Courier New", monospace', font: 'Courier New' }
];

const INK_COLORS = [
  { id: 'navy', color: '#1e3a8a', label: 'Navy' },
  { id: 'black', color: '#0f172a', label: 'Black' },
  { id: 'crimson', color: '#be123c', label: 'Crimson' }
];

export default function SignaturePad({ onSave, signerName, fontFamily: fontFamilyProp, onFontFamilyChange }: SignaturePadProps) {
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState(signerName || '');
  const [fontFamily, setFontFamily] = useState(fontFamilyProp || 'great-vibes');
  const [fontSize, setFontSize] = useState<number>(34);

  // Keep typedName updated dynamically if parent prop updates
  useEffect(() => {
    setTypedName(signerName || '');
  }, [signerName]);

  // Keep fontFamily updated dynamically if parent prop updates
  useEffect(() => {
    if (fontFamilyProp) {
      setFontFamily(fontFamilyProp);
    }
  }, [fontFamilyProp]);
  const [inkColor, setInkColor] = useState('#1e3a8a');
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  // Initialize Canvas
  useEffect(() => {
    if (mode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = inkColor; // Custom selected ink color
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [mode, inkColor]);

  // Handle Resize canvas correctly
  useEffect(() => {
    if (mode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2; // high DPI scaling
      canvas.height = rect.height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [mode, inkColor]);

  // Drawing mouse/touch handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getEventCoords(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasContent(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getEventCoords(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    triggerSave();
  };

  const getEventCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Check touch vs mouse
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasContent(false);
    onSave(''); // Notify parent that signature was cleared
  };

  const triggerSave = () => {
    if (mode === 'draw' && canvasRef.current) {
      // Return canvas data as PNG Base64
      const canvas = canvasRef.current;
      // Convert to smaller size or directly save
      onSave(canvas.toDataURL('image/png'));
    }
  };

  // When text input updates, generate styled SVG and trigger saving
  useEffect(() => {
    if (mode === 'type') {
      if (!typedName.trim()) {
        onSave('');
        return;
      }
      // Draw typed name onto an offscreen canvas to export PNG base64
      const offscreen = document.createElement('canvas');
      offscreen.width = 400;
      offscreen.height = 120;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 400, 120);
        ctx.fillStyle = inkColor; // custom ink color

        // Find the matched font
        const matchedFnt = SIGNATURE_FONTS.find(f => f.id === fontFamily) || SIGNATURE_FONTS[0];
        
        let fontStyleSpec = `${fontSize}px ${matchedFnt.font}`;
        if (matchedFnt.id === 'playfair') {
          fontStyleSpec = `italic ${fontSize - 4}px "Playfair Display", Georgia, serif`;
        } else if (matchedFnt.id === 'courier') {
          fontStyleSpec = `italic ${fontSize - 6}px "Courier New", monospace`;
        } else if (matchedFnt.id === 'cursive') {
          fontStyleSpec = `${fontSize}px "Brush Script MT", cursive`;
        } else {
          fontStyleSpec = `${fontSize}px "${matchedFnt.font}", cursive, sans-serif`;
        }
        
        ctx.font = fontStyleSpec;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(typedName, 200, 60);

        // Draw a decorative legal flourish line under the signature
        ctx.strokeStyle = inkColor;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(70, 85);
        ctx.quadraticCurveTo(200, 98, 330, 85);
        ctx.stroke();

        onSave(offscreen.toDataURL('image/png'));
      }
    }
  }, [mode, typedName, fontFamily, fontSize, inkColor]);

  const selectFont = (fontId: string) => {
    setFontFamily(fontId);
    if (onFontFamilyChange) {
      onFontFamilyChange(fontId);
    }
  };

  return (
    <div className="w-full bg-slate-50 border-2 border-slate-900 rounded-3xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center mb-4 border-b-2 border-slate-200 pb-4" id="sig-pad-header">
        <div className="space-y-1">
          <label className="text-xs font-black text-slate-800 uppercase tracking-widest block font-sans">Digital Signature Instrument</label>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ink Color:</span>
            <div className="flex gap-2">
              {INK_COLORS.map(ic => (
                <button
                  key={ic.id}
                  type="button"
                  onClick={() => setInkColor(ic.color)}
                  className={`w-5.5 h-5.5 rounded-full border-2 transition-all cursor-pointer ${inkColor === ic.color ? 'border-slate-800 scale-110 shadow-xs' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  style={{ backgroundColor: ic.color }}
                  title={ic.label}
                />
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-xs self-start">
          <button
            type="button"
            id="sig-mode-draw"
            onClick={() => setMode('draw')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-widest select-none transition-all cursor-pointer ${mode === 'draw' ? 'bg-slate-900 text-white' : 'text-slate-650 hover:bg-slate-100'}`}
          >
            <Edit3 className="w-3.5 h-3.5 stroke-[2.5px]" /> Draw Ink
          </button>
          <button
            type="button"
            id="sig-mode-type"
            onClick={() => setMode('type')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-widest select-none transition-all cursor-pointer ${mode === 'type' ? 'bg-slate-900 text-white' : 'text-slate-650 hover:bg-slate-100'}`}
          >
            <Type className="w-3.5 h-3.5 stroke-[2.5px]" /> Type Stamp
          </button>
        </div>
      </div>

      {mode === 'draw' ? (
        <div className="relative">
          <canvas
            id="signature-canvas"
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-40 bg-white border-2 border-dashed border-slate-350 rounded-xl cursor-crosshair shadow-inner touch-none"
          />
          
          <div className="absolute right-3 bottom-3 flex gap-2">
            <button
              type="button"
              id="clear-canvas-btn"
              onClick={clearCanvas}
              disabled={!hasContent}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-rose-650 hover:bg-rose-50 border-2 border-slate-900 rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear Pad Ink"
            >
              <Trash2 className="w-3.5 h-3.5 stroke-[2.5px]" /> Reset Paint
            </button>
            
            {hasContent && (
              <span className="flex items-center gap-1 text-[10px] text-white font-black uppercase tracking-widest bg-emerald-600 px-3 py-1.5 rounded-lg border-2 border-slate-900 shadow-sm animate-fade-in">
                <CheckCircle2 className="w-3 h-3 stroke-[2.5px]" /> Sealed
              </span>
            )}
          </div>
          
          <p className="text-[10px] text-slate-450 mt-2 uppercase font-mono font-bold tracking-widest text-center">
            Sign inside boundaries using mouse, trackpad, or screen touch controls.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">Verify Signature Font Choice</label>
              
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 py-0.5">
                <span className="text-[9px] font-bold text-slate-400 mr-1">SIZE</span>
                <button
                  type="button"
                  onClick={() => setFontSize(prev => Math.max(18, prev - 2))}
                  className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center font-bold text-xs uppercase cursor-pointer"
                  title="Decrease Font Size"
                >
                  A⁻
                </button>
                <span className="text-[10px] font-black font-mono text-slate-800 w-5 text-center">{fontSize}</span>
                <button
                  type="button"
                  onClick={() => setFontSize(prev => Math.min(48, prev + 2))}
                  className="w-5 h-5 rounded hover:bg-slate-100 flex items-center justify-center font-bold text-xs uppercase cursor-pointer"
                  title="Increase Font Size"
                >
                  A⁺
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border border-slate-200 p-2.5 bg-white rounded-2xl" id="signature-font-picker">
              {SIGNATURE_FONTS.map(f => {
                const isSelected = fontFamily === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => selectFont(f.id)}
                    className={`py-2 px-1.5 border-2 rounded-xl text-center text-xs font-bold tracking-wide transition-all truncate cursor-pointer ${isSelected ? 'border-blue-600 bg-blue-50 text-blue-900 font-extrabold shadow-sm' : 'border-slate-105 bg-slate-50 hover:border-slate-900 text-slate-650'}`}
                    style={{ fontStyle: f.id === 'playfair' || f.id === 'courier' ? 'italic' : 'normal' }}
                    title={f.name}
                  >
                    <span style={{ fontFamily: f.font }}>{f.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
              <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">Scale Font:</span>
              <input
                type="range"
                min="18"
                max="48"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-sans">Verify Signer Name Spelling</label>
            <input
              type="text"
              id="typed-signature-input"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Type your full legal name..."
              className="w-full bg-white border-2 border-slate-900 rounded-xl px-4 py-3 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans"
            />
          </div>

          <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 flex flex-col items-center justify-center min-h-[110px] shadow-inner select-none relative overflow-hidden">
            <span className="text-[9px] font-black text-slate-400 absolute left-3 top-3 uppercase tracking-widest font-sans">Verification Seal Stamp Preview:</span>
            
            {typedName.trim() ? (
              <span 
                className="select-none text-center"
                style={{ 
                  fontFamily: (SIGNATURE_FONTS.find(f => f.id === fontFamily) || SIGNATURE_FONTS[0]).font,
                  fontSize: `${fontSize}px`,
                  color: inkColor,
                  fontStyle: fontFamily === 'playfair' || fontFamily === 'courier' ? 'italic' : 'normal'
                }}
              >
                {typedName}
              </span>
            ) : (
              <span className="text-xs text-slate-400 uppercase tracking-wider font-extrabold font-mono">Pre-verified legal visual stamp</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
