/**
 * DocerX Professional Authentication & Landing Interface
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, Shield, CheckCircle2, ArrowRight } from 'lucide-react';

interface AuthPageProps {
  onAuthSuccess: (token: string, user: any) => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'sender' | 'signer'>('sender');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password || (isSignUp && !name)) {
      setError('Please fill in all mandatory fields');
      setLoading(false);
      return;
    }

    const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';
    const payload = isSignUp ? { name, email, password, role } : { email, password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication challenge failed');
      }

      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Server did not respond to login request');
    } finally {
      setLoading(false);
    }
  };

  // Instant demo-login mode helper
  const startDemoRole = async (selectedRole: 'admin' | 'sender' | 'signer') => {
    setError('');
    setLoading(true);
    
    let demoEmail = '';
    let demoName = '';
    
    if (selectedRole === 'admin') {
      demoEmail = 'admin@docerx.com';
      demoName = 'Alexander Sterling (System Admin)';
    } else if (selectedRole === 'sender') {
      demoEmail = 'initiator@docerx.com';
      demoName = 'Vance Sterling (Sender Coordinator)';
    } else {
      demoEmail = 'signer@docerx.com';
      demoName = 'Dr. Mary Vance (Signer Partner)';
    }

    const demoPayload = {
      email: demoEmail,
      password: 'password123'
    };

    try {
      // Attempt login
      let response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demoPayload)
      });

      let data = await response.json();
      
      // If demo account doesn't exist yet, automatically register it first
      if (!response.ok) {
        const signupResponse = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: demoName,
            email: demoEmail,
            password: 'password123',
            role: selectedRole
          })
        });

        const signupData = await signupResponse.json();
        if (!signupResponse.ok) {
          throw new Error(signupData.error || 'Failed to auto-provision database instance');
        }
        
        onAuthSuccess(signupData.token, signupData.user);
        return;
      }

      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setError('Provisioning failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-slate-100 font-sans" id="auth-container">
      {/* Visual Brandy Panel */}
      <div className="flex-1 flex flex-col justify-between p-8 md:p-16 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 relative overflow-hidden">
        {/* Subtle decorative vector mesh effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-slate-800/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10">
          <div className="mb-2">
            <span className="text-3xl font-black tracking-tighter text-white uppercase">
              DOCER<span className="text-blue-500 font-black">X</span>
            </span>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">Enterprise Edition</p>
          </div>
        </div>

        <div className="my-auto py-12 space-y-6 relative z-10 max-w-lg">
          <span className="text-xs font-black text-blue-400 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 uppercase tracking-widest leading-none select-none">
            Digital Signature SaaS
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none text-white uppercase">
            Legally sealed electronic signatures.
          </h1>
          <p className="text-sm text-slate-400 font-medium leading-relaxed">
            Eliminate friction, secure document integrity, and streamline multi-party authorizations with a professional digital signing system conforming to ESIGN act compliance.
          </p>

          <div className="space-y-3 pt-6 border-t border-slate-800">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="font-bold uppercase text-xs tracking-wider">Full cryptographic SHA-256 binary validation</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="font-bold uppercase text-xs tracking-wider">Durable file audits with IP geolocation & UA details</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="font-bold uppercase text-xs tracking-wider">Embed signature overlays instantly onto standard PDFs</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-mono font-bold flex items-center justify-between mt-auto">
          <span>Verifiable Compliance standard</span>
          <span>© 2026 DOCERX INC.</span>
        </div>
      </div>

      {/* Actual Form Panel */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20 bg-slate-950">
        <div className="mx-auto w-full max-w-md space-y-8" id="auth-form-card">
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-white tracking-tight uppercase leading-none">
              {isSignUp ? 'Establish Initiator Account' : 'Secure Console Sign-In'}
            </h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isSignUp ? 'Already registered?' : 'Ready to streamline signature workflows?'}{' '}
              <button
                type="button"
                id="toggle-auth-state-btn"
                onClick={() => {
                  setError('');
                  setIsSignUp(!isSignUp);
                }}
                className="text-blue-400 hover:text-blue-300 font-black underline underline-offset-4 decoration-blue-500 cursor-pointer transition-colors"
              >
                {isSignUp ? 'Login to console' : 'Register an account'}
              </button>
            </p>
          </div>

          {error && (
            <div className="bg-rose-950/40 border-2 border-rose-900 text-rose-300 p-4 rounded-xl text-xs font-bold uppercase tracking-wider" id="auth-error-banner">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block font-sans">Full Legal Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    id="auth-name-field"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g., Dr. Peter Vance"
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-slate-900 transition font-medium"
                  />
                </div>
              </div>
            )}

            {isSignUp && (
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block font-sans">Assign Account Role (RBAC)</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['sender', 'signer', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-2 px-1 text-[9.5px] font-black uppercase rounded-lg border cursor-pointer select-none transition ${role === r ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-white'}`}
                    >
                      {r === 'sender' ? '⚡ Sender' : r === 'signer' ? '🖋️ Signer' : '👑 Admin'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/50">
                  {role === 'admin' && '👑 Admin: Unlimited file access, deletion permissions, and full access to user analytics directories.'}
                  {role === 'sender' && '⚡ Sender: Upload custom PDFs, initiate NDAs, delete files, and manage signing request links.'}
                  {role === 'signer' && '🖋️ Signer: Restricted view. Can only view and sign envelopes assigned to their email address.'}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block font-sans">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  id="auth-email-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-slate-900 transition font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block font-sans">Password Secure Key</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  id="auth-password-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-slate-900 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              id="auth-submit-btn"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-4 rounded-lg text-xs uppercase tracking-widest transition focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Authenticating Keys...' : isSignUp ? 'Generate Credentials' : 'Secure Console Sign-In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Sandbox Demo Helper Area */}
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase font-black">
              <span className="bg-slate-950 px-3 text-slate-500 font-bold tracking-widest">Evaluation Shortcut</span>
            </div>
          </div>

          <div className="bg-white border-2 border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm select-none">
            <div className="flex flex-col gap-1">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Evaluate Role Permissions (RBAC)</h4>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider leading-relaxed">
                Choose a role below to instantly log in. Try opening two diff tabs to see the interactive WebSocket alerts trigger live!
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-2" id="trial-shortcut-grid">
              <button
                type="button"
                onClick={() => startDemoRole('admin')}
                disabled={loading}
                className="py-3 bg-slate-950 hover:bg-slate-905 border border-slate-900 text-white font-black text-[9.5px] uppercase tracking-wider rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center gap-1 shadow-xs"
              >
                <span>👑</span>
                <span>System Admin</span>
              </button>
              
              <button
                type="button"
                onClick={() => startDemoRole('sender')}
                disabled={loading}
                className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-[9.5px] uppercase tracking-wider rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center gap-1 shadow-xs"
              >
                <span>⚡</span>
                <span>Sender Owner</span>
              </button>

              <button
                type="button"
                onClick={() => startDemoRole('signer')}
                disabled={loading}
                className="py-3 bg-slate-100 hover:bg-slate-205 border border-slate-200 text-slate-800 font-black text-[9.5px] uppercase tracking-wider rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center gap-1 shadow-xs"
              >
                <span>🖋️</span>
                <span>Guest Signer</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
