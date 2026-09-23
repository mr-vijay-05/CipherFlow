/**
 * Real Audit Service — Source of Truth
 * 
 * Fetches authoritative audit records from backend audit_events table.
 * NO static or mock data.
 * Zero plaintext or private keys are ever stored or returned.
 */

import { AuditLog } from '../types/security';
import { fetchUserAuditEvents, reportTamperFailureRemote, RemoteAuditEvent } from './api/sharingApi';

export function formatAuditTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString || 'Not available';
    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return isoString || 'Not available';
  }
}

function mapEventTypeToCategory(eventType: string): AuditLog['category'] {
  switch (eventType) {
    case 'NOTE_CREATED':
      return 'create';
    case 'NOTE_UPDATED':
    case 'NOTE_REENCRYPTED':
      return 'edit';
    case 'NOTE_SHARED':
    case 'SHARE_CREATED':
    case 'SHARE_ACCEPTED':
    case 'ROLE_CHANGED':
    case 'SHARE_ROLE_CHANGED':
      return 'share';
    case 'ACCESS_REVOKED':
    case 'KEY_ROTATED':
    case 'CRYPTOGRAPHIC_REKEY':
      return 'revoke';
    case 'DEVICE_REGISTERED':
    case 'DEVICE_REVOKED':
      return 'device';
    case 'NOTE_DECRYPTION_TAMPER_FAILURE':
      return 'security';
    default:
      return 'edit';
  }
}

function mapEventTypeToAction(ev: RemoteAuditEvent): string {
  if (ev.metadata?.action) {
    return ev.metadata.action;
  }
  switch (ev.eventType) {
    case 'NOTE_CREATED':
      return 'New Note Initialized';
    case 'NOTE_UPDATED':
      return 'Note Modified & Re-encrypted';
    case 'NOTE_REENCRYPTED':
      return 'Note Re-encrypted';
    case 'NOTE_SHARED':
    case 'SHARE_CREATED':
      return 'Cryptographic Access Grant Created';
    case 'ROLE_CHANGED':
    case 'SHARE_ROLE_CHANGED':
      return 'Collaborator Role Changed';
    case 'ACCESS_REVOKED':
      return 'Collaborator Access Revocation Executed';
    case 'KEY_ROTATED':
    case 'CRYPTOGRAPHIC_REKEY':
      return 'Cryptographic Rekey Executed';
    case 'DEVICE_REGISTERED':
      return 'New Device Enclave Registered';
    case 'DEVICE_REVOKED':
      return 'Device Root Key Revoked';
    case 'NOTE_DECRYPTION_TAMPER_FAILURE':
      return 'Decryption Integrity Check Failed';
    default:
      return ev.eventType.replace(/_/g, ' ');
  }
}

function mapRemoteToAuditLog(ev: RemoteAuditEvent): AuditLog {
  const meta = ev.metadata || {};
  let status: 'success' | 'warning' | 'alert' = 'success';
  if (meta.status) {
    status = meta.status as any;
  } else if (ev.eventType === 'NOTE_DECRYPTION_TAMPER_FAILURE') {
    status = 'alert';
  } else if (ev.eventType === 'ACCESS_REVOKED' || ev.eventType === 'DEVICE_REVOKED') {
    status = 'warning';
  }

  const target = meta.noteTitle ? `${meta.noteTitle} (v${ev.noteVersion})` : `${ev.noteId} (v${ev.noteVersion})`;
  const ipAddress = meta.ipAddress && meta.ipAddress !== 'None' ? meta.ipAddress : 'Not available';

  return {
    id: ev.id,
    action: mapEventTypeToAction(ev),
    target,
    timestamp: formatAuditTimestamp(ev.createdAt),
    category: mapEventTypeToCategory(ev.eventType),
    actor: ev.actorId || 'Not available',
    ipAddress,
    status,
    isClientRecorded: meta.isClientRecorded ?? false,
    rawCreatedAt: ev.createdAt,
  };
}

class AuditService {
  private listeners: Set<() => void> = new Set();
  private localFallbackLogs: AuditLog[] = [];

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Audit listener error:', err);
      }
    }
  }

  async getAuditLogs(filterCategory?: string): Promise<AuditLog[]> {
    try {
      const remoteEvents = await fetchUserAuditEvents(filterCategory);
      const mapped = remoteEvents.map(mapRemoteToAuditLog);
      
      // Combine with any local in-memory fallback logs if present
      let allLogs = [...mapped];
      if (this.localFallbackLogs.length > 0) {
        for (const local of this.localFallbackLogs) {
          if (!allLogs.some(l => l.id === local.id)) {
            allLogs.unshift(local);
          }
        }
      }

      if (filterCategory && filterCategory !== 'all') {
        allLogs = allLogs.filter(l => l.category === filterCategory);
      }

      return allLogs;
    } catch (err) {
      console.warn('[AuditService] Remote audit events fetch failed, using local audit cache:', err);
      if (filterCategory && filterCategory !== 'all') {
        return this.localFallbackLogs.filter(l => l.category === filterCategory);
      }
      return [...this.localFallbackLogs];
    }
  }

  async reportTamperFailure(
    noteId: string,
    version?: number,
    reason?: string,
    details?: string
  ): Promise<AuditLog> {
    try {
      const remoteEvent = await reportTamperFailureRemote({
        noteId,
        version,
        reason,
        details,
      });
      const log = mapRemoteToAuditLog(remoteEvent);
      this.notify();
      return log;
    } catch (err) {
      console.warn('[AuditService] Failed to report tamper event to backend, recording client-side:', err);
      const now = new Date();
      const clientLog: AuditLog = {
        id: `aud-client-tamper-${Date.now()}`,
        action: 'Decryption Integrity Check Failed',
        target: `${noteId} (v${version || 1})`,
        timestamp: formatAuditTimestamp(now.toISOString()),
        category: 'security',
        actor: 'Client-Enclave',
        ipAddress: 'Local WebCrypto Environment',
        status: 'alert',
        isClientRecorded: true,
        rawCreatedAt: now.toISOString(),
      };
      this.localFallbackLogs.unshift(clientLog);
      this.notify();
      return clientLog;
    }
  }

  async recordAuditEvent(event: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const now = new Date();
    const newEntry: AuditLog = {
      ...event,
      id: `aud-${Date.now()}`,
      timestamp: formatAuditTimestamp(now.toISOString()),
      isClientRecorded: true,
      rawCreatedAt: now.toISOString(),
    };
    this.localFallbackLogs.unshift(newEntry);
    this.notify();
    return newEntry;
  }
}

export const auditService = new AuditService();
