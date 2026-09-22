/**
 * Phase 2 - Client-Side AES-256-GCM Encryption Service
 * 
 * Provides:
 * - Real Web Crypto AES-256-GCM encryption & decryption
 * - Guaranteed fresh 96-bit random IV per encryption operation via crypto.getRandomValues
 * - Authenticated Additional Data (AAD) binding noteId, version, and algorithm
 * - Fail-closed error handling: tampered ciphertexts, IVs, or AAD fail immediately
 */

import {
  textToUint8Array,
  uint8ArrayToText,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  base64ToUint8Array,
} from './codec';

export const CURRENT_ENCRYPTION_VERSION = 1;
export const ENCRYPTION_ALGORITHM = 'AES-256-GCM' as const;
export const IV_LENGTH_BYTES = 12; // 96 bits for standard AES-GCM

export interface EncryptedPayload {
  version: number;
  algorithm: typeof ENCRYPTION_ALGORITHM;
  ciphertext: string; // Base64 ciphertext + auth tag
  iv: string; // Base64 12-byte IV
  aad: string; // Canonical AAD string
}

export class CryptoError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CryptoError';
  }
}

export class AuthenticationError extends CryptoError {
  constructor(message: string = 'Decryption failed: Ciphertext, IV, or authenticated metadata was tampered with.', cause?: unknown) {
    super(message, cause);
    this.name = 'AuthenticationError';
  }
}

export interface IEncryptionService {
  encrypt(plaintext: string, noteKey: CryptoKey, noteId: string, version?: number): Promise<EncryptedPayload>;
  decrypt(payload: EncryptedPayload, noteKey: CryptoKey, expectedNoteId: string): Promise<string>;
  generateIv(): Uint8Array;
  createAad(noteId: string, version: number, algorithm: string): string;
}

export class EncryptionService implements IEncryptionService {
  /**
   * Generates a cryptographically secure random 96-bit (12-byte) IV.
   * NEVER reuses IVs.
   */
  generateIv(): Uint8Array {
    const iv = new Uint8Array(IV_LENGTH_BYTES);
    crypto.getRandomValues(iv);
    return iv;
  }

  /**
   * Creates canonical AAD (Authenticated Additional Data) binding note metadata.
   * Format: "noteId:version:algorithm"
   */
  createAad(noteId: string, version: number, algorithm: string): string {
    return `${noteId}:${version}:${algorithm}`;
  }

  /**
   * Encrypts plaintext string using AES-256-GCM with a fresh 96-bit random IV and AAD.
   */
  async encrypt(
    plaintext: string,
    noteKey: CryptoKey,
    noteId: string,
    version: number = CURRENT_ENCRYPTION_VERSION
  ): Promise<EncryptedPayload> {
    if (!plaintext && plaintext !== '') {
      throw new CryptoError('Plaintext content is required for encryption.');
    }

    try {
      // 1. Generate fresh 96-bit IV
      const iv = this.generateIv();

      // 2. Construct canonical AAD
      const aadString = this.createAad(noteId, version, ENCRYPTION_ALGORITHM);
      const aadBytes = textToUint8Array(aadString);

      // 3. Encode plaintext bytes
      const plaintextBytes = textToUint8Array(plaintext);

      // 4. AES-GCM Encrypt with additionalData
      const cipherBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
          additionalData: aadBytes as BufferSource,
          tagLength: 128, // 128-bit authentication tag
        },
        noteKey,
        plaintextBytes as BufferSource
      );

      // 5. Serialize into strongly typed payload
      return {
        version,
        algorithm: ENCRYPTION_ALGORITHM,
        ciphertext: arrayBufferToBase64(cipherBuffer),
        iv: arrayBufferToBase64(iv),
        aad: aadString,
      };
    } catch (err) {
      throw new CryptoError(`Encryption failed for note ${noteId}: fail-closed.`, err);
    }
  }

  /**
   * Decrypts ciphertext payload using AES-256-GCM, verifying authenticity of ciphertext and AAD.
   * Throws AuthenticationError if anything has been tampered with.
   */
  async decrypt(
    payload: EncryptedPayload,
    noteKey: CryptoKey,
    expectedNoteId: string
  ): Promise<string> {
    if (!payload.ciphertext || !payload.iv) {
      throw new CryptoError('Malformed encrypted payload: missing ciphertext or IV.');
    }

    try {
      // 1. Reconstruct expected AAD based on expectedNoteId and payload parameters
      const expectedAad = this.createAad(expectedNoteId, payload.version, payload.algorithm);
      
      // If payload's aad doesn't match expected note context, fail immediately
      if (payload.aad !== expectedAad) {
        console.error(
          `[Crypto] AAD Mismatch! Expected: "${expectedAad}", Got: "${payload.aad}" ` +
          `(expectedNoteId: "${expectedNoteId}", payload.version: ${payload.version}, payload.algorithm: "${payload.algorithm}")`
        );
        throw new AuthenticationError('AAD mismatch: Note identifier or encryption version does not match payload metadata.');
      }

      const aadBytes = textToUint8Array(expectedAad);
      const ivBytes = base64ToUint8Array(payload.iv);
      const cipherBuffer = base64ToArrayBuffer(payload.ciphertext);

      // 2. AES-GCM Decrypt
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBytes as BufferSource,
          additionalData: aadBytes as BufferSource,
          tagLength: 128,
        },
        noteKey,
        cipherBuffer as BufferSource
      );

      // 3. Decode UTF-8 string
      return uint8ArrayToText(new Uint8Array(decryptedBuffer));
    } catch (err) {
      if (err instanceof CryptoError) {
        throw err;
      }
      // Web Crypto throws DOMException / OperationError on tag verification failure
      throw new AuthenticationError(
        'Decryption failed: Message authentication tag mismatch or corrupted ciphertext.',
        err
      );
    }
  }
}

export const encryptionService = new EncryptionService();
