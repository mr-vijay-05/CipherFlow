import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, DEMO_PROFILES } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { BRAND } from '../constants/brand';
import {
  Shield,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  RefreshCw,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, loginAsDemo, isLoading } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('Email Required', 'Please enter your email address.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      showToast('Welcome Back', `Unlocked encrypted vault for ${email.trim()}.`, 'success');
      navigate('/dashboard');
    } catch (err: any) {
      showToast('Sign In Failed', err?.message || 'Could not authenticate.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await login('dev@cipherflow.com');
      showToast('Passkey Verified', 'Authenticated with passkey.', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      showToast('Passkey Failed', 'Passkey verification was cancelled or failed.', 'error');
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleQuickDemo = async (key: 'alice' | 'bob' | 'carol' | 'dev') => {
    setIsSubmitting(true);
    try {
      await loginAsDemo(key);
      const persona = DEMO_PROFILES[key];
      showToast('Enclave Ready', `Signed in as ${persona.name} (${persona.role}).`, 'success');
      navigate('/dashboard');
    } catch (err: any) {
      showToast('Login Failed', err?.message || 'Could not load demo account.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-between items-center py-12 px-4 selection:bg-slate-900 selection:text-white">
      {/* Top Header Branding */}
      <div className="text-center pt-4 sm:pt-8 select-none">
        <div className="inline-flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">{BRAND.name}</span>
        </div>
        <p className="text-xs text-slate-500 font-medium tracking-tight">
          {BRAND.tagline}
        </p>
      </div>

      {/* Centered Authentication Card */}
      <div className="w-full max-w-[400px] my-auto">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-7 sm:p-8 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)]">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
              Welcome back
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Sign in to access your encrypted notes and vaults.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-subtle"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => showToast('Password Reset', 'In development mode, you can sign in directly or use passkeys.', 'info')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 pr-10 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-subtle font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed group mt-2"
            >
              {isSubmitting || isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-white transition-all" />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2.5 text-slate-400 text-[11px]">or</span>
              </div>
            </div>

            {/* Passkey Button */}
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={passkeyLoading}
              className="w-full py-2 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all shadow-subtle flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {passkeyLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>Verifying passkey...</span>
                </>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4 text-blue-600" />
                  <span>Continue with Passkey</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-medium">
              <span>Quick demo accounts:</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickDemo('alice')}
                className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors border border-slate-100 text-center truncate"
                title="Alice Sterling (Owner)"
              >
                Alice
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('bob')}
                className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors border border-slate-100 text-center truncate"
                title="Bob Chen (Viewer)"
              >
                Bob
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('carol')}
                className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors border border-slate-100 text-center truncate"
                title="Carol Vance (Editor)"
              >
                Carol
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('dev')}
                className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors border border-slate-100 text-center truncate"
                title="Vijay Vignesh (Dev)"
              >
                Dev
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Security Guarantee */}
      <div className="pb-4 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium select-none">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>Protected by client-side encryption</span>
        </div>
      </div>
    </div>
  );
};
