import React, { useState } from 'react';
import type { User } from '../types';
import { Video, Mail, Lock, User as UserIcon, ArrowRight, Eye, EyeOff, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
  inviteVideoId?: string | null;
}

export function Auth({ onLogin, inviteVideoId }: AuthProps) {
  const [mode, setMode] = useState<'reviewer' | 'login' | 'signup'>(inviteVideoId ? 'reviewer' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'reviewer') {
      if (!name.trim()) {
        setError('Please enter your name to begin reviewing.');
        return;
      }
      const clientUser: User = {
        id: 'client_' + crypto.randomUUID().slice(0, 8),
        name: name.trim(),
        email: ''
      };
      onLogin(clientUser);
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Please enter your full name');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setIsLoading(true);

    try {
      const endpoint = mode === 'signup' ? '/api/auth/register' : '/api/auth/login';
      const payload = mode === 'signup' 
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onLogin(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setMode('login');
    setEmail('demo@scrubmark.com');
    setPassword('password123');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle ambient gradient backdrop */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-indigo-600/10 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-10 w-[500px] h-[250px] bg-purple-600/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <Video size={22} />
          </div>
          <span className="text-2xl font-black tracking-tight text-white">ScrubMark</span>
        </div>
        <h2 className="text-center text-xl sm:text-2xl font-bold tracking-tight text-neutral-200">
          {mode === 'reviewer' 
            ? 'Join Video Review' 
            : mode === 'login' 
              ? 'Sign in to your workspace' 
              : 'Create your ScrubMark account'}
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-400">
          {mode === 'reviewer'
            ? "You've been invited to review this video project. Enter your name to leave timestamped feedback."
            : "Precise, timestamp-synchronized video review and feedback."}
        </p>

        {/* Tab switchers */}
        <div className="mt-6 flex bg-neutral-900/80 p-1 rounded-xl border border-neutral-800">
          {inviteVideoId && (
            <button
              type="button"
              onClick={() => { setMode('reviewer'); setError(null); }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                mode === 'reviewer'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Review as Client
            </button>
          )}
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Create Account
          </button>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-neutral-900/90 py-8 px-6 shadow-2xl rounded-2xl border border-neutral-800 sm:px-8 backdrop-blur-sm">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-red-400 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'reviewer' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Your Name / Client Title
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <UserIcon size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sarah (Client)"
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-950/70 border border-neutral-700/70 rounded-lg text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  No password needed. Your notes and timestamp comments will be labeled with this name.
                </p>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <UserIcon size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-950/70 border border-neutral-700/70 rounded-lg text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>
            )}

            {mode !== 'reviewer' && (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-neutral-950/70 border border-neutral-700/70 rounded-lg text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                      className="w-full pl-9 pr-10 py-2.5 bg-neutral-950/70 border border-neutral-700/70 rounded-lg text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-950/70 border border-neutral-700/70 rounded-lg text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'reviewer' 
                      ? 'Open Video Review' 
                      : mode === 'login' 
                        ? 'Sign In' 
                        : 'Create Account'}
                  </span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login Option */}
          {mode !== 'reviewer' && (
            <div className="mt-6 pt-6 border-t border-neutral-800/80">
              <button
                type="button"
                onClick={fillDemoAccount}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-neutral-700/60 bg-neutral-800/40 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <Sparkles size={14} className="text-amber-400" />
                <span>Fill 1-Click Demo Account (demo@scrubmark.com)</span>
              </button>
            </div>
          )}
        </div>

        {/* Feature Highlights */}
        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          <div className="p-2.5 rounded-xl bg-neutral-900/40 border border-neutral-800/50">
            <div className="text-indigo-400 font-semibold text-xs mb-1">Time Sync</div>
            <p className="text-[11px] text-neutral-400">Exact millisecond comment triggers</p>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-900/40 border border-neutral-800/50">
            <div className="text-indigo-400 font-semibold text-xs mb-1">Scrub Jump</div>
            <p className="text-[11px] text-neutral-400">Click notes to seek YouTube player</p>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-900/40 border border-neutral-800/50">
            <div className="text-indigo-400 font-semibold text-xs mb-1">Resolve</div>
            <p className="text-[11px] text-neutral-400">Owner-managed task completion</p>
          </div>
        </div>
      </div>
    </div>
  );
}
