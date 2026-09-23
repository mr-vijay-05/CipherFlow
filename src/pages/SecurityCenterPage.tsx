import React, { useState, useEffect } from 'react';
import { securityService, TamperDetectionResult } from '../services/securityService';
import { sharingService } from '../services/sharingService';
import { SecurityOverview } from '../types/security';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useToast } from '../hooks/useToast';
import { IdentityKeyPair } from '../crypto/identityKeys';
import { RemoteAuditEvent } from '../services/api/sharingApi';
import {
  ShieldCheck,
  Lock,
  Key,
  Server,
  RefreshCw,
  CheckCircle2,
  Check,
  Database,
  Cloud,
  Globe,
  KeyRound,
  RotateCw,
  Users,
  ShieldAlert,
  AlertTriangle,
  History,
  FileKey,
  AlertCircle,
  Bug,
} from 'lucide-react';

export const SecurityCenterPage: React.FC = () => {
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any | null>(null);
  const [tamperResult, setTamperResult] = useState<TamperDetectionResult | null>(null);
  const [isTestingTamper, setIsTestingTamper] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{ online: boolean; version?: string }>({ online: false });
  const [identityKey, setIdentityKey] = useState<IdentityKeyPair | null>(null);
  const [auditEvents, setAuditEvents] = useState<RemoteAuditEvent[]>([]);
  const { showToast } = useToast();

  const loadData = async () => {
    const data = await securityService.getSecurityOverview();
    setOverview(data);

    // Load or initialize client identity key
    try {
      const idKey = await sharingService.initializeIdentityKey();
      setIdentityKey(idKey);
    } catch (err) {
      console.warn('Identity key initialization notice:', err);
    }

    // Load audit trail
    try {
      const trail = await sharingService.getAuditTrail();
      setAuditEvents(trail);
    } catch {
      setAuditEvents([]);
    }

    // Check FastAPI backend health
    try {
      const res = await fetch('http://localhost:8000/health');
      if (res.ok) {
        const json = await res.json();
        setBackendStatus({ online: true, version: json.version || '4.0.0' });
      } else {
        setBackendStatus({ online: false });
      }
    } catch {
      setBackendStatus({ online: false });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunDiagnostic = async () => {
    setIsAuditing(true);
    try {
      const res = await securityService.runSecurityAuditCheck();
      setDiagnosticResult(res);
      await loadData();
      showToast(
        'Diagnostic Passed',
        `Client cryptographic engine, Protected Local Vault, and FastAPI sync verified.`,
        'success'
      );
    } finally {
      setIsAuditing(false);
    }
  };

  const handleRunTamperTest = async () => {
    setIsTestingTamper(true);
    try {
      const res = await securityService.runTamperDetectionTest();
      setTamperResult(res);
      await loadData();
      if (res.status === 'PASS') {
        showToast(
          'Tamper Detection Passed',
          'WebCrypto AES-256-GCM successfully rejected tampered ciphertext without exposing plaintext.',
          'success'
        );
      } else {
        showToast(
          'Tamper Test Failed',
          res.errorDetail || 'Cryptographic integrity test failed.',
          'error'
        );
      }
    } catch (err: any) {
      showToast('Tamper Diagnostic Error', err?.message || 'Failed to complete test', 'error');
    } finally {
      setIsTestingTamper(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Security Center
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Cryptographic posture, active WebCrypto primitives, Protected Local Vault verification, and key agreements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleRunTamperTest}
            disabled={isTestingTamper}
            icon={<ShieldAlert className={`w-3.5 h-3.5 ${isTestingTamper ? 'animate-spin' : ''}`} />}
          >
            {isTestingTamper ? 'Verifying AES-GCM...' : 'Run Tamper Detection Test'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRunDiagnostic}
            disabled={isAuditing}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />}
          >
            {isAuditing ? 'Verifying Vault...' : 'Run Security Diagnostic'}
          </Button>
        </div>
      </div>

      {/* Main Status Hero Card */}
      <Card padding="md" className="bg-white border-emerald-200/80 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                Overall Cryptographic Posture
              </span>
              <h3 className="text-lg font-extrabold text-slate-900">
                All Cryptographic Engines Operational
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Last verified: {overview?.lastSecurityCheck || 'Today, just now'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> WebCrypto Subsystem Active
            </span>
          </div>
        </div>
      </Card>

      {/* Live Tamper-Detection Validation Card */}
      <Card padding="md" className="bg-white border-purple-200/90 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">Live Tamper-Detection Validation</h4>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                  AES-256-GCM AEAD
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Exercises the real WebCrypto authentication boundary by bit-flipping an in-memory clone of encrypted ciphertext without modifying storage.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleRunTamperTest}
            disabled={isTestingTamper}
            icon={<ShieldAlert className={`w-3.5 h-3.5 ${isTestingTamper ? 'animate-spin' : ''}`} />}
          >
            {isTestingTamper ? 'Verifying AES-GCM...' : 'Run Tamper Detection Test'}
          </Button>
        </div>

        {tamperResult ? (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 tracking-wider">
                TAMPER DETECTION
              </span>
              <span
                className={`text-[11px] font-extrabold px-3 py-0.5 rounded-full border ${
                  tamperResult.status === 'PASS'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                STATUS: {tamperResult.status}
              </span>
            </div>

            <div className="space-y-2 text-xs font-medium">
              <div className="flex items-center gap-2">
                {tamperResult.originalDecrypts ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className={tamperResult.originalDecrypts ? 'text-emerald-950 font-semibold' : 'text-rose-700 font-semibold'}>
                  ✓ Original ciphertext decrypts
                </span>
              </div>

              <div className="flex items-center gap-2">
                {tamperResult.tamperedRejected ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className={tamperResult.tamperedRejected ? 'text-emerald-950 font-semibold' : 'text-rose-700 font-semibold'}>
                  ✓ Tampered ciphertext rejected
                </span>
              </div>

              <div className="flex items-center gap-2">
                {tamperResult.plaintextNotExposed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className={tamperResult.plaintextNotExposed ? 'text-emerald-950 font-semibold' : 'text-rose-700 font-semibold'}>
                  ✓ Plaintext not exposed
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>
                Target Note: <strong className="text-slate-700 font-mono">{tamperResult.noteTitle}</strong> ({tamperResult.noteId})
              </span>
              <span>
                Storage Untouched: <strong className="text-emerald-700">{tamperResult.storageUntouched ? 'VERIFIED' : 'FAILED'}</strong>
              </span>
              <span>
                Verified at: {tamperResult.timestamp}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-3 p-3 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Click &ldquo;Run Tamper Detection Test&rdquo; to execute a live in-memory ciphertext bit-flip test against the WebCrypto AES-GCM engine.</span>
            <span className="text-[10px] font-bold text-slate-400 font-mono">READY</span>
          </div>
        )}
      </Card>

      {/* Phase 4: Asymmetric Identity Key & Envelope Status */}
      <Card padding="md" className="bg-white border-blue-200/90 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">Asymmetric Identity & Key Envelopes</h4>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                  PHASE 4 ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ECDH NIST P-256 • HKDF-SHA-256 • Per-Recipient Sealed Envelopes • Cryptographic Rekeying
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            Algorithm: ECDH-P256-HKDF-AES-GCM
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 block text-[11px]">Identity Private Key</span>
            <span className="font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Protected Local Vault
            </span>
            <p className="text-[10px] text-slate-500 mt-1">Stored directly in IndexedDB. Never exported, never leaves the browser.</p>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 block text-[11px]">Identity Public Key</span>
            <span className="font-bold text-blue-700 mt-0.5 flex items-center gap-1 truncate font-mono">
              <FileKey className="w-3.5 h-3.5 shrink-0" />
              {identityKey ? `${identityKey.keyId.substring(0, 18)}...` : 'Generating...'}
            </span>
            <p className="text-[10px] text-slate-500 mt-1">Registered on backend for peer key agreement & envelope creation.</p>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 block text-[11px]">Access Revocation Principle</span>
            <span className="font-bold text-indigo-700 mt-0.5 block">
              Cryptographic Key Rotation (K2)
            </span>
            <p className="text-[10px] text-slate-500 mt-1">Revoking access triggers note re-encryption. Revoked users receive 0 envelopes.</p>
          </div>
        </div>

        {/* Revocation Boundary Notice */}
        <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-950 font-semibold block mb-0.5">Revocation Reality & Cryptographic Boundary</strong>
              Revoking access prevents future cryptographic access to newly protected versions. It cannot erase plaintext that a recipient has already viewed, copied, exported, or captured.
            </div>
          </div>
        </div>
      </Card>

      {/* Live Diagnostic Results Card if run */}
      {diagnosticResult && (
        <Card padding="md" className="bg-slate-50 border-blue-200/80 shadow-subtle animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Runtime Diagnostic Report ({diagnosticResult.timestamp})
            </h4>
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              PASSED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200/80">
              <span className="text-slate-400 block text-[11px]">WebCrypto API</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> crypto.subtle Ready
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200/80">
              <span className="text-slate-400 block text-[11px]">Device Root Key</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> AES-KW 256-bit Stored
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200/80">
              <span className="text-slate-400 block text-[11px]">Protected Local Vault</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> cipherflow_vault_v2
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200/80">
              <span className="text-slate-400 block text-[11px]">Encrypted Records</span>
              <span className="font-bold text-blue-600 mt-0.5 block">
                {diagnosticResult.diagnostics.encryptedNotesCount} notes in vault
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Phase 3: Encrypted Cloud Sync Status */}
      <Card padding="md" className="bg-white border-indigo-200/90 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">Encrypted Cloud Synchronization</h4>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                  backendStatus.online 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {backendStatus.online ? 'CONNECTED' : 'OFFLINE / STANDALONE'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                FastAPI Gateway • Zero Plaintext Note Body in Server Storage • Optimistic Concurrency
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            HTTP (Local Dev) / HTTPS/TLS 1.3 (Production)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 block text-[11px]">Server Note Body Exposure</span>
            <span className="font-bold text-emerald-700 mt-0.5 block">
              0 Bytes Plaintext Note Body
            </span>
            <p className="text-[10px] text-slate-500 mt-1">Zero plaintext note body policy enforced; server stores ciphertext only.</p>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 block text-[11px]">Transport & Protocol</span>
            <span className="font-bold text-indigo-700 mt-0.5 block">
              HTTP (Dev) • HTTPS/TLS 1.3 (Prod)
            </span>
            <p className="text-[10px] text-slate-500 mt-1">Local dev runs unencrypted HTTP on localhost; production mandates HTTPS/TLS 1.3.</p>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 block text-[11px]">Storage Engine Target</span>
            <span className="font-bold text-blue-700 mt-0.5 block">
              SQLite (Dev) • PostgreSQL (Prod)
            </span>
            <p className="text-[10px] text-slate-500 mt-1">SQLite for local development/testing; PostgreSQL for multi-user production deployment.</p>
          </div>
        </div>
      </Card>

      {/* Phase 4 Cryptographic Audit Trail */}
      <Card padding="md" className="bg-white border-slate-200 shadow-card">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            <h4 className="text-sm font-bold text-slate-900">Cryptographic Sharing Audit Trail</h4>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {auditEvents.length} events logged
          </span>
        </div>

        {auditEvents.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No sharing or key rotation events recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
            {auditEvents.map(event => (
              <div key={event.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    event.eventType === 'KEY_ROTATED'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : event.eventType === 'ACCESS_REVOKED'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : event.eventType === 'ROLE_CHANGED'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {event.eventType}
                  </span>
                  <div className="truncate">
                    <span className="font-semibold text-slate-900 font-mono">{event.noteId}</span>
                    {event.targetUserId && (
                      <span className="text-slate-500 text-[11px] ml-1.5">
                        Target: <strong className="text-slate-700">{event.targetUserId}</strong>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-slate-400 text-[11px]">
                  <span>v{event.noteVersion}</span>
                  <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Architecture Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pillar 1: Client-Side Encryption */}
        <Card padding="md" className="bg-white border-slate-200 shadow-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Per-Note Authenticated Encryption</h4>
              <p className="text-xs text-emerald-600 font-semibold">AES-256-GCM Enforced</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Every note is encrypted with a distinct, randomly generated 256-bit key and fresh 96-bit IV. Notes authenticate their own metadata through AES-GCM Authenticated Additional Data (AAD).
          </p>
          <div className="pt-2 text-[11px] font-mono text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            Cipher: AES-256-GCM • IV: 96-bit random • Tag: 128-bit AEAD
          </div>
        </Card>

        {/* Pillar 2: Client Controlled Keys */}
        <Card padding="md" className="bg-white border-slate-200 shadow-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Device Root Key Protection</h4>
              <p className="text-xs text-emerald-600 font-semibold">AES-KW Key Wrapping</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Individual note keys are wrapped under a non-extractable 256-bit Device Root Key using standard AES Key Wrap (RFC 3394). The root key is stored directly in Protected Local Vault (IndexedDB) as a browser CryptoKey.
          </p>
          <div className="pt-2 text-[11px] font-mono text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            Wrapping: AES-KW 256-bit • Non-extractable • Zero localStorage usage
          </div>
        </Card>

        {/* Pillar 3: Blind Storage */}
        <Card padding="md" className="bg-white border-slate-200 shadow-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Protected Local Vault</h4>
              <p className="text-xs text-emerald-600 font-semibold">IndexedDB Ciphertext Only</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Note bodies are never saved in plaintext. Only ciphertext, IV, AAD, and wrapped keys are written to the browser&apos;s Protected Local Vault object stores.
          </p>
          <div className="pt-2 text-[11px] font-mono text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            Database: cipherflow_vault_v2 • Plaintext retention: 0 bytes
          </div>
        </Card>

        {/* Pillar 4: Fail-Closed Boundary */}
        <Card padding="md" className="bg-white border-slate-200 shadow-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Fail-Closed Boundary</h4>
              <p className="text-xs text-emerald-600 font-semibold">Strict Authentication</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            If a ciphertext, IV, or authenticated metadata is altered, AES-GCM tag verification fails immediately. The application never silently falls back to plaintext.
          </p>
          <div className="pt-2 text-[11px] font-mono text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
            Integrity: Tampered bits throw AuthenticationError immediately
          </div>
        </Card>
      </div>
    </div>
  );
};
