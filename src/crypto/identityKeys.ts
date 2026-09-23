/**
 * CipherFlow Phase 4 - Identity Key System
 * 
 * Each user/device possesses an asymmetric identity key pair:
 * - Public Key: Registered with backend, used by other clients to wrap note keys.
 * - Private Key: Stored client-side in the Protected Local Vault (IndexedDB).
 *   NEVER leaves the client, NEVER sent in API requests, NEVER in localStorage/sessionStorage.
 * 
 * Primitive: ECDH with NIST P-256 (secp256r1)
 */

import { indexedDbService } from '../storage/indexedDb';

export const IDENTITY_KEY_ID = 'identity_key_primary';
export const ASYMMETRIC_ALGORITHM = 'ECDH';
export const NAMED_CURVE = 'P-256';

export interface IdentityKeyPair {
  keyId: string;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
  algorithm: string;
  createdAt: string;
}

export class IdentityKeyService {
  private cachedKeyPair: IdentityKeyPair | null = null;
  private initPromise: Promise<IdentityKeyPair> | null = null;

  /**
   * Generates or retrieves the user's primary ECDH P-256 identity key pair.
   * Private key is stored directly in IndexedDB Protected Local Vault.
   */
  async getOrInitializeIdentityKey(userId: string = 'current_user'): Promise<IdentityKeyPair> {
    if (this.cachedKeyPair) {
      return this.cachedKeyPair;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const storageKeyId = `${IDENTITY_KEY_ID}_${userId}`;

      // 1. Try to load existing private and public keys from IndexedDB
      const storedPrivate = await indexedDbService.getCryptoKey(`${storageKeyId}_private`);
      const storedPublic = await indexedDbService.getCryptoKey(`${storageKeyId}_public`);

      if (storedPrivate && storedPublic && storedPrivate.key && storedPublic.key) {
        const jwk = await crypto.subtle.exportKey('jwk', storedPublic.key);
        this.cachedKeyPair = {
          keyId: storageKeyId,
          publicKey: storedPublic.key,
          privateKey: storedPrivate.key,
          publicKeyJwk: jwk,
          algorithm: `${ASYMMETRIC_ALGORITHM}-${NAMED_CURVE}`,
          createdAt: storedPrivate.createdAt,
        };
        return this.cachedKeyPair;
      }

      // 2. Generate fresh ECDH P-256 key pair
      const keyPair = await crypto.subtle.generateKey(
        {
          name: ASYMMETRIC_ALGORITHM,
          namedCurve: NAMED_CURVE,
        },
        true, // extractable so we can export public key JWK and persist CryptoKeys
        ['deriveKey', 'deriveBits']
      );

      const now = new Date().toISOString();

      // 3. Persist keys in Protected Local Vault (IndexedDB)
      await indexedDbService.saveCryptoKey(`${storageKeyId}_private`, keyPair.privateKey, 1);
      await indexedDbService.saveCryptoKey(`${storageKeyId}_public`, keyPair.publicKey, 1);

      // 4. Export public key as JWK for backend sharing
      const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

      this.cachedKeyPair = {
        keyId: storageKeyId,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        publicKeyJwk,
        algorithm: `${ASYMMETRIC_ALGORITHM}-${NAMED_CURVE}`,
        createdAt: now,
      };

      return this.cachedKeyPair;
    })();

    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Imports a raw JWK public key from a collaborator.
   */
  async importPeerPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
    // Validate recipient public key structure and coordinate lengths before attempting import
    validateP256PublicJwk(jwk);

    return crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: ASYMMETRIC_ALGORITHM,
        namedCurve: NAMED_CURVE,
      },
      true,
      []
    );
  }

  /**
   * Forcibly generates a new ECDH P-256 key pair, saves it in IndexedDB Protected Local Vault,
   * updates the cache, and returns the exported public JWK.
   */
  async generateFreshIdentityKey(userId: string = 'current_user'): Promise<IdentityKeyPair> {
    const storageKeyId = `${IDENTITY_KEY_ID}_${userId}`;
    const keyPair = await crypto.subtle.generateKey(
      {
        name: ASYMMETRIC_ALGORITHM,
        namedCurve: NAMED_CURVE,
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    const now = new Date().toISOString();
    await indexedDbService.saveCryptoKey(`${storageKeyId}_private`, keyPair.privateKey, 1);
    await indexedDbService.saveCryptoKey(`${storageKeyId}_public`, keyPair.publicKey, 1);
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    this.cachedKeyPair = {
      keyId: storageKeyId,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      publicKeyJwk,
      algorithm: `${ASYMMETRIC_ALGORITHM}-${NAMED_CURVE}`,
      createdAt: now,
    };

    return this.cachedKeyPair;
  }

  /**
   * Checks if an identity key is present in client-side storage.
   */
  async hasIdentityKey(userId: string = 'current_user'): Promise<boolean> {
    const storageKeyId = `${IDENTITY_KEY_ID}_${userId}`;
    const stored = await indexedDbService.getCryptoKey(`${storageKeyId}_private`);
    return !!(stored && stored.key);
  }

  /**
   * Clears in-memory identity key cache (for test simulation / logout).
   */
  clearCache(): void {
    this.cachedKeyPair = null;
    this.initPromise = null;
  }
}

export const identityKeyService = new IdentityKeyService();

/**
 * Decodes a Base64URL string into raw bytes.
 */
export function base64urlDecode(input: string): Uint8Array {
  if (typeof input !== 'string') {
    throw new Error('Expected string for base64url decoding.');
  }
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  throw new Error('No base64 decoding implementation available in environment.');
}

/**
 * Validates that an incoming JWK is a well-formed ECDH NIST P-256 public key.
 * 
 * Strict requirements:
 * - jwk.kty === "EC"
 * - jwk.crv === "P-256"
 * - typeof jwk.x === "string"
 * - typeof jwk.y === "string"
 * - base64urlDecode(jwk.x).byteLength === 32
 * - base64urlDecode(jwk.y).byteLength === 32
 * 
 * Logs only safe structural diagnostics (NO private keys, note keys, plaintext, or sensitive material).
 * Rejects malformed keys fail-closed before attempting ECDH.
 */
export function validateP256PublicJwk(jwk: any): void {
  if (!jwk || typeof jwk !== 'object') {
    throw new Error('Recipient public key is invalid or not registered correctly. Expected a P-256 public JWK.');
  }

  let xBytesLength: number | undefined;
  let yBytesLength: number | undefined;

  try {
    if (typeof jwk.x === 'string') {
      xBytesLength = base64urlDecode(jwk.x).byteLength;
    }
  } catch {
    xBytesLength = undefined;
  }

  try {
    if (typeof jwk.y === 'string') {
      yBytesLength = base64urlDecode(jwk.y).byteLength;
    }
  } catch {
    yBytesLength = undefined;
  }

  // Safe structural diagnostics in development (Section 1)
  // NEVER log private keys, note keys, plaintext, or full sensitive key material.
  console.debug('[Crypto] Structural JWK diagnostic:', {
    kty: jwk.kty,
    crv: jwk.crv,
    xType: typeof jwk.x,
    xLength: xBytesLength,
    yType: typeof jwk.y,
    yLength: yBytesLength,
  });

  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') {
    throw new Error('Recipient public key is invalid or not registered correctly. Expected a P-256 public JWK.');
  }

  if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
    throw new Error('Recipient public key is invalid or not registered correctly. Expected a P-256 public JWK.');
  }

  if (xBytesLength !== 32 || yBytesLength !== 32) {
    throw new Error('Recipient public key is invalid or not registered correctly. Expected a P-256 public JWK.');
  }
}

