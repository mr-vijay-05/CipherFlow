/**
 * CipherFlow Sync API
 * 
 * Interacts with FastAPI /api/v1/sync to retrieve deltas and tombstones.
 */

import { apiClient } from './client';
import { RemoteEncryptedNoteResponse } from './notesApi';

export interface SyncResponse {
  changes: RemoteEncryptedNoteResponse[];
  tombstones: string[];
  serverTimestamp: string;
  nextCursor: string;
}

export async function fetchSyncDeltas(
  cursor?: string,
  limit: number = 100
): Promise<SyncResponse> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set('since', cursor);
  }
  params.set('limit', limit.toString());

  return apiClient.get<SyncResponse>(`/api/v1/sync?${params.toString()}`);
}
