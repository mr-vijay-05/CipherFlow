/**
 * Phase 1 Crypto Boundary - Digital Signatures Contract
 */

export interface AuditSignaturePayload {
  eventId: string;
  timestamp: string;
  actionDigest: string;
  signature: string;
  signingKeyId: string;
}

export interface ISignatureService {
  /**
   * Signs audit entries and access grants on client device before transmission.
   */
  signRecord(data: Uint8Array, privateKey: CryptoKey): Promise<string>;

  /**
   * Verifies signatures on received notes, certificates, and audit events.
   */
  verifyRecord(data: Uint8Array, signature: string, publicKey: CryptoKey): Promise<boolean>;
}
