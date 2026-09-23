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
import { identityKeyService, IdentityKeyPair, validateP256PublicJwk } from '../crypto/identityKeys';
import { envelopeCryptoService } from '../crypto/sharing';
import { rekeyService, AuthorizedRecipient } from '../crypto/rekeyService';
import { apiClient } from './api/client';
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
import {
  getRemoteNote,
  createRemoteNote,
  updateRemoteNote,
  RemoteEncryptedNoteResponse,
} from './api/notesApi';
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

  /**
   * Development-only key re-registration/reset mechanism.
   * Generates a new valid P-256 key pair via WebCrypto for demo users (dev, bob, carol)
   * in the local Protected Local Vault and registers ONLY the exported public JWK with the backend.
   * Private keys remain strictly client-side.
   */
  async resetDemoIdentityKeys(): Promise<void> {
    const demoUsers = [
      { id: 'user-bob', email: 'bob@cipherflow.com' },
      { id: 'user-carol', email: 'carol@cipherflow.com' },
      { id: 'user-dev', email: 'dev@cipherflow.com' },
    ];

    for (const demo of demoUsers) {
      try {
        // 1. Obtain dev token for this demo user
        const tokenRes = await apiClient.post<{ accessToken?: string; access_token?: string }>(
          '/api/v1/auth/dev-token',
          { email: demo.email }
        );
        const token = tokenRes.accessToken || tokenRes.access_token;

        // 2. Generate a valid P-256 key pair using WebCrypto
        const keyPair = await identityKeyService.generateFreshIdentityKey(demo.id);

        // Validate public key structure before registration
        validateP256PublicJwk(keyPair.publicKeyJwk);

        // 3. Register ONLY the public key JWK with backend
        await apiClient.post(
          `/api/v1/users/${encodeURIComponent(demo.id)}/public-key`,
          {
            publicKeyJwk: keyPair.publicKeyJwk,
            algorithm: 'ECDH-P256',
            version: 1,
            keyId: `key-${demo.id}-1`,
          },
          token ? { Authorization: `Bearer ${token}` } : undefined
        );

        console.info(`[SharingService] Registered valid WebCrypto P-256 public key for ${demo.email}`);
      } catch (err) {
        console.warn(`[SharingService] Notice during demo identity key registration for ${demo.email}:`, err);
      }
    }
  }

  /**
   * Ensures that demo collaborators (Bob and Carol) have valid P-256 public keys registered.
   * If missing or malformed, generates and registers fresh valid keys.
   */
  async ensureDemoIdentitiesInitialized(): Promise<void> {
    const demoUsers = ['user-bob', 'user-carol'];
    let needsReset = false;

    for (const uid of demoUsers) {
      try {
        const record = await fetchUserPublicKey(uid);
        validateP256PublicJwk(record.publicKeyJwk);
      } catch {
        needsReset = true;
        break;
      }
    }

    if (needsReset) {
      console.info('[SharingService] Initializing valid WebCrypto demo identity keys...');
      await this.resetDemoIdentityKeys();
    }
  }

  async searchUsers(query: string): Promise<CollaboratorSearchResult[]> {
    try {
      await this.ensureDemoIdentitiesInitialized();
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
   * Precondition: Ensures the note is canonically synchronized with the backend
   * before cryptographic envelope creation and sharing.
   * Returns the authoritative backend record and version.
   */
  async ensureNoteSynchronized(noteId: string): Promise<RemoteEncryptedNoteResponse> {
    // 1. Load local encrypted note & metadata
    const encryptedNote = await indexedDbService.getEncryptedNote(noteId);
    const metadata = await indexedDbService.getMetadata(noteId);
    if (!encryptedNote || !metadata) {
      throw new Error(`Note "${noteId}" not found in local Protected Vault.`);
    }

    // 2. Canonical noteId validation (Section 3)
    if (!noteId || typeof noteId !== 'string' || noteId.trim() === '') {
      throw new Error('Invalid canonical note identifier.');
    }

    const noteMetadataPayload = {
      title: metadata.title || 'Untitled Note',
      description: metadata.description || '',
      tags: metadata.tags || [],
      spaceId: metadata.spaceId,
      isFavorite: metadata.isFavorite || false,
      isPinned: metadata.isPinned || false,
    };

    // 3. Check backend note existence (Section 2)
    let remoteRecord: RemoteEncryptedNoteResponse | null = null;
    try {
      remoteRecord = await getRemoteNote(noteId);
    } catch (err: any) {
      if (err?.status !== 404) {
        throw err;
      }
      // Note not found on server (404)
      remoteRecord = null;
    }

    // 4. If note does not exist remotely, upload encrypted record first (Section 4)
    if (!remoteRecord) {
      console.info(`[SharingService] Note "${noteId}" not present on server. Synchronizing encrypted version first...`);
      remoteRecord = await createRemoteNote({
        noteId: encryptedNote.noteId,
        version: encryptedNote.version || 1,
        ciphertext: encryptedNote.ciphertext,
        iv: encryptedNote.iv,
        wrappedNoteKey: encryptedNote.wrappedNoteKey,
        aad: encryptedNote.aad,
        metadata: noteMetadataPayload,
      });

      // Update local storage sync state
      encryptedNote.syncStatus = 'synced';
      encryptedNote.remoteVersion = remoteRecord.version;
      encryptedNote.lastSyncedAt = remoteRecord.updatedAt;
      await indexedDbService.saveEncryptedNote(encryptedNote);

      metadata.syncStatus = 'synced';
      metadata.remoteVersion = remoteRecord.version;
      await indexedDbService.saveMetadata(metadata);
    } else {
      // Note exists remotely - verify version alignment (Section 5)
      if (remoteRecord.version !== encryptedNote.version) {
        if (encryptedNote.syncStatus === 'pending_update') {
          console.info(`[SharingService] Pushing pending local updates for note "${noteId}" before sharing...`);
          remoteRecord = await updateRemoteNote(noteId, {
            version: remoteRecord.version + 1,
            baseVersion: remoteRecord.version,
            ciphertext: encryptedNote.ciphertext,
            iv: encryptedNote.iv,
            wrappedNoteKey: encryptedNote.wrappedNoteKey,
            aad: encryptedNote.aad,
            metadata: noteMetadataPayload,
          });

          encryptedNote.version = remoteRecord.version;
          encryptedNote.syncStatus = 'synced';
          encryptedNote.remoteVersion = remoteRecord.version;
          encryptedNote.lastSyncedAt = remoteRecord.updatedAt;
          await indexedDbService.saveEncryptedNote(encryptedNote);

          metadata.remoteVersion = remoteRecord.version;
          metadata.syncStatus = 'synced';
          await indexedDbService.saveMetadata(metadata);
        } else {
          // Unresolved version conflict
          throw new Error(
            `Version conflict: Local vault version (${encryptedNote.version}) does not match server version (${remoteRecord.version}). Please refresh and sync before sharing.`
          );
        }
      }
    }

    // Section 1: Development-only logging
    // NEVER log plaintext note content or encryption keys.
    console.debug('SHARING DEBUG', {
      noteId: noteId,
      noteTitle: metadata.title,
      localNoteId: encryptedNote.noteId,
      backendNoteId: remoteRecord.noteId,
      currentVersion: remoteRecord.version,
    });

    return remoteRecord;
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

    // 2. Precondition: Ensure note exists remotely and obtain authoritative backend version (Section 2, 4, 5)
    const authoritativeRemoteNote = await this.ensureNoteSynchronized(noteId);

    // 3. Fetch recipient's public key with validation (Section 6)
    let recipientPubKeyRecord: PublicKeyRecord;
    try {
      recipientPubKeyRecord = await fetchUserPublicKey(recipientUserId);
      validateP256PublicJwk(recipientPubKeyRecord.publicKeyJwk);
    } catch (fetchErr) {
      if (recipientUserId === 'user-bob' || recipientUserId === 'user-carol') {
        console.info(`[SharingService] Resetting demo user identity key for ${recipientUserId}...`);
        await this.resetDemoIdentityKeys();
        recipientPubKeyRecord = await fetchUserPublicKey(recipientUserId);
        validateP256PublicJwk(recipientPubKeyRecord.publicKeyJwk);
      } else {
        throw new Error('Recipient identity key is invalid or not registered.');
      }
    }

    const peerPublicKey = await identityKeyService.importPeerPublicKey(recipientPubKeyRecord.publicKeyJwk);

    // 4. Fetch note from local vault
    const encryptedNote = await indexedDbService.getEncryptedNote(noteId);
    const metadata = await indexedDbService.getMetadata(noteId);
    if (!encryptedNote || !metadata) {
      throw new Error(`Note ${noteId} not found in local vault.`);
    }

    // 5. Unwrap current note key using Device Root Key
    const rootKey = await keyManagementService.getOrInitializeDeviceRootKey();
    const noteKey = await keyManagementService.unwrapNoteKey(
      encryptedNote.wrappedNoteKey,
      rootKey
    );

    // 6. Create sealed envelope using authoritative backend version (Section 7)
    const upperRole = role.toUpperCase() as 'VIEWER' | 'EDITOR';
    const envelope = await envelopeCryptoService.createEnvelope(
      noteKey,
      peerPublicKey,
      recipientUserId,
      noteId,
      upperRole,
      authoritativeRemoteNote.version,
      recipientPubKeyRecord.keyId
    );

    // 7. Transmit sealed envelope to backend (Section 8)
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
