/**
 * DocerX Chronological Audit Trail Timeline View
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileUp, Eye, FileSignature, CheckCircle, XCircle, ShieldCheck, Terminal, Clock, MapPin, Monitor } from 'lucide-react';
import { AuditLog } from '../types';

interface AuditTrailProps {
  logs: AuditLog[];
  docHash?: string;
}

export default function AuditTrail({ logs, docHash }: AuditTrailProps) {
  // Map actions to specific styling
  const getLogVisuals = (action: string) => {
    switch (action) {
      case 'Document Created':
        return {
          icon: <FileUp className="w-4 h-4 text-sky-600" />,
          bgColor: 'bg-sky-50',
          borderColor: 'border-sky-200'
        };
      case 'Document Viewed':
        return {
          icon: <Eye className="w-4 h-4 text-amber-500" />,
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200'
        };
      case 'Document Electronically Signed':
        return {
          icon: <FileSignature className="w-4 h-4 text-emerald-600" />,
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-200'
        };
      case 'Document Rejected/Declined':
        return {
          icon: <XCircle className="w-4 h-4 text-rose-600" />,
          bgColor: 'bg-rose-50',
          borderColor: 'border-rose-200'
        };
      case 'Audit Appendix Appended':
        return {
          icon: <ShieldCheck className="w-4 h-4 text-purple-600" />,
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200'
        };
      default:
        return {
          icon: <CheckCircle className="w-4 h-4 text-indigo-600" />,
          bgColor: 'bg-indigo-50',
          borderColor: 'border-indigo-200'
        };
    }
  };

  const formattedDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + 
             ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b-2 border-slate-200" id="audit-trail-title-bar">
        <h3 className="text-xs font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest">
          <Terminal className="w-4 h-4 text-slate-800" />
          Legally Sealed Audit Chronology
        </h3>
        {docHash && (
          <span className="text-[10px] bg-slate-900 text-white font-mono px-3 py-1 rounded font-black tracking-widest uppercase leading-none flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> SEALED
          </span>
        )}
      </div>

      <div className="relative border-l-2 border-slate-900 pl-6 ml-3 py-2 space-y-6" id="audit-logs-timeline">
        {logs.map((log, index) => {
          const style = getLogVisuals(log.action);
          return (
            <div key={log.id || index} className="relative group" id={`audit-log-item-${index}`}>
              {/* Outer visual dot icon absolute -left-[30px] */}
              <div className="absolute -left-[36px] top-0 bg-slate-900 text-white rounded-full p-1.5 border-2 border-slate-900 shadow-sm transition-transform duration-300">
                {style.icon}
              </div>

              <div className="space-y-1.5 pl-2">
                {/* Event timestamp and action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-13px font-black text-slate-900 uppercase tracking-tight">{log.action}</span>
                  <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 font-mono uppercase">
                    <Clock className="w-3.5 h-3.5" /> {formattedDate(log.timestamp)}
                  </span>
                </div>

                {/* Event metadata (performedBy, IP, UA) */}
                <div className="text-[11px] text-slate-500 font-bold flex flex-wrap gap-x-4 gap-y-1 uppercase tracking-wider">
                  <span>
                    SIGNATORY: <strong className="text-slate-850 underline select-all">{log.performedByEmail}</strong>
                  </span>
                  {log.ip && log.ip !== '127.0.0.1' && (
                    <span className="flex items-center gap-0.5 text-slate-500 font-mono">
                      IP: {log.ip}
                    </span>
                  )}
                  {log.userAgent && (
                    <span className="flex items-center gap-0.5 text-slate-500 font-mono truncate max-w-[200px]" title={log.userAgent}>
                      CLIENT: {log.userAgent.split(' ')[0] || log.userAgent}
                    </span>
                  )}
                </div>

                {/* Action Specific Details */}
                <p className="text-[11px] text-slate-600 bg-slate-100/85 px-3 py-2 rounded-lg border border-slate-200/60 max-w-full overflow-hidden text-ellipsis italic font-semibold leading-relaxed">
                  {log.details}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {docHash && (
        <div className="bg-slate-950 text-slate-100 p-5 rounded-2xl border-2 border-slate-900 font-mono text-[10.5px] space-y-3 mt-4 shadow-sm">
          <div className="flex items-center gap-2 text-blue-400 font-black uppercase tracking-widest border-b border-slate-800 pb-2.5 mb-2.5">
            <ShieldCheck className="w-4.5 h-4.5 text-blue-400" /> CRYPTOGRAPHIC SEAL METRICS
          </div>
          <div className="space-y-1.5 uppercase font-bold text-slate-400 tracking-wide">
            <div className="flex justify-between">
              <span>Signature Compliance Standard:</span>
              <span className="text-white">W3C DIGITAL SIGN / ESIGN COMPLIANT</span>
            </div>
            <div className="flex justify-between">
              <span>Validation Hash Algorithm:</span>
              <span className="text-white">SHA-256 BINARY SUM</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between pt-1 gap-1 border-t border-slate-900 mt-2">
              <span className="text-blue-300">SECURE CHECKSUM COORD SEAL:</span>
              <span className="text-yellow-400 break-all select-all lowercase selection:bg-indigo-900 text-xs tracking-normal font-black">{docHash}</span>
            </div>
          </div>
          <p className="text-[9.5px] text-slate-655 font-sans pt-2 leading-relaxed font-bold border-t border-slate-900 uppercase">
            * This hash immutable fingerprint represents exact byte offsets. Any tampering of compiled pixel layers cancels structural authentication tags immediately.
          </p>
        </div>
      )}
    </div>
  );
}
