/**
 * CipherFlow Phase 4 - Secure Sharing Service
 * 
 * Cryptographic Invariant:
 * "We don't share the note itself. We share controlled cryptographic access to the note's encryption key."
 * 
 * Handles:
 * - ECDH Identity Key registration & retrieval
 * - Ephemeral Key Agreement + Envelope Creation (ECDH-P256-HKDF-AES-GCM)
 * - Cryptographic Key Rotation on Access Revocation (Rekey Service)
 * - Collaborator search and ACL management
 * - Immutable Audit Trail access
 */

import { Note, Collaborator } from '../types/note';
import { noteService } from './noteService';
import { indexedDbService } from '../storage/indexedDb';
import { keyManagementService } from '../crypto/keys';
import { identityKeyService, IdentityKeyPair } from '../crypto/identityKeys';
import { envelopeCryptoService } from '../crypto/sharing';
import { rekeyService, AuthorizedRecipient } from '../crypto/rekeyService';
import {
  registerPublicKey,
  fetchUserPublicKey,
  searchCollaborators,
  createShare,
  listShares,
  updateShare,
  revokeShareRemote,
  rotateNoteKeyRemote,
  fetchKeyEnvelopes,
  fetchNoteAuditEvents,
  fetchUserAuditEvents,
  RemoteShareRecord,
  RemoteAuditEvent,
  CollaboratorSearchResult,
  PublicKeyRecord,
} from './api/sharingApi';
import { getCurrentUser } from './api/authApi';

export class SharingService {
  private currentUserId: string = 'user-dev';

  /**
   * Initializes or returns the client's ECDH P-256 identity key pair.
   * Private key stays in client-side Protected Local Vault.
   * Public key is registered with the FastAPI backend.
   */
  async initializeIdentityKey(userId?: string): Promise<IdentityKeyPair> {
    let uid = userId;
    if (!uid) {
      try {
        const user = await getCurrentUser();
        uid = user.id;
        this.currentUserId = user.id;
      } catch {
        uid = this.currentUserId;
      }
    }

    const keyPair = await identityKeyService.getOrInitializeIdentityKey(uid);

    // Register public key on backend (fail-safe if offline/dev)
    try {
      await registerPublicKey(uid, keyPair.publicKeyJwk, keyPair.keyId);
    } catch (err) {
      console.warn('Backend public key registration deferred or offline:', err);
    }

    return keyPair;
  }

  async getCurrentIdentityKey(): Promise<IdentityKeyPair> {
    return identityKeyService.getOrInitializeIdentityKey(this.currentUserId);
  }

  async searchUsers(query: string): Promise<CollaboratorSearchResult[]> {
    try {
      return await searchCollaborators(query);
    } catch (err) {
      console.warn('Search users failed, fallback empty:', err);
      return [];
    }
  }

  async getSharedNotes(): Promise<Note[]> {
    const notes = await noteService.getNotes();
    return notes.filter(n => n.securityStatus === 'shared' || (n.collaborators && n.collaborators.length > 0));
  }

  async listNoteShares(noteId: string): Promise<RemoteShareRecord[]> {
    try {
      return await listShares(noteId);
    } catch {
      return [];
    }
  }

