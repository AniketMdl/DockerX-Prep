/**
 * DocerX Corporate Dashboard Management Console
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, Shield, FileText, CheckCircle2, AlertCircle, Share2, 
  Download, LogOut, Copy, Check, Filter, Trash2, Calendar, Mail, FileCheck2, UserCheck
} from 'lucide-react';
import { Document, DashboardStats } from '../types';
import DocumentModal from './DocumentModal';
import AuditTrail from './AuditTrail';
import DocumentEditor from './DocumentEditor';

interface DashboardProps {
  user: any;
  token: string | null;
  onLogout: () => void;
}

export default function Dashboard({ user, token, onLogout }: DashboardProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'signed' | 'rejected' | 'editor'>('all');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editorPrefill, setEditorPrefill] = useState<{ fileData: string; title: string; fileName: string } | null>(null);

  // WebSocket notifications matching push events
  const [wsNotifications, setWsNotifications] = useState<{ id: string; message: string; timestamp: string }[]>([]);

  // RBAC states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitleVal, setNewTitleVal] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);

  // Fetch documents from fullstack Express backend
  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/documents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync with document engine');
      }
      setDocuments(data);
      // Auto select first document if none is active or refresh selected
      if (data.length > 0) {
        if (selectedDoc) {
          const updatedSelected = data.find((d: Document) => d.id === selectedDoc.id);
          setSelectedDoc(updatedSelected || data[0]);
        } else {
          setSelectedDoc(data[0]);
        }
      } else {
        setSelectedDoc(null);
      }
    } catch (err: any) {
      setError(err.message || 'Server connection timeout error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [token]);

  // Real-time WebSocket connection
  useEffect(() => {
    if (!token || !user) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: any = null;

    const establishSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log('[WebSocket] Connected');
          socket?.send(JSON.stringify({
            type: 'register',
            userId: user.id || user.email,
            email: user.email
          }));
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[WebSocket] Alert received:', data);
            
            const item = {
              id: 'notif_' + Math.random().toString(36).substring(2, 9),
              message: data.message,
              timestamp: new Date().toLocaleTimeString()
            };
            setWsNotifications(prev => [item, ...prev].slice(0, 5));
            
            // Instantly refresh the list of documents
            fetchDocuments();
          } catch (e) {
            console.warn('[WebSocket] parse deviation client-side');
          }
        };

        socket.onclose = () => {
          console.log('[WebSocket] Closed, scheduled reconnecting in 5s...');
          reconnectTimer = setTimeout(establishSocket, 5000);
        };
      } catch (err) {
        console.warn('Socket allocation fault:', err);
      }
    };

    establishSocket();

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [token, user]);

  // System administration user query load
  useEffect(() => {
    if (token && user?.role === 'admin') {
      fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(r => r.ok ? r.json() : [])
      .then(setSystemUsers)
      .catch(() => {});
    }
  }, [token, user]);

  // Perform rename patch
  const handleRename = async () => {
    if (!newTitleVal.trim() || !selectedDoc) return;
    try {
      const response = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitleVal.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to rename document');
      }
      setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, title: data.title || newTitleVal.trim() } : d));
      setSelectedDoc(prev => prev && prev.id === selectedDoc.id ? { ...prev, title: data.title || newTitleVal.trim() } : prev);
      setIsEditingTitle(false);
    } catch (err: any) {
      alert('Rename Document Error: ' + err.message);
    }
  };

  // Perform document delete (admin & sender restricted)
  const handleDelete = async () => {
    if (!selectedDoc) return;
    try {
      const response = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Deletion failed');
      }
      setIsConfirmingDelete(false);
      setSelectedDoc(null);
      fetchDocuments();
    } catch (err: any) {
      alert('Delete Document Error: ' + err.message);
    }
  };

  // Compute stats on-the-fly
  const stats: DashboardStats = {
    total: documents.length,
    signed: documents.filter(d => d.status === 'signed').length,
    pending: documents.filter(d => d.status === 'pending').length,
    rejected: documents.filter(d => d.status === 'rejected').length
  };

  // Filter documents list with both tab and search strings
  const filteredDocs = documents.filter(doc => {
    const matchesTab = filter === 'all' || doc.status === filter;
    const matchesSearch = !searchTerm.trim() || 
      (doc.title && doc.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.fileName && doc.fileName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.request?.signerEmail && doc.request.signerEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.request?.signerName && doc.request.signerName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesTab && matchesSearch;
  });

  // Action: Copy Signing Share Link to user Clipboard
  const copySigningLink = (sharingToken: string) => {
    const origin = window.location.origin;
    const url = `${origin}/sign/${sharingToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(sharingToken);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  // Client Side local PDF base64 binary download stream integration
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'signed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm leading-none">
            <CheckCircle2 className="w-3.5 h-3.5" /> Signed & Sealed
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-100 shadow-sm leading-none">
            <AlertCircle className="w-3.5 h-3.5" /> Declined
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-100 shadow-sm leading-none animate-pulse">
            <FileText className="w-3.5 h-3.5" /> Awaiting Signature
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans" id="dashboard-viewport">
      {/* Left Navigation Bar Desktop */}
      <nav className="w-full md:w-64 bg-slate-900 flex flex-col p-6 shrink-0 md:sticky md:top-0 md:h-screen text-slate-100 border-b md:border-b-0 md:border-r border-slate-800">
        <div className="mb-10 flex md:flex-col justify-between items-center md:items-start">
          <div>
            <span className="text-3xl font-black tracking-tighter text-white uppercase block">
              DOCER<span className="text-blue-500 font-black">X</span>
            </span>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">Enterprise Edition</p>
          </div>
          <div className="md:hidden flex items-center">
            <button
              type="button"
              id="logout-btn-mobile"
              onClick={onLogout}
              className="text-[10px] bg-slate-800 text-rose-400 hover:bg-slate-700 px-3 py-1.5 rounded-lg font-black uppercase tracking-widest transition"
            >
              Logout
            </button>
          </div>
        </div>
        
        {/* Navigation states representing DocerX layout filters */}
        <ul className="space-y-6 flex flex-row md:flex-col flex-wrap md:flex-nowrap gap-x-4 md:gap-x-0 gap-y-2 md:gap-y-6 border-t md:border-t-0 border-slate-800 pt-4 md:pt-0">
          <li className="group cursor-pointer flex-shrink-0" onClick={() => setFilter('all')}>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Overview</span>
            <div className={`font-black text-sm uppercase transition-colors ${filter === 'all' ? 'text-blue-400 underline underline-offset-4 decoration-blue-500' : 'text-slate-400 group-hover:text-white'}`}>
              Dashboard
            </div>
          </li>
          <li className="group cursor-pointer flex-shrink-0" onClick={() => setFilter('pending')}>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Signature</span>
            <div className={`font-black text-sm uppercase transition-colors ${filter === 'pending' ? 'text-blue-400 underline underline-offset-4 decoration-blue-500 animate-pulse' : 'text-slate-400 group-hover:text-white'}`}>
              My Pending
            </div>
          </li>
          <li className="group cursor-pointer flex-shrink-0" onClick={() => setFilter('signed')}>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Verification</span>
            <div className={`font-black text-sm uppercase transition-colors ${filter === 'signed' ? 'text-blue-400 underline underline-offset-4 decoration-blue-500' : 'text-slate-400 group-hover:text-white'}`}>
              Sealed Files
            </div>
          </li>
          <li className="group cursor-pointer flex-shrink-0" onClick={() => setFilter('rejected')}>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Declines</span>
            <div className={`font-black text-sm uppercase transition-colors ${filter === 'rejected' ? 'text-blue-400 underline underline-offset-4 decoration-blue-500' : 'text-slate-400 group-hover:text-white'}`}>
              Rejected List
            </div>
          </li>
          <li className="group cursor-pointer flex-shrink-0" onClick={() => { setFilter('editor'); setSelectedDoc(null); }}>
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-0.5">Free Creational Tool</span>
            <div className={`font-black text-sm uppercase transition-colors ${filter === 'editor' ? 'text-blue-400 underline underline-offset-4 decoration-blue-500' : 'text-slate-400 group-hover:text-white'}`}>
              📝 Document Editor
            </div>
          </li>
          {user?.role === 'admin' && (
            <li className="group cursor-pointer flex-shrink-0" onClick={() => setFilter('users' as any)}>
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-0.5">Administration</span>
              <div className={`font-black text-sm uppercase transition-colors ${filter === ('users' as any) ? 'text-amber-400 underline underline-offset-4 decoration-amber-500' : 'text-slate-400 group-hover:text-white'}`}>
                👑 User Registry
              </div>
            </li>
          )}
        </ul>

        {/* Sidebar Footer Account Usage Card */}
        <div className="mt-auto hidden md:flex flex-col space-y-6">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
            <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-2">Account Usage ({user?.role || 'signer'})</div>
            <div className="w-full h-1.5 bg-slate-700 rounded-full mb-2">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(15, (stats.total / 15) * 100))}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-white font-black uppercase tracking-wider">
              <span>{stats.total}/15 PDFs</span>
              <span className="text-blue-400">Sandbox Key</span>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 flex flex-col">
            <span className="text-xs font-black text-slate-300 uppercase tracking-wide truncate">{user?.name} ({(user?.role || 'signer').toUpperCase()})</span>
            <span className="text-[10px] text-slate-500 font-mono truncate mb-3">{user?.email}</span>
            
            <button
              type="button"
              id="logout-btn"
              onClick={onLogout}
              className="w-full py-2.5 bg-white border-2 border-slate-800 text-slate-900 font-black text-[10px] uppercase tracking-widest hover:bg-slate-850 hover:text-white transition-all text-center rounded-lg cursor-pointer"
            >
              Secure Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Workflow Area */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Main Content Header matching Design HTML exactly */}
        <header className="h-24 border-b border-slate-200 bg-white px-6 md:px-10 flex flex-col sm:flex-row gap-2 sm:gap-0 items-center justify-between shrink-0">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-none uppercase">
            {filter === 'all' ? 'Documents' : filter === ('users' as any) ? 'System Users' : filter === 'editor' ? 'Document Editor' : filter}
          </h1>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search secure files..." 
                className="bg-slate-100 border-none rounded-lg px-4 py-2.5 text-xs w-full sm:w-64 focus:ring-2 focus:ring-blue-500 focus:bg-white font-bold text-slate-800 placeholder-slate-400 tracking-wide outline-none"
              />
            </div>
            {user?.role !== 'signer' ? (
              <button 
                type="button"
                id="initiate-request-btn"
                onClick={() => setShowModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-black text-xs tracking-wider shadow-lg shadow-blue-200 flex items-center gap-1.5 uppercase transition-all shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white stroke-[3px]" />
                <span>New Document</span>
              </button>
            ) : (
              <div className="bg-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg border border-slate-200 select-none">
                🔒 Signer Secure Mode
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Workflow Workspace content container */}
        <div className="flex-1 p-6 md:p-10 space-y-10 overflow-y-auto">
          
          {/* Real-time WebSocket Feed Alerts */}
          {wsNotifications.length > 0 && (
            <div className="space-y-3 p-4 bg-slate-900 border-2 border-slate-950 text-white rounded-2xl shadow-xl" id="dashboard-notif-box">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span className="text-[9px] font-black uppercase text-blue-400 tracking-widest font-sans">Live Secure Sync Stream</span>
                </div>
                <button
                  onClick={() => setWsNotifications([])}
                  className="text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-wider cursor-pointer"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-2">
                {wsNotifications.map(n => (
                  <div key={n.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase tracking-wide leading-relaxed text-slate-200">{n.message}</p>
                      <span className="text-[9px] font-mono text-slate-505 font-extrabold">{n.timestamp}</span>
                    </div>
                    <button
                      onClick={() => setWsNotifications(prev => prev.filter(x => x.id !== n.id))}
                      className="text-[9px] font-sans text-rose-455 font-black uppercase tracking-widest hover:text-rose-400 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filter === ('users' as any) ? (
            <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 md:p-8 space-y-6 shadow-md" id="admin-user-registry-board">
              <div className="border-b border-slate-200 pb-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">User Identity Registry</h2>
                    <p className="text-xs text-slate-505 mt-1 font-semibold">Audit credentials, metadata, and role permissions for all users in DocerX:</p>
                  </div>
                  <span className="bg-amber-100 text-amber-850 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-amber-200">
                    👑 Administration Mode
                  </span>
                </div>
              </div>

              {systemUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-mono text-xs font-black uppercase">
                  Retrieving active seal keys...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-900 text-[10px] text-slate-450 uppercase font-black tracking-widest">
                        <th className="pb-3 pr-2">Assignee/Name</th>
                        <th className="pb-3 pr-2">Email Address</th>
                        <th className="pb-3 pr-2">Clearance Role</th>
                        <th className="pb-3 pr-2 font-mono">UID HASH</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {systemUsers.map((u: any) => (
                        <tr key={u.id} className="hover:bg-slate-50/50">
                          <td className="py-4 pr-2 font-black uppercase text-slate-900">{u.name}</td>
                          <td className="py-4 pr-2 font-mono text-slate-600 font-bold">{u.email}</td>
                          <td className="py-4 pr-2">
                            <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase rounded-md border ${
                              u.role === 'admin' ? 'bg-amber-100 text-amber-800 border-amber-200 shadow-sm' :
                              u.role === 'sender' ? 'bg-blue-100 text-blue-800 border-blue-200 shadow-sm' :
                              'bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
                            }`}>
                              {u.role || 'signer'}
                            </span>
                          </td>
                          <td className="py-4 pr-2 font-mono text-[10px] text-slate-400 font-bold">{u.id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : filter === 'editor' ? (
            <DocumentEditor
              token={token}
              onInitiateSignFlow={(fileData, title, fileName) => {
                setEditorPrefill({ fileData, title, fileName });
                setShowModal(true);
              }}
            />
          ) : (
            <>
              {/* Stats Overview Grid - 4 Columns */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6" id="stats-ribbon">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition hover:shadow-md">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Total Managed</div>
                  <div className="text-4xl md:text-5xl font-black text-slate-900">{stats.total}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition hover:shadow-md">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Sealed & Signed</div>
                  <div className="text-4xl md:text-5xl font-black text-emerald-600">{stats.signed}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition hover:shadow-md">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Awaiting Stamp</div>
                  <div className="text-4xl md:text-5xl font-black text-amber-500 animate-pulse">{stats.pending}</div>
                </div>
                <div className="bg-blue-600 p-6 rounded-2xl shadow-xl shadow-blue-200 text-white transition hover:scale-[1.01] duration-300">
                  <div className="text-[10px] font-black text-blue-100 uppercase tracking-wider mb-2">Success Velocity</div>
                  <div className="text-4xl md:text-5xl font-black">
                    {stats.total > 0 ? `${Math.round((stats.signed / stats.total) * 100)}%` : '100%'}
                  </div>
                </div>
              </div>

              {/* Table List-ish Grid Column Layout */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start min-h-[500px]">
            
            {/* Left side documents catalog table/list */}
            <div className="xl:col-span-5 flex flex-col space-y-4">
              <div className="flex justify-between items-center pb-2 border-b-2 border-slate-200">
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest block">
                  File Registry ({filteredDocs.length})
                </span>
                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded font-mono font-bold uppercase text-slate-600 shrink-0">
                  Filters Active
                </span>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center bg-white border border-slate-250 rounded-2xl p-16 min-h-[320px] shadow-xs">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  <span className="text-xs text-slate-600 font-bold uppercase tracking-wider mt-4">Synchronizing seal registers...</span>
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center bg-white border border-slate-200 rounded-3xl p-10 min-h-[320px] text-center space-y-4 shadow-sm">
                  <div className="bg-slate-100 p-4 rounded-full">
                    <FileText className="w-8 h-8 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">No matched documents found</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto leading-relaxed font-semibold">Ready to test? Create a signature request or pre-populate NDA Templates instantly.</p>
                  </div>
                  <button
                    type="button"
                    id="empty-action-create-btn"
                    onClick={() => setShowModal(true)}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-black border border-blue-100 text-[10px] uppercase tracking-wider py-2.5 px-5 rounded-lg cursor-pointer transition select-none"
                  >
                    Instant NDA Template Initiation
                  </button>
                </div>
              ) : (
                <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1" id="document-queries-list">
                  {filteredDocs.map((doc) => {
                    const isSelected = selectedDoc?.id === doc.id;
                    return (
                      <div
                        key={doc.id}
                        id={`doc-card-item-${doc.id}`}
                        onClick={() => setSelectedDoc(doc)}
                        className={`p-5 bg-white border-2 rounded-2xl cursor-pointer hover:border-slate-800 transition relative ${isSelected ? 'border-blue-600 ring-2 ring-blue-50 bg-blue-50/10' : 'border-slate-200 hover:shadow shadow-xs'}`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <h4 className="font-bold text-slate-800 text-xs md:text-sm leading-snug line-clamp-1 uppercase tracking-tight">{doc.title}</h4>
                            <p className="text-[10px] text-slate-500 font-mono" title={`File: ${doc.fileName}`}>
                              FILE: <span className="underline decoration-slate-300 font-semibold">{doc.fileName}</span>
                            </p>
                          </div>
                          
                          {doc.status === 'signed' ? (
                            <span className="px-2.5 py-0.5 bg-green-100 text-green-850 text-[9px] font-black uppercase rounded-full">Sealed</span>
                          ) : doc.status === 'rejected' ? (
                            <span className="px-2.5 py-0.5 bg-rose-100 text-rose-850 text-[9px] font-black uppercase rounded-full">Rejected</span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-850 text-[9px] font-black uppercase rounded-full animate-pulse">Pending</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold pt-4 mt-4 border-t border-slate-100 uppercase tracking-wider">
                          <span className="truncate max-w-[150px]">To: {doc.request.signerName}</span>
                          <span className="font-mono text-[9px] font-bold text-slate-500">{doc.fileSize}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right side detailed document inspector card */}
            <div className="xl:col-span-7">
              {selectedDoc ? (
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 md:p-8 space-y-6" id="document-inspection-panel">
                  
                  {/* Meta details header info */}
                  <div className="border-b border-slate-200 pb-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="font-black">
                        {selectedDoc.status === 'signed' ? (
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase">SIGNED & SECURED</span>
                        ) : selectedDoc.status === 'rejected' ? (
                          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase">DECLINED</span>
                        ) : (
                          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase animate-pulse">AWAITING WRITTEN CONSENT</span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest">
                        CREATED: {new Date(selectedDoc.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {isEditingTitle ? (
                      <div className="flex gap-2 items-center w-full" id="inline-rename-wrapper">
                        <input
                          type="text"
                          value={newTitleVal}
                          onChange={(e) => setNewTitleVal(e.target.value)}
                          className="flex-1 bg-slate-50 border-2 border-slate-900 rounded-lg px-3 py-1.5 text-xs font-bold uppercase"
                        />
                        <button
                          onClick={handleRename}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setIsEditingTitle(false)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start gap-4">
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight uppercase select-all tracking-tight pr-4">
                          {selectedDoc.title}
                        </h2>
                        {user?.role !== 'signer' && (
                          <button
                            onClick={() => {
                              setIsEditingTitle(true);
                              setNewTitleVal(selectedDoc.title);
                            }}
                            className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded border border-blue-100 flex-shrink-0 cursor-pointer"
                          >
                            ✏️ Rename
                          </button>
                        )}
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider pt-1">
                      <span>FILE: <strong className="text-slate-900 underline underline-offset-4 decoration-blue-500">{selectedDoc.fileName}</strong></span>
                      <span>SIZE: <strong className="text-slate-900 font-mono">{selectedDoc.fileSize}</strong></span>
                      <span>BY: <strong className="text-slate-900">{selectedDoc.uploadedByEmail}</strong></span>
                    </div>
                  </div>

                  {/* Secure public sharing widget layout */}
                  <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 space-y-3.5 shadow-sm select-none">
                    <div className="flex justify-between items-center gap-2">
                      <div>
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Secure Public Signing Redirect Link</h4>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium leading-normal">
                          Share this tokenized private credentials link directly with the designated signatory party:
                        </p>
                      </div>
                      {selectedDoc.status === 'pending' && (
                        <span className="text-[9px] bg-blue-600 text-white font-black px-2.5 py-0.5 rounded leading-none shrink-0 tracking-wider">ACTIVE LINK</span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/sign/${selectedDoc.request.token}`}
                        id="viewable-signing-url"
                        className="flex-1 bg-slate-100 border border-slate-205 text-slate-800 font-mono text-[10.5px] px-3.5 py-2.5 rounded-lg focus:outline-none select-all cursor-text overflow-x-auto"
                      />

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          id="copy-link-btn"
                          onClick={() => copySigningLink(selectedDoc.request.token)}
                          className={`px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border-2 cursor-pointer select-none shrink-0 ${copiedToken === selectedDoc.request.token ? 'bg-green-100 text-green-800 border-green-500' : 'bg-slate-900 hover:bg-slate-950 text-white border-slate-900 shadow-xs'}`}
                        >
                          {copiedToken === selectedDoc.request.token ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-700 stroke-[3px]" /> Checked
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-white" /> Copy Link
                            </>
                          )}
                        </button>

                        <a
                          href={`/sign/${selectedDoc.request.token}`}
                          target="_blank"
                          rel="noreferrer"
                          id="open-signing-link-btn"
                          className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 font-black rounded-lg text-xs transition flex items-center justify-center shadow-xs select-none uppercase tracking-wider"
                          title="Open Public Signing Portal in separate screen"
                        >
                          <Share2 className="w-3.5 h-3.5 text-slate-900" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Recipient status metrics details card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-slate-200 p-5 rounded-2xl bg-slate-100/30">
                    <div className="space-y-1">
                      <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Signatory Assignee Details</p>
                      <h5 className="text-sm font-black text-slate-900 tracking-tight">{selectedDoc.request.signerName}</h5>
                      <p className="text-xs text-slate-400 font-mono">{selectedDoc.request.signerEmail}</p>
                    </div>

                    <div className="space-y-1 md:border-l md:border-slate-200 md:pl-5">
                      <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Visual Anchor Coordinates</p>
                      <div className="text-xs text-slate-700 font-semibold space-y-0.5">
                        <p>Page Sector: <span className="text-blue-600 font-bold font-mono">Page {selectedDoc.request.coords.page}</span></p>
                        <p>Offsets: <span className="font-mono text-blue-600 font-bold">(X: {selectedDoc.request.coords.x}%, Y: {selectedDoc.request.coords.y}%)</span></p>
                      </div>
                    </div>
                  </div>

                  {/* File actions triggers */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-150">
                    <button
                      type="button"
                      onClick={() => handlePdfDownload(selectedDoc.fileData, selectedDoc.title, false)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 text-xs font-black uppercase tracking-wider rounded-lg cursor-pointer transition shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-900" /> Original PDF
                    </button>

                    {selectedDoc.status === 'signed' && selectedDoc.signedFileData ? (
                      <button
                        type="button"
                        id="download-signed-pdf-btn"
                        onClick={() => handlePdfDownload(selectedDoc.signedFileData!, selectedDoc.title, true)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest rounded-lg cursor-pointer transition shadow-lg shadow-blue-200"
                      >
                        <Download className="w-3.5 h-3.5 text-white" /> Sealed Copy PDF
                      </button>
                    ) : (
                      <div className="flex-1 bg-slate-105 text-slate-400 flex items-center justify-center border border-slate-200 rounded-lg text-xs font-black font-mono uppercase tracking-widest py-3">
                        Awaiting Signature Stamp
                      </div>
                    )}
                  </div>

                  {/* Danger Zone */}
                  {user?.role !== 'signer' && (
                    <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4" id="document-danger-zone">
                      <div>
                        <h4 className="text-[11px] font-black text-rose-955 uppercase tracking-widest">Cryptographic purging actions</h4>
                        <p className="text-[10px] text-rose-700 mt-0.5 font-bold uppercase leading-normal">
                          This operation permanently destroys all digital seal credentials from DocerX servers:
                        </p>
                      </div>
                      
                      {isConfirmingDelete ? (
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleDelete}
                            className="bg-rose-700 hover:bg-rose-800 text-white text-[10px] font-black uppercase px-3 py-2 rounded-lg cursor-pointer"
                          >
                            CONFIRM DELETE
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsConfirmingDelete(false)}
                            className="bg-white text-slate-800 border border-slate-300 text-[10px] font-black uppercase px-3 py-2 rounded-lg cursor-pointer"
                          >
                            CANCEL
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsConfirmingDelete(true)}
                          className="bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300 text-[10px] font-black uppercase px-4 py-2.5 rounded-lg cursor-pointer transition select-none shrink-0 font-mono"
                        >
                          🗑️ Discard Seal Request
                        </button>
                      )}
                    </div>
                  )}

                  {/* Audit trail append timeline */}
                  <div className="pt-6 border-t border-slate-100">
                    <AuditTrail logs={selectedDoc.auditLogs} docHash={selectedDoc.docHash} />
                  </div>

                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-white border border-slate-200 rounded-3xl p-16 text-center select-none shadow-sm min-h-[480px]">
                  <Shield className="w-16 h-16 text-slate-200 mb-4 animate-bounce" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Audit Trail Portal Panel</h3>
                  <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed font-semibold">Select any active document record from the left registry side to review its signer details, copy the tokenized link, and seal cryptographic checking hashes.</p>
                </div>
              )}
            </div>

          </div>
          </>
        )}

        </div>

      </main>

      {/* Initiation Modal */}
      {showModal && (
        <DocumentModal
          onClose={() => {
            setShowModal(false);
            setEditorPrefill(null);
          }}
          onCreated={(newDoc) => {
            fetchDocuments();
            setSelectedDoc(newDoc);
            setFilter('all');
            setEditorPrefill(null);
          }}
          token={token}
          initialFileData={editorPrefill?.fileData}
          initialTitle={editorPrefill?.title}
          initialFileName={editorPrefill?.fileName}
        />
      )}
    </div>
  );
}
