/**
 * CipherFlow Phase 5 - SearchKey & Deterministic Tokenization Service
 * 
 * Provides privacy-preserving search token generation:
 * - Dedicated 256-bit HMAC-SHA-256 SearchKey.
 * - Stored exclusively in Protected Local Vault (IndexedDB `cryptoKeys`).
 * - Never stored in localStorage / sessionStorage.
 * - Never sent across network / API requests.
 * - Deterministic tokenization (NFKC normalization, lowercase, word tokenization).
 * - Cryptographically separated context: "CipherFlow/SearchKey/v1".
 */

import { indexedDbService } from '../storage/indexedDb';

export const SEARCH_KEY_DERIVATION_CONTEXT = 'CipherFlow/SearchKey/v1';
export const SEARCH_KEY_SALT = 'cipherflow-search-salt-v1';
export const SEARCH_KEY_ALGORITHM = 'HMAC';
export const SEARCH_KEY_HASH = 'SHA-256';
export const SEARCH_KEY_LENGTH = 256;

export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  return uint8ArrayToBase64Url(new Uint8Array(buffer));
}

/**
 * Deterministic client-side tokenization:
 * 1. Normalize Unicode via NFKC
 * 2. Convert to lowercase
 * 3. Tokenize words / alphanumeric sequences
 * 4. Filter empty strings & deduplicate
 */
export function tokenizeText(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  // Unicode normalization (NFKC) + lowercase
  const normalized = text.normalize('NFKC').toLowerCase();

  // Match words / tokens using Unicode letter/number property classes
  const matches = normalized.match(/[\p{L}\p{N}]+/gu);
  if (!matches) return [];

  const uniqueTokens = new Set<string>();
  for (const token of matches) {
    const cleaned = token.trim();
    if (cleaned.length > 0) {
      uniqueTokens.add(cleaned);
    }
  }

  return Array.from(uniqueTokens);
}

export class SearchKeyService {
  private keyCache: Map<string, CryptoKey> = new Map();

  private getKeyStoreId(userId: string = 'default'): string {
    return `search_key_${userId}`;
  }

  clearCache(): void {
    this.keyCache.clear();
  }

  /**
   * Retrieves an existing SearchKey from the Protected Local Vault (IndexedDB),
   * or securely generates a dedicated 256-bit HMAC-SHA-256 key if none exists.
   */
  async getOrInitializeSearchKey(userId: string = 'default'): Promise<CryptoKey> {
    const storeId = this.getKeyStoreId(userId);

    if (this.keyCache.has(storeId)) {
      return this.keyCache.get(storeId)!;
    }

    // 1. Check Protected Local Vault in IndexedDB
    try {
      const stored = await indexedDbService.getCryptoKey(storeId);
      if (stored && stored.key) {
        this.keyCache.set(storeId, stored.key);
        return stored.key;
      }
    } catch (err) {
      console.warn(`[SearchKeyService] IndexedDB lookup note for ${storeId}:`, err);
    }

    // 2. Generate dedicated 256-bit WebCrypto HMAC-SHA-256 key
    // Non-extractable: cannot be exported or leaked
    const newKey = await crypto.subtle.generateKey(
      {
        name: SEARCH_KEY_ALGORITHM,
        hash: { name: SEARCH_KEY_HASH },
        length: SEARCH_KEY_LENGTH,
      },
      false, // non-extractable in production
      ['sign', 'verify']
    );

    // 3. Persist to Protected Local Vault (IndexedDB only)
    try {
      await indexedDbService.saveCryptoKey(storeId, newKey, 1);
    } catch (err) {
      console.warn(`[SearchKeyService] Error persisting search key to IndexedDB:`, err);
    }

    this.keyCache.set(storeId, newKey);
    return newKey;
  }

  /**
   * Derives a dedicated SearchKey from an existing raw root secret using HKDF-SHA-256
   * under the cryptographically separated context "CipherFlow/SearchKey/v1".
   */
  async deriveSearchKeyFromSecret(
    rawSecret: ArrayBuffer | Uint8Array,
    context: string = SEARCH_KEY_DERIVATION_CONTEXT,
    userId: string = 'default'
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const info = encoder.encode(context);
    const salt = encoder.encode(SEARCH_KEY_SALT);

    // 1. Import raw secret as HKDF master key
    const rawBytes = rawSecret instanceof Uint8Array ? rawSecret : new Uint8Array(rawSecret);
    const hkdfKey = await crypto.subtle.importKey(
      'raw',
      rawBytes as BufferSource,
      'HKDF',
      false,
      ['deriveKey']
    );

    // 2. Derive HMAC-SHA-256 SearchKey
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info,
      },
      hkdfKey,
      {
        name: SEARCH_KEY_ALGORITHM,
        hash: { name: SEARCH_KEY_HASH },
        length: SEARCH_KEY_LENGTH,
      },
      false, // non-extractable
      ['sign', 'verify']
    );

    const storeId = this.getKeyStoreId(userId);
    try {
      await indexedDbService.saveCryptoKey(storeId, derivedKey, 1);
    } catch (err) {
      console.warn('[SearchKeyService] Failed to save derived key to IndexedDB:', err);
    }

    this.keyCache.set(storeId, derivedKey);
    return derivedKey;
  }

  /**
   * Computes a deterministic search token for a single keyword:
   * Token = URLSafeBase64(HMAC-SHA-256(SearchKey, normalizedKeyword))
   * 
   * Plaintext keyword is NEVER transmitted or returned.
   */
  async computeSearchToken(keyword: string, searchKey: CryptoKey): Promise<string> {
    const normalized = keyword.normalize('NFKC').toLowerCase().trim();
    if (!normalized) return '';

    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const signature = await crypto.subtle.sign('HMAC', searchKey, data);

    return arrayBufferToBase64Url(signature);
  }

  /**
   * Computes deterministic search tokens for a list of keywords or a text block.
   */
  async computeTokensForText(text: string, searchKey: CryptoKey): Promise<string[]> {
    const words = tokenizeText(text);
    const tokens: string[] = [];

    for (const word of words) {
      const token = await this.computeSearchToken(word, searchKey);
      if (token) {
        tokens.push(token);
      }
    }

    // Deduplicate tokens
    return Array.from(new Set(tokens));
  }
}

export const searchKeyService = new SearchKeyService();
