/**
 * CipherFlow Phase 4 - Cryptographic Rekey Service
 * 
 * Re-encrypts notes with a fresh key during revocation and rotates envelopes.
 * 
 * Security Invariant:
 * "Removing a recipient from the ACL is NOT sufficient.
 * Therefore revocation MUST perform cryptographic key rotation."
 * 
 * Flow:
 * 1. Load current plaintext locally.
 * 2. Generate fresh AES-256-GCM key K2.
 * 3. Generate fresh 96-bit IV.
 * 4. Increment version (monotonic).
 * 5. Generate canonical AAD.
 * 6. Encrypt protected note state locally with K2.
 * 7. Generate fresh key envelopes for remaining authorized recipients.
 * 8. Revoked recipient receives NO envelope.
 * 9. Commit new encrypted version to backend.
 */

import { encryptionService, CURRENT_ENCRYPTION_VERSION, ENCRYPTION_ALGORITHM } from './encryption';
import { keyManagementService } from './keys';
import { envelopeCryptoService, KeyEnvelopePayload } from './sharing';
import { identityKeyService } from './identityKeys';

export interface AuthorizedRecipient {
  userId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  publicKeyJwk: JsonWebKey;
  keyId?: string;
}

export interface RekeyResult {
  noteId: string;
  version: number;
  baseVersion: number;
  ciphertext: string;
  iv: string;
  aad: string;
  wrappedNoteKeyForOwner: string; // Wrapped under owner's Device Root Key
  keyEnvelopes: KeyEnvelopePayload[]; // Sealed envelopes for remaining authorized recipients
  newNoteKey: CryptoKey; // In-memory reference for local vault update
}

export class RekeyService {
  /**
   * Performs cryptographic re-encryption of a note with a brand new AES-256-GCM key K2,
   * rotating key envelopes for all remaining authorized recipients.
   * 
   * The revoked user is excluded from remainingRecipients and receives NO K2 envelope.
   */
  async rotateNoteKey(
    noteId: string,
    currentPlaintextContent: string,
    currentVersion: number,
    remainingRecipients: AuthorizedRecipient[],
    ownerUserId: string
  ): Promise<RekeyResult> {
    const nextVersion = currentVersion + 1;

    // 1. Generate fresh random 256-bit AES-GCM note key (K2)
    const newNoteKey = await keyManagementService.generateNoteKey();

    // 2. Encrypt plaintext with fresh 96-bit random IV and canonical AAD bound to nextVersion
    const encryptedPayload = await encryptionService.encrypt(
      currentPlaintextContent,
      newNoteKey,
      noteId,
      nextVersion
    );

    // 3. Wrap K2 under owner's Device Root Key via AES-KW
    const rootKey = await keyManagementService.getOrInitializeDeviceRootKey();
    const wrappedNoteKeyForOwner = await keyManagementService.wrapNoteKey(newNoteKey, rootKey);

    // 4. Generate fresh key envelopes for all authorized remaining recipients
    const keyEnvelopes: KeyEnvelopePayload[] = [];

    for (const recipient of remainingRecipients) {
      const recipientPublicKey = await identityKeyService.importPeerPublicKey(recipient.publicKeyJwk);

      const envelope = await envelopeCryptoService.createEnvelope(
        newNoteKey,
        recipientPublicKey,
        recipient.userId,
        noteId,
        recipient.role,
        nextVersion,
        recipient.keyId || 'primary'
      );

      keyEnvelopes.push(envelope);
    }

    return {
      noteId,
      version: nextVersion,
      baseVersion: currentVersion,
      ciphertext: encryptedPayload.ciphertext,
      iv: encryptedPayload.iv,
      aad: encryptedPayload.aad,
      wrappedNoteKeyForOwner,
      keyEnvelopes,
      newNoteKey,
    };
  }
}

export const rekeyService = new RekeyService();
