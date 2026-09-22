/**
 * CipherFlow Remote Encrypted Notes API
 * 
 * Interacts with FastAPI /api/v1/notes.
 * Sends and receives ONLY ciphertext payloads.
 * No plaintext or master keys are ever transmitted.
 */

import { apiClient } from './client';

export interface NoteMetadataPayload {
  title: string;
  description?: string;
  tags?: string[];
  spaceId?: string;
  isFavorite?: boolean;
  isPinned?: boolean;
}

export interface RemoteEncryptedNoteCreate {
  noteId: string;
  version: number;
  ciphertext: string;
  iv: string;
  wrappedNoteKey: string;
  aad: string;
  metadata: NoteMetadataPayload;
}

export interface RemoteEncryptedNoteUpdate {
  version: number;
  baseVersion: number;
  ciphertext: string;
  iv: string;
  wrappedNoteKey?: string;
  aad: string;
  metadata?: NoteMetadataPayload;
}

export interface RemoteEncryptedNoteResponse {
  noteId: string;
  version: number;
  ciphertext: string;
  iv: string;
  wrappedNoteKey: string;
  aad: string;
  metadata: NoteMetadataPayload;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function createRemoteNote(
  payload: RemoteEncryptedNoteCreate
): Promise<RemoteEncryptedNoteResponse> {
  return apiClient.post<RemoteEncryptedNoteResponse>('/api/v1/notes', payload);
}

export async function getRemoteNote(
  noteId: string
): Promise<RemoteEncryptedNoteResponse> {
  return apiClient.get<RemoteEncryptedNoteResponse>(`/api/v1/notes/${encodeURIComponent(noteId)}`);
}

export async function updateRemoteNote(
  noteId: string,
  payload: RemoteEncryptedNoteUpdate
): Promise<RemoteEncryptedNoteResponse> {
  return apiClient.put<RemoteEncryptedNoteResponse>(
    `/api/v1/notes/${encodeURIComponent(noteId)}`,
    payload
  );
}

export async function deleteRemoteNote(
  noteId: string
): Promise<{ status: string; noteId: string }> {
  return apiClient.delete<{ status: string; noteId: string }>(
    `/api/v1/notes/${encodeURIComponent(noteId)}`
  );
}

export async function listRemoteNotes(): Promise<RemoteEncryptedNoteResponse[]> {
  return apiClient.get<RemoteEncryptedNoteResponse[]>('/api/v1/notes');
}
