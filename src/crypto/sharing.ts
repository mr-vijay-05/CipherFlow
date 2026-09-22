/**
 * CipherFlow Phase 4 - Cryptographic Note Key Envelopes
 * 
 * Implements asymmetric key agreement and envelope wrapping:
 * Primitive: ECDH (NIST P-256) + HKDF (SHA-256) + AES-256-GCM
 * 
 * Invariants:
 * - Plaintext note content NEVER passes through envelopes or the server.
 * - Recipient private keys NEVER leave client-side Protected Local Vault.
 * - Server stores only sealed key envelopes.
 */

import { arrayBufferToBase64, base64ToArrayBuffer } from './codec';
import { ASYMMETRIC_ALGORITHM, NAMED_CURVE } from './identityKeys';

export const ENVELOPE_ALGORITHM = 'ECDH-P256-HKDF-AES-GCM';
export const ENVELOPE_HKDF_INFO = new TextEncoder().encode('cipherflow-note-envelope-v1');

export interface KeyEnvelopePayload {
  id: string;
  noteId: string;
  recipientUserId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  wrappedNoteKey: string;      // Base64 AES-256-GCM encrypted note key + auth tag
  ephemeralPublicKeyJwk: JsonWebKey; // Ephemeral public key for ECDH agreement
  iv: string;                  // Base64 96-bit IV used for KEK encryption
  algorithm: string;           // "ECDH-P256-HKDF-AES-GCM"
  keyId: string;               // Recipient public key ID
  version: number;             // Note version this envelope unwraps
  createdAt: string;
}

export class EnvelopeCryptoService {
  /**
   * Creates a recipient-specific key envelope wrapping the note key.
   * 
   * Flow:
   * 1. Generate ephemeral ECDH P-256 key pair.
   * 2. Derive shared secret between ephemeral private key and recipient's public key.
   * 3. Derive 256-bit Key Encryption Key (KEK) using HKDF-SHA-256.
   * 4. Encrypt raw noteKey bytes using KEK + AES-256-GCM with fresh 96-bit IV and AAD.
   * 5. Return sealed envelope containing ephemeral public key, IV, and wrapped key.
   */
  async createEnvelope(
    noteKey: CryptoKey,
    recipientPublicKey: CryptoKey,
    recipientUserId: string,
    noteId: string,
    role: 'OWNER' | 'EDITOR' | 'VIEWER',
    version: number,
    recipientKeyId: string = 'primary'
  ): Promise<KeyEnvelopePayload> {
    // 1. Generate ephemeral ECDH key pair
    const ephemeralKeyPair = await crypto.subtle.generateKey(
      {
        name: ASYMMETRIC_ALGORITHM,
        namedCurve: NAMED_CURVE,
      },
      true,
      ['deriveBits']
    );

    // 2. Perform ECDH key agreement -> 256-bit shared secret bits
    const sharedSecretBits = await crypto.subtle.deriveBits(
      {
        name: ASYMMETRIC_ALGORITHM,
        public: recipientPublicKey,
      },
      ephemeralKeyPair.privateKey,
      256
    );

    // 3. Derive KEK via HKDF (RFC 5869)
    const hkdfKey = await crypto.subtle.importKey(
      'raw',
      sharedSecretBits,
      'HKDF',
      false,
      ['deriveKey']
    );

    const salt = new Uint8Array(16); // Canonical zero salt
    const kek = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info: ENVELOPE_HKDF_INFO,
      },
      hkdfKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt']
    );

    // 4. Export raw note key bytes
    const rawNoteKey = await crypto.subtle.exportKey('raw', noteKey);

    // 5. Encrypt note key under KEK with fresh 96-bit IV and AAD binding
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode(`${recipientUserId}:${noteId}:${version}:${ENVELOPE_ALGORITHM}`);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aad,
        tagLength: 128,
      },
      kek,
      rawNoteKey
    );

    const ephemeralPublicKeyJwk = await crypto.subtle.exportKey('jwk', ephemeralKeyPair.publicKey);
    const envelopeId = `env-${noteId}-${recipientUserId}-v${version}-${Date.now()}`;

    return {
      id: envelopeId,
      noteId,
      recipientUserId,
      role,
      wrappedNoteKey: arrayBufferToBase64(ciphertextBuffer),
      ephemeralPublicKeyJwk,
      iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
      algorithm: ENVELOPE_ALGORITHM,
      keyId: recipientKeyId,
      version,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Unwraps a note key envelope using the recipient's private identity key.
   * 
   * Flow:
   * 1. Import ephemeral public key JWK.
   * 2. Derive shared secret between recipient private key and ephemeral public key.
   * 3. Derive KEK via HKDF-SHA-256 with matching context.
   * 4. Decrypt wrapped note key with AES-256-GCM and verify AAD.
   * 5. Import raw decrypted bytes as AES-256-GCM note CryptoKey.
   */
  async unwrapEnvelope(
    envelope: KeyEnvelopePayload,
    recipientPrivateKey: CryptoKey
  ): Promise<CryptoKey> {
    // 1. Import ephemeral public key
    const ephemeralPublicKey = await crypto.subtle.importKey(
      'jwk',
      envelope.ephemeralPublicKeyJwk,
      {
        name: ASYMMETRIC_ALGORITHM,
        namedCurve: NAMED_CURVE,
      },
      false,
      []
    );

    // 2. Perform ECDH key agreement
    const sharedSecretBits = await crypto.subtle.deriveBits(
      {
        name: ASYMMETRIC_ALGORITHM,
        public: ephemeralPublicKey,
      },
      recipientPrivateKey,
      256
    );

    // 3. Derive KEK via HKDF
    const hkdfKey = await crypto.subtle.importKey(
      'raw',
      sharedSecretBits,
      'HKDF',
      false,
      ['deriveKey']
    );

    const salt = new Uint8Array(16);
    const kek = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info: ENVELOPE_HKDF_INFO,
      },
      hkdfKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['decrypt']
    );

    // 4. Decrypt wrapped note key with AAD verification
    const ciphertext = base64ToArrayBuffer(envelope.wrappedNoteKey);
    const iv = base64ToArrayBuffer(envelope.iv);
    const aad = new TextEncoder().encode(
      `${envelope.recipientUserId}:${envelope.noteId}:${envelope.version}:${envelope.algorithm}`
    );

    const rawNoteKeyBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
        additionalData: aad,
        tagLength: 128,
      },
      kek,
      ciphertext
    );

    // 5. Import decrypted bytes as AES-256-GCM CryptoKey
    return crypto.subtle.importKey(
      'raw',
      rawNoteKeyBuffer,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true, // extractable for local re-wrapping under device root key
      ['encrypt', 'decrypt']
    );
  }
}

export const envelopeCryptoService = new EnvelopeCryptoService();
