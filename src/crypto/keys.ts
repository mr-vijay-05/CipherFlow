/**
 * Phase 2 - Client-Side Key Management Service
 * 
 * Manages the local cryptographic key hierarchy:
 * 1. Device Root Key (AES-KW, non-extractable, stored in IndexedDB)
 * 2. Per-Note Encryption Keys (AES-GCM-256, isolated per note, wrapped under Root Key)
 */

import { indexedDbService } from '../storage/indexedDb';
import { arrayBufferToBase64, base64ToArrayBuffer } from './codec';

export const DEVICE_ROOT_KEY_ID = 'device_root_key';
export const ROOT_KEY_ALGORITHM = 'AES-KW';
export const NOTE_KEY_ALGORITHM = 'AES-GCM';
export const KEY_LENGTH = 256;

export class CryptoKeyError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CryptoKeyError';
  }
}

export interface WrappedKey {
  encryptedKeyData: string;
  recipientKeyFingerprint?: string;
  iv?: string;
  tag?: string;
}

export interface IKeyManagementService {
  getOrInitializeDeviceRootKey(): Promise<CryptoKey>;
  generateNoteKey(): Promise<CryptoKey>;
  wrapNoteKey(noteKey: CryptoKey, rootKey: CryptoKey): Promise<string>;
  unwrapNoteKey(wrappedKeyBase64: string, rootKey: CryptoKey): Promise<CryptoKey>;
  hasDeviceRootKey(): Promise<boolean>;
}

export class KeyManagementService implements IKeyManagementService {
  private cachedRootKey: CryptoKey | null = null;

  /**
   * Retrieves the Device Root Key from IndexedDB or initializes a new one.
   * Root key is AES-KW 256-bit, non-extractable, and stored in IndexedDB.
   */
  async getOrInitializeDeviceRootKey(): Promise<CryptoKey> {
    if (this.cachedRootKey) {
      return this.cachedRootKey;
    }

    try {
      // 1. Try to load existing root key from IndexedDB
      const stored = await indexedDbService.getCryptoKey(DEVICE_ROOT_KEY_ID);
      if (stored && stored.key) {
        this.cachedRootKey = stored.key;
        return this.cachedRootKey;
      }

      // 2. Generate new non-extractable AES-KW root key
      const rootKey = await crypto.subtle.generateKey(
        {
          name: ROOT_KEY_ALGORITHM,
          length: KEY_LENGTH,
        },
        false, // non-extractable
        ['wrapKey', 'unwrapKey']
      );

      // 3. Persist directly as CryptoKey object into IndexedDB
      await indexedDbService.saveCryptoKey(DEVICE_ROOT_KEY_ID, rootKey, 1);
      this.cachedRootKey = rootKey;
      return rootKey;
    } catch (err) {
      throw new CryptoKeyError(
        'Failed to initialize or retrieve device root encryption key.',
        err
      );
    }
  }

  /**
   * Generates a fresh, cryptographically isolated AES-256-GCM key for a single note.
   */
  async generateNoteKey(): Promise<CryptoKey> {
    try {
      return await crypto.subtle.generateKey(
        {
          name: NOTE_KEY_ALGORITHM,
          length: KEY_LENGTH,
        },
        true, // extractable so it can be wrapped under the root key
        ['encrypt', 'decrypt']
      );
    } catch (err) {
      throw new CryptoKeyError('Failed to generate per-note encryption key.', err);
    }
  }

  /**
   * Wraps a per-note AES-GCM key using the Device Root Key via AES-KW.
   * Returns base64 string of wrapped key ciphertext.
   */
  async wrapNoteKey(noteKey: CryptoKey, rootKey: CryptoKey): Promise<string> {
    try {
      const wrappedBuffer = await crypto.subtle.wrapKey(
        'raw',
        noteKey,
        rootKey,
        ROOT_KEY_ALGORITHM
      );
      return arrayBufferToBase64(wrappedBuffer);
    } catch (err) {
      throw new CryptoKeyError('Failed to wrap note key under device root key.', err);
    }
  }

  /**
   * Unwraps a wrapped note key using the Device Root Key via AES-KW.
   * Returns the decrypted AES-GCM CryptoKey into memory.
   */
  async unwrapNoteKey(wrappedKeyBase64: string, rootKey: CryptoKey): Promise<CryptoKey> {
    try {
      const wrappedBuffer = base64ToArrayBuffer(wrappedKeyBase64);
      return await crypto.subtle.unwrapKey(
        'raw',
        wrappedBuffer,
        rootKey,
        ROOT_KEY_ALGORITHM,
        {
          name: NOTE_KEY_ALGORITHM,
          length: KEY_LENGTH,
        },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (err) {
      throw new CryptoKeyError(
        'Failed to unwrap note key: Root key invalid or wrapped key corrupted.',
        err
      );
    }
  }

  /**
   * Check if root key has been initialized.
   */
  async hasDeviceRootKey(): Promise<boolean> {
    if (this.cachedRootKey) return true;
    const stored = await indexedDbService.getCryptoKey(DEVICE_ROOT_KEY_ID);
    return !!stored;
  }
}

export const keyManagementService = new KeyManagementService();