  /**
   * Shares a note with a recipient:
   * 1. Retrieve recipient's registered public key JWK.
   * 2. Import recipient's public key.
   * 3. Unwrap current note AES-256-GCM key from local vault.
   * 4. Wrap note key into a sealed envelope via ECDH-P256-HKDF-AES-GCM.
   * 5. Post sealed envelope & share record to backend.
   * 6. Update local note metadata with collaborator info.
   */
  async shareNoteWithRecipient(
    noteId: string,
    recipientUserId: string,
    role: 'viewer' | 'editor'
  ): Promise<RemoteShareRecord> {
    // 1. Ensure our own identity key is initialized
    await this.initializeIdentityKey();

    // 2. Fetch recipient's public key
    const recipientPubKeyRecord: PublicKeyRecord = await fetchUserPublicKey(recipientUserId);
    const peerPublicKey = await identityKeyService.importPeerPublicKey(recipientPubKeyRecord.publicKeyJwk);

    // 3. Fetch note from local vault
    const encryptedNote = await indexedDbService.getEncryptedNote(noteId);
    const metadata = await indexedDbService.getMetadata(noteId);
    if (!encryptedNote || !metadata) {
      throw new Error(`Note ${noteId} not found in local vault.`);
    }

    // 4. Unwrap current note key using Device Root Key
    const rootKey = await keyManagementService.getOrInitializeDeviceRootKey();
    const noteKey = await keyManagementService.unwrapNoteKey(
      encryptedNote.wrappedNoteKey,
      rootKey
    );

    // 5. Create sealed envelope
    const upperRole = role.toUpperCase() as 'VIEWER' | 'EDITOR';
    const envelope = await envelopeCryptoService.createEnvelope(
      noteKey,
      peerPublicKey,
      recipientUserId,
      noteId,
      upperRole,
      encryptedNote.version,
      recipientPubKeyRecord.keyId
    );

    // 6. Transmit sealed envelope to backend
    const remoteShare = await createShare(noteId, recipientUserId, upperRole, envelope);

    // 7. Update local metadata
    const currentCollaborators: Collaborator[] = metadata.collaborators || [];
    const existingIndex = currentCollaborators.findIndex(c => c.id === recipientUserId || c.email === recipientUserId);
    
    const collaboratorEntry: Collaborator = {
      id: recipientUserId,
      name: recipientUserId.replace('user-', ''),
      email: recipientUserId.includes('@') ? recipientUserId : `${recipientUserId.replace('user-', '')}@cipherflow.internal`,
      role: role,
      grantedAt: new Date().toISOString(),
    };

    let updatedCollaborators: Collaborator[];
    if (existingIndex >= 0) {
      updatedCollaborators = [...currentCollaborators];
      updatedCollaborators[existingIndex] = collaboratorEntry;
    } else {
      updatedCollaborators = [...currentCollaborators, collaboratorEntry];
    }

    metadata.collaborators = updatedCollaborators;
    metadata.securityStatus = 'shared';
    metadata.updatedAt = 'Just now';
    await indexedDbService.saveMetadata(metadata);

    return remoteShare;
  }

  /**
   * Updates an existing collaborator's role.
   */
  async updateCollaboratorRole(
    noteId: string,
    recipientUserId: string,
    role: 'viewer' | 'editor'
  ): Promise<RemoteShareRecord> {
    const upperRole = role.toUpperCase() as 'VIEWER' | 'EDITOR';
    const updatedRemote = await updateShare(noteId, recipientUserId, upperRole);

    const metadata = await indexedDbService.getMetadata(noteId);
    if (metadata && metadata.collaborators) {
      metadata.collaborators = metadata.collaborators.map(c =>
        c.id === recipientUserId || c.email === recipientUserId ? { ...c, role } : c
      );
      await indexedDbService.saveMetadata(metadata);
    }

    return updatedRemote;
  }

