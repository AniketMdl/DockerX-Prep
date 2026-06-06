/**
 * DocerX Client Main Router & State Coordinator
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import SigningPortal from './components/SigningPortal';
import { ShieldCheck } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Custom router state
  const [path, setPath] = useState(window.location.pathname);

  // Monitor location path routing changes (supporting direct/back links)
  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    // Periodically poll path in standard sandboxes if needed
    const interval = setInterval(() => {
      if (window.location.pathname !== path) {
        setPath(window.location.pathname);
      }
    }, 400);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      clearInterval(interval);
    };
  }, [path]);

  // Authenticate session on boot from localStorage
  useEffect(() => {
    const bootstrapSession = async () => {
      const storedToken = localStorage.getItem('docerx_token');
      const storedUser = localStorage.getItem('docerx_user');

      if (storedToken && storedUser) {
        try {
          // Verify token against live server session
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            setToken(storedToken);
          } else {
            // Token expired or server was restarted
            localStorage.removeItem('docerx_token');
            localStorage.removeItem('docerx_user');
          }
        } catch {
          // Server offline or network timeout, stick to local copy silently or ask to re-login
          console.warn('[DocerX Router] Could not reach auth server, using cached session.');
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      }
      setCheckingAuth(false);
    };

    bootstrapSession();
  }, []);

  const handleAuthSuccess = (newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('docerx_token', newToken);
    localStorage.setItem('docerx_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('docerx_token');
    localStorage.removeItem('docerx_user');
  };

  // Route: Public Signing Portal `/sign/:token` matching pattern
  const isSignRoute = path.startsWith('/sign/');
  
  if (isSignRoute) {
    // Extract token part: e.g. /sign/sign_tok_12345
    const tokenSlug = path.substring(6); // index after "/sign/"
    return <SigningPortal tokenSlug={tokenSlug} />;
  }

  // Session checking guard loader
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 select-none">
        <div className="bg-indigo-600 p-2.5 rounded-xl mb-4 shadow-lg shadow-indigo-600/25">
          <ShieldCheck className="w-7 h-7 text-white animate-pulse" />
        </div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
        <span className="text-xs text-slate-400 mt-4 uppercase tracking-wider font-bold">Locking console session...</span>
      </div>
    );
  }

  // Dashboard context routing
  if (token && user) {
    return (
      <Dashboard 
        user={user} 
        token={token} 
        onLogout={handleLogout} 
      />
    );
  }

  // Unauthenticated landing auth page
  return <AuthPage onAuthSuccess={handleAuthSuccess} />;
}
