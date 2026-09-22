/**
 * CipherFlow Sharing API
 * 
 * Interacts with FastAPI Phase 4 endpoints for identity keys, ACLs, envelopes, and audit logs.
 * Plaintext note content and private keys are NEVER transmitted.
 */

import { apiClient } from './client';
import { KeyEnvelopePayload } from '../../crypto/sharing';

export interface PublicKeyRecord {
  keyId: string;
  userId: string;
  publicKeyJwk: JsonWebKey;
  algorithm: string;
  version: number;
  createdAt: string;
}

export interface CollaboratorSearchResult {
  id: string;
  email: string;
  hasPublicKey: boolean;
}

export interface RemoteShareRecord {
  id: string;
  noteId: string;
  ownerId: string;
  recipientId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  createdAt: string;
  updatedAt: string;
  revokedAt?: string | null;
}

export interface RemoteAuditEvent {
  id: string;
  noteId: string;
  actorId: string;
  eventType: 'NOTE_SHARED' | 'SHARE_ACCEPTED' | 'ROLE_CHANGED' | 'ACCESS_REVOKED' | 'KEY_ROTATED';
  targetUserId?: string | null;
  noteVersion: number;
  metadata: Record<string, any>;
  createdAt: string;
}

export async function registerPublicKey(
  userId: string,
  publicKeyJwk: JsonWebKey,
  keyId?: string
): Promise<PublicKeyRecord> {
  return apiClient.post<PublicKeyRecord>(`/api/v1/users/${encodeURIComponent(userId)}/public-key`, {
    publicKeyJwk,
    algorithm: 'ECDH-P256',
    version: 1,
    keyId,
  });
}

export async function fetchUserPublicKey(userId: string): Promise<PublicKeyRecord> {
  return apiClient.get<PublicKeyRecord>(`/api/v1/users/${encodeURIComponent(userId)}/public-key`);
}

export async function searchCollaborators(query: string): Promise<CollaboratorSearchResult[]> {
  return apiClient.get<CollaboratorSearchResult[]>(`/api/v1/users/search?q=${encodeURIComponent(query)}`);
}

export async function createShare(
  noteId: string,
  recipientUserId: string,
  role: 'OWNER' | 'EDITOR' | 'VIEWER',
  envelope: KeyEnvelopePayload
): Promise<RemoteShareRecord> {
  return apiClient.post<RemoteShareRecord>(`/api/v1/notes/${encodeURIComponent(noteId)}/shares`, {
    recipientUserId,
    role,
    envelope,
  });
}

export async function listShares(noteId: string): Promise<RemoteShareRecord[]> {
  return apiClient.get<RemoteShareRecord[]>(`/api/v1/notes/${encodeURIComponent(noteId)}/shares`);
}

export async function updateShare(
  noteId: string,
  recipientId: string,
  role: 'OWNER' | 'EDITOR' | 'VIEWER'
): Promise<RemoteShareRecord> {
  return apiClient.patch<RemoteShareRecord>(
    `/api/v1/notes/${encodeURIComponent(noteId)}/shares/${encodeURIComponent(recipientId)}`,
    { role }
  );
}

export async function revokeShareRemote(
  noteId: string,
  recipientId: string
): Promise<{ status: string; noteId: string; recipientId: string; message: string }> {
  return apiClient.delete(
    `/api/v1/notes/${encodeURIComponent(noteId)}/shares/${encodeURIComponent(recipientId)}`
  );
}

export async function rotateNoteKeyRemote(
  noteId: string,
  payload: {
    version: number;
    baseVersion: number;
    ciphertext: string;
    iv: string;
    aad: string;
    envelopes: KeyEnvelopePayload[];
  }
): Promise<{ status: string; noteId: string; newVersion: number; envelopesCount: number }> {
  return apiClient.post(`/api/v1/notes/${encodeURIComponent(noteId)}/rotate-key`, payload);
}

export async function fetchKeyEnvelopes(
  noteId: string,
  version?: number
): Promise<KeyEnvelopePayload[]> {
  const query = version ? `?version=${version}` : '';
  return apiClient.get<KeyEnvelopePayload[]>(
    `/api/v1/notes/${encodeURIComponent(noteId)}/key-envelopes${query}`
  );
}

export async function fetchNoteAuditEvents(noteId: string): Promise<RemoteAuditEvent[]> {
  return apiClient.get<RemoteAuditEvent[]>(
    `/api/v1/notes/${encodeURIComponent(noteId)}/audit-events`
  );
}

export async function fetchUserAuditEvents(): Promise<RemoteAuditEvent[]> {
  return apiClient.get<RemoteAuditEvent[]>('/api/v1/audit-events');
}