  /**
   * Cryptographic Revocation:
   * 1. Mark share as REVOKED on backend.
   * 2. Fetch current note plaintext locally.
   * 3. Fetch remaining active collaborators and their public keys.
   * 4. Perform cryptographic key rotation (generate K2, fresh IV, bump version, re-encrypt).
   * 5. Generate fresh key envelopes for remaining authorized recipients (revoked user excluded).
   * 6. Commit rotated ciphertext, IV, AAD, and new envelopes to backend.
   * 7. Update local vault with K2.
   * 8. Update local metadata removing revoked collaborator.
   */
  async revokeAccess(
    noteId: string,
    recipientUserId: string
  ): Promise<{ success: boolean; newVersion: number }> {
    // 1. Mark share revoked on server
    try {
      await revokeShareRemote(noteId, recipientUserId);
    } catch (err) {
      console.warn('Backend share revocation warning:', err);
    }

    // 2. Fetch current note plaintext & metadata
    const note = await noteService.getNoteById(noteId);
    const currentEncrypted = await indexedDbService.getEncryptedNote(noteId);
    const metadata = await indexedDbService.getMetadata(noteId);

    if (!note || !currentEncrypted || !metadata) {
      throw new Error(`Note ${noteId} not available for cryptographic revocation.`);
    }

    // 3. Find remaining authorized recipients
    let remainingShares: RemoteShareRecord[] = [];
    try {
      const allShares = await listShares(noteId);
      remainingShares = allShares.filter(
        s => s.status === 'ACTIVE' && s.recipientId !== recipientUserId
      );
    } catch {
      // Fallback to local metadata collaborators if backend unreachable
      const localRemaining = (metadata.collaborators || []).filter(
        c => c.id !== recipientUserId && c.email !== recipientUserId
      );
      remainingShares = localRemaining.map(c => ({
        id: `share-${c.id}`,
        noteId,
        ownerId: this.currentUserId,
        recipientId: c.id,
        role: c.role.toUpperCase() as any,
        status: 'ACTIVE',
        createdAt: c.grantedAt,
        updatedAt: c.grantedAt,
      }));
    }

    // 4. Retrieve public keys for remaining authorized recipients
    const authorizedRecipients: AuthorizedRecipient[] = [];
    for (const share of remainingShares) {
      try {
        const pubKeyRecord = await fetchUserPublicKey(share.recipientId);
        authorizedRecipients.push({
          userId: share.recipientId,
          role: share.role,
          publicKeyJwk: pubKeyRecord.publicKeyJwk,
          keyId: pubKeyRecord.keyId,
        });
      } catch (err) {
        console.warn(`Could not fetch public key for remaining recipient ${share.recipientId}:`, err);
      }
    }

    // 5. Cryptographic Rekey: Generate fresh K2, fresh IV, bump version, re-encrypt locally
    const rekeyResult = await rekeyService.rotateNoteKey(
      noteId,
      note.content,
      currentEncrypted.version,
      authorizedRecipients,
      this.currentUserId
    );

    // 6. Persist K2 locally in Protected Local Vault
    currentEncrypted.version = rekeyResult.version;
    currentEncrypted.ciphertext = rekeyResult.ciphertext;
    currentEncrypted.iv = rekeyResult.iv;
    currentEncrypted.aad = rekeyResult.aad;
    currentEncrypted.wrappedNoteKey = rekeyResult.wrappedNoteKeyForOwner;
    currentEncrypted.updatedAt = 'Just now';
    await indexedDbService.saveEncryptedNote(currentEncrypted);

    // 7. Commit new rotated encrypted payload & fresh envelopes to backend
    try {
      await rotateNoteKeyRemote(noteId, {
        version: rekeyResult.version,
        baseVersion: rekeyResult.baseVersion,
        ciphertext: rekeyResult.ciphertext,
        iv: rekeyResult.iv,
        aad: rekeyResult.aad,
        envelopes: rekeyResult.keyEnvelopes,
      });
    } catch (err) {
      console.warn('Backend key rotation commit warning:', err);
    }

    // 8. Update local metadata
    const updatedCollaborators = (metadata.collaborators || []).filter(
      c => c.id !== recipientUserId && c.email !== recipientUserId
    );
    metadata.collaborators = updatedCollaborators;
    metadata.securityStatus = updatedCollaborators.length > 0 ? 'shared' : 'encrypted';
    metadata.updatedAt = 'Just now';
    await indexedDbService.saveMetadata(metadata);

    return {
      success: true,
      newVersion: rekeyResult.version,
    };
  }

  async getAuditTrail(noteId?: string): Promise<RemoteAuditEvent[]> {
    try {
      if (noteId) {
        return await fetchNoteAuditEvents(noteId);
      }
      return await fetchUserAuditEvents();
    } catch (err) {
      console.warn('Audit trail retrieval failed:', err);
      return [];
    }
  }

  async getEnvelopes(noteId: string, version?: number) {
    try {
      return await fetchKeyEnvelopes(noteId, version);
    } catch {
      return [];
    }
  }
}

export const sharingService = new SharingService();
