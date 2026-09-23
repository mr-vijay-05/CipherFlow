/**
 * CipherFlow Phase 5 - Privacy-Preserving Search Coordinator
 * 
 * Architecture:
 * 1. User keyword
 * 2. Client normalization/tokenization
 * 3. HMAC-SHA-256(SearchKey, normalized keyword)
 * 4. Search token
 * 5. Backend encrypted search index
 * 6. Matching Note IDs returned
 * 7. Client downloads encrypted notes
 * 8. Client decrypts using existing Phase 2 AES-256-GCM crypto
 * 9. Display results
 * 
 * Strict Privacy Invariants:
 * - Server NEVER receives plaintext search keywords.
 * - Server NEVER receives plaintext note bodies.
 * - SearchKey NEVER leaves client vault (IndexedDB).
 * - Scoped strictly to authenticated user's owned notes (Phase 5 V1).
 */

import { Note } from '../types/note';
import { searchKeyService, tokenizeText } from '../crypto/searchKey';
import { indexNoteTokens, querySearchTokens, deleteNoteSearchTokens } from './api/searchApi';
import { noteService } from './noteService';

function getCurrentUserId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('cipherflow_auth_profile');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) return parsed.id;
      }
    }
  } catch {}
  return 'default';
}

export class SearchService {
  /**
   * Indexes a note's search tokens during creation or edit.
   * Client extracts tokens from local memory and computes HMAC-SHA-256 tokens.
   * Only blind tokens and noteId are transmitted.
   */
  async indexNoteContent(
    noteId: string,
    plaintext: string,
    title: string = '',
    userId?: string
  ): Promise<void> {
    try {
      const effectiveUserId = userId || getCurrentUserId();
      const searchKey = await searchKeyService.getOrInitializeSearchKey(effectiveUserId);
      const combinedText = `${title} ${plaintext}`.trim();
      const tokens = await searchKeyService.computeTokensForText(combinedText, searchKey);

      if (tokens.length > 0) {
        try {
          await indexNoteTokens(noteId, tokens);
        } catch (err: any) {
          // If note is still syncing to backend (404), retry once shortly
          if (err?.status === 404 || String(err?.message || '').includes('404')) {
            setTimeout(async () => {
              try {
                await indexNoteTokens(noteId, tokens);
              } catch {}
            }, 1500);
          }
        }
      }
    } catch (err: any) {
      if (err?.status !== 404) {
        console.debug(`[SearchService] Notice indexing tokens for note ${noteId}:`, err);
      }
    }
  }

  /**
   * Executes a privacy-preserving search:
   * 1. Tokenizes query keyword locally
   * 2. Computes HMAC-SHA-256 search token locally
   * 3. Transmits ONLY blind search token to backend
   * 4. Retrieves matching note IDs
   * 5. Decrypts matching notes locally in memory
   */
  async searchNotes(query: string, userId?: string): Promise<Note[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    // 1. Client-side tokenization
    const words = tokenizeText(trimmed);
    if (words.length === 0) {
      return [];
    }

    // 2. Generate blind HMAC-SHA-256 search tokens
    const effectiveUserId = userId || getCurrentUserId();
    const searchKey = await searchKeyService.getOrInitializeSearchKey(effectiveUserId);
    const blindTokens: string[] = [];
    for (const word of words) {
      const token = await searchKeyService.computeSearchToken(word, searchKey);
      if (token) {
        blindTokens.push(token);
      }
    }

    if (blindTokens.length === 0) {
      return [];
    }

    // 3. Query backend with blind tokens ONLY
    // Server receives: { tokens: ["base64url..."] }
    // Server NEVER sees plaintext keyword (e.g. "architecture")
    let matchingNoteIds: string[] = [];
    try {
      const response = await querySearchTokens(blindTokens);
      matchingNoteIds = response.matchingNoteIds || [];
    } catch (err) {
      console.warn('[SearchService] Remote blind search failed, falling back to local vault:', err);
      return this.localVaultSearch(words);
    }

    // 4. Retrieve and decrypt matching notes locally using Phase 2 crypto
    const decryptedMap = new Map<string, Note>();
    for (const noteId of matchingNoteIds) {
      try {
        const note = await noteService.getNoteById(noteId);
        if (note && !note.isTrashed) {
          decryptedMap.set(note.id, note);
        }
      } catch (decryptErr) {
        console.warn(`[SearchService] Decryption error for matching note ${noteId}:`, decryptErr);
      }
    }

    // Also include any locally matched notes if backend hasn't finished indexing newly created note
    const localMatches = await this.localVaultSearch(words);
    for (const localNote of localMatches) {
      if (!decryptedMap.has(localNote.id)) {
        decryptedMap.set(localNote.id, localNote);
      }
    }

    return Array.from(decryptedMap.values());
  }

  /**
   * Search interface supporting options filtering.
   */
  async searchEncryptedNotes(options: {
    query: string;
    tag?: string;
    securityStatus?: string;
    userId?: string;
  }): Promise<Note[]> {
    const notes = await this.searchNotes(options.query, options.userId);
    let filtered = notes;
    if (options.tag) {
      filtered = filtered.filter(n => n.tags && n.tags.includes(options.tag!));
    }
    if (options.securityStatus) {
      filtered = filtered.filter(n => n.securityStatus === options.securityStatus);
    }
    return filtered;
  }

  /**
   * Removes search index for a deleted note.
   */
  async removeNoteIndex(noteId: string): Promise<void> {
    try {
      await deleteNoteSearchTokens(noteId);
    } catch (err: any) {
      if (err?.status !== 404) {
        console.debug(`[SearchService] Error removing search tokens for note ${noteId}:`, err);
      }
    }
  }

  /**
   * Local vault offline fallback search.
   */
  private async localVaultSearch(words: string[]): Promise<Note[]> {
    const allNotes = await noteService.getNotes();
    const results: Note[] = [];

    for (const meta of allNotes) {
      try {
        const fullNote = await noteService.getNoteById(meta.id);
        if (!fullNote) continue;

        const content = `${fullNote.title} ${fullNote.content}`.toLowerCase();
        const matches = words.some(w => content.includes(w));
        if (matches) {
          results.push(fullNote);
        }
      } catch {
        // Skip unreadable note
      }
    }

    return results;
  }
}

export const searchService = new SearchService();
