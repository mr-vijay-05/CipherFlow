/**
 * CipherFlow Blind Search API Client
 * 
 * Interacts with FastAPI /api/v1/search.
 * Transmits and queries ONLY HMAC-SHA-256 opaque search tokens.
 * Plaintext search keywords and plaintext note content are NEVER transmitted.
 */

import { apiClient } from './client';

export interface IndexTokensResponse {
  status: string;
  noteId: string;
  indexedTokens: number;
}

export interface SearchQueryResponse {
  matchingNoteIds: string[];
  matchCount: number;
}

export async function indexNoteTokens(
  noteId: string,
  tokens: string[]
): Promise<IndexTokensResponse> {
  return apiClient.post<IndexTokensResponse>('/api/v1/search/index', {
    noteId,
    tokens,
  });
}

export async function querySearchTokens(
  tokens: string[]
): Promise<SearchQueryResponse> {
  return apiClient.post<SearchQueryResponse>('/api/v1/search/query', {
    tokens,
  });
}

export async function deleteNoteSearchTokens(
  noteId: string
): Promise<{ status: string; noteId: string; deletedTokens: number }> {
  return apiClient.delete<{ status: string; noteId: string; deletedTokens: number }>(
    `/api/v1/search/index/${encodeURIComponent(noteId)}`
  );
}
