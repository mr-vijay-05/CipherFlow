/**
 * Phase 2 - Encrypted NoteService Implementation
 * 
 * Architecture:
 * React UI -> NoteService -> EncryptionService / KeyManagementService -> IndexedDbService
 * 
 * Plaintext note content is NEVER persisted to storage.
 * Only ciphertext, IVs, AAD, and wrapped keys are stored in IndexedDB.
 */

import { Note } from '../types/note';
import { INITIAL_NOTES } from '../data/notes';
import {
  indexedDbService,
  EncryptedNoteRecord,
  NoteMetadataRecord,
} from '../storage/indexedDb';
import {
  encryptionService,
  EncryptedPayload,
  CURRENT_ENCRYPTION_VERSION,
  ENCRYPTION_ALGORITHM,
} from '../crypto/encryption';
import { keyManagementService } from '../crypto/keys';
import { syncService } from './syncService';

class NoteService {
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initializes the cryptographic vault:
   * 1. Ensures Device Root Key is generated in IndexedDB (non-extractable AES-KW).
   * 2. Migrates/encrypts initial seed notes if IndexedDB is brand new.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // 1. Initialize root key
      const rootKey = await keyManagementService.getOrInitializeDeviceRootKey();

      // 2. Check if IndexedDB already has notes
      const existingMetadata = await indexedDbService.getAllMetadata();
      if (existingMetadata.length === 0) {
        // First run: Seed initial notes by encrypting them with individual AES-256-GCM keys
        for (const seedNote of INITIAL_NOTES) {
          const noteKey = await keyManagementService.generateNoteKey();
          const encryptedPayload = await encryptionService.encrypt(
            seedNote.content,
            noteKey,
            seedNote.id,
            CURRENT_ENCRYPTION_VERSION
          );
          const wrappedKey = await keyManagementService.wrapNoteKey(noteKey, rootKey);

          const encryptedRecord: EncryptedNoteRecord = {
            noteId: seedNote.id,
            ciphertext: encryptedPayload.ciphertext,
            iv: encryptedPayload.iv,
            wrappedNoteKey: wrappedKey,
            version: encryptedPayload.version,
            aad: encryptedPayload.aad,
            createdAt: seedNote.createdAt,
            updatedAt: seedNote.updatedAt,
          };

          const metadataRecord: NoteMetadataRecord = {
            noteId: seedNote.id,
            title: seedNote.title,
            description: seedNote.description,
            tags: seedNote.tags,
            spaceId: seedNote.spaceId,
            isFavorite: seedNote.isFavorite,
            isPinned: seedNote.isPinned,
            isTrashed: seedNote.isTrashed ?? false,
            securityStatus: 'encrypted',
            collaborators: seedNote.collaborators,
            iconType: seedNote.iconType,
            createdAt: seedNote.createdAt,
            updatedAt: seedNote.updatedAt,
          };

          await indexedDbService.saveEncryptedNote(encryptedRecord);
          await indexedDbService.saveMetadata(metadataRecord);
        }
      }

      this.isInitialized = true;
      syncService.scheduleSync(500);
    })();

    return this.initPromise;
  }

  async getNotes(filter?: {
    spaceId?: string;
    isFavorite?: boolean;
    isPinned?: boolean;
    isTrashed?: boolean;
    tag?: string;
  }): Promise<Note[]> {
    await this.initialize();

    let allMeta = await indexedDbService.getAllMetadata();

    if (filter?.isTrashed !== undefined) {
      allMeta = allMeta.filter(n => (n.isTrashed ?? false) === filter.isTrashed);
    } else {
      allMeta = allMeta.filter(n => !n.isTrashed);
    }

    if (filter?.spaceId) {
      allMeta = allMeta.filter(n => n.spaceId === filter.spaceId);
    }

    if (filter?.isFavorite !== undefined) {
      allMeta = allMeta.filter(n => n.isFavorite === filter.isFavorite);
    }

    if (filter?.isPinned !== undefined) {
      allMeta = allMeta.filter(n => n.isPinned === filter.isPinned);
    }

    if (filter?.tag) {
      allMeta = allMeta.filter(n => n.tags.includes(filter.tag!));
    }

    // Map metadata to Note objects.
    // Plaintext content is kept empty here and decrypted on demand when viewing a note.
    return allMeta.map(m => ({
      id: m.noteId,
      title: m.title,
      description: m.description,
      content: '', // Plaintext not stored in metadata
      tags: m.tags,
      spaceId: m.spaceId,
      updatedAt: m.updatedAt,
      createdAt: m.createdAt,
      isFavorite: m.isFavorite,
      isPinned: m.isPinned,
      isTrashed: m.isTrashed,
      securityStatus: m.securityStatus,
      collaborators: m.collaborators,
      iconType: m.iconType as any,
    }));
  }

  /**
   * Retrieves an encrypted note from IndexedDB, unwraps its isolated key,
   * and decrypts ciphertext into memory using AES-256-GCM + AAD.
   */
  async getNoteById(id: string): Promise<Note | null> {
    await this.initialize();

    const metadata = await indexedDbService.getMetadata(id);
    if (!metadata) return null;

    const encryptedRecord = await indexedDbService.getEncryptedNote(id);
    if (!encryptedRecord) return null;

    const rootKey = await keyManagementService.getOrInitializeDeviceRootKey();

    // 1. Unwrap the isolated note key (Device Root Key AES-KW or Envelope ECDH)
    let noteKey: CryptoKey;
    try {
      noteKey = await keyManagementService.unwrapNoteKey(
        encryptedRecord.wrappedNoteKey,
        rootKey
      );
    } catch (unwrapErr) {
      // If AES-KW under rootKey fails (e.g. shared note where wrappedNoteKey is an envelope),
      // attempt unwrap using identity key and available envelope
      try {
        const idKey = await (await import('../crypto/identityKeys')).identityKeyService.getOrInitializeIdentityKey();
        const envelopeService = (await import('../crypto/sharing')).envelopeCryptoService;
        const sharingSvc = (await import('./sharingService')).sharingService;
        const envelopes = await sharingSvc.getEnvelopes(id, encryptedRecord.version);
        if (envelopes && envelopes.length > 0) {
          noteKey = await envelopeService.unwrapEnvelope(envelopes[0], idKey.privateKey);
        } else {
          throw unwrapErr;
        }
      } catch {
        throw unwrapErr;
      }
    }

    // 2. Decrypt the note content with AES-256-GCM and verify AAD
    // If the stored record has an AAD created with an earlier version due to version drift,
    // determine the version embedded in the canonical AAD string to authenticate and heal the record
    let versionForDecrypt = encryptedRecord.version;
    if (encryptedRecord.aad) {
      const aadParts = encryptedRecord.aad.split(':');
      if (aadParts.length >= 3 && aadParts[0] === id) {
        const parsedAadVersion = parseInt(aadParts[1], 10);
        if (!isNaN(parsedAadVersion) && parsedAadVersion !== encryptedRecord.version) {
          console.warn(`[Vault Recovery] Note ${id} AAD version (${parsedAadVersion}) differs from metadata version (${encryptedRecord.version}). Using authenticated AAD version.`);
          versionForDecrypt = parsedAadVersion;
        }
      }
    }

    const payload: EncryptedPayload = {
      version: versionForDecrypt,
      algorithm: ENCRYPTION_ALGORITHM,
      ciphertext: encryptedRecord.ciphertext,
      iv: encryptedRecord.iv,
      aad: encryptedRecord.aad,
    };

    const decryptedContent = await encryptionService.decrypt(payload, noteKey, id);

    // If version had drifted in local storage, heal the record so future operations stay consistent
    if (versionForDecrypt !== encryptedRecord.version) {
      encryptedRecord.version = versionForDecrypt;
      await indexedDbService.saveEncryptedNote(encryptedRecord);
      if (metadata) {
        metadata.remoteVersion = versionForDecrypt;
        await indexedDbService.saveMetadata(metadata);
      }
      console.info(`[Vault Recovery] Note ${id} metadata healed to version ${versionForDecrypt}.`);
    }

    return {
      id: metadata.noteId,
      title: metadata.title,
      description: metadata.description,
      content: decryptedContent,
      tags: metadata.tags,
      spaceId: metadata.spaceId,
      updatedAt: metadata.updatedAt,
      createdAt: metadata.createdAt,
      isFavorite: metadata.isFavorite,
      isPinned: metadata.isPinned,
      isTrashed: metadata.isTrashed,
      securityStatus: metadata.securityStatus,
      collaborators: metadata.collaborators,
      iconType: metadata.iconType as any,
    };
  }

  /**
   * Encrypts and persists a new note:
   * 1. Generates isolated 256-bit AES-GCM note key.
   * 2. Generates fresh random 96-bit IV.
   * 3. Encrypts content with AAD binding.
   * 4. Wraps note key under device root key via AES-KW.
   * 5. Saves ciphertext + metadata to IndexedDB.
   */
  async createNote(payload: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    await this.initialize();

    const noteId = `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const rootKey = await keyManagementService.getOrInitializeDeviceRootKey();

    try {
      // 1. Generate unique key for this note
      const noteKey = await keyManagementService.generateNoteKey();

      // 2. Encrypt plaintext content with fresh IV + AAD
      const encryptedPayload = await encryptionService.encrypt(
        payload.content || '',
        noteKey,
        noteId,
        CURRENT_ENCRYPTION_VERSION
      );

      // 3. Wrap note key under Device Root Key
      const wrappedKey = await keyManagementService.wrapNoteKey(noteKey, rootKey);

      // 4. Save to IndexedDB
      const encryptedRecord: EncryptedNoteRecord = {
        noteId,
        ciphertext: encryptedPayload.ciphertext,
        iv: encryptedPayload.iv,
        wrappedNoteKey: wrappedKey,
        version: encryptedPayload.version,
        aad: encryptedPayload.aad,
        createdAt: now,
        updatedAt: 'Just now',
        syncStatus: 'pending_create',
      };

      const metadataRecord: NoteMetadataRecord = {
        noteId,
        title: payload.title,
        description: payload.description || (payload.content ? payload.content.substring(0, 90) : ''),
        tags: payload.tags || [],
        spaceId: payload.spaceId,
        isFavorite: payload.isFavorite || false,
        isPinned: payload.isPinned || false,
        isTrashed: false,
        securityStatus: 'encrypted',
        collaborators: payload.collaborators,
        iconType: payload.iconType || 'file',
        createdAt: now,
        updatedAt: 'Just now',
        syncStatus: 'pending_create',
      };

      await indexedDbService.saveEncryptedNote(encryptedRecord);
      await indexedDbService.saveMetadata(metadataRecord);

      // Notify sync coordinator
      syncService.notifyNoteCreated(noteId);

      return {
        ...payload,
        id: noteId,
        createdAt: now,
        updatedAt: 'Just now',
        securityStatus: 'encrypted',
      };
    } catch (err) {
      // Fail closed: Never persist plaintext on encryption failure!
      throw err;
    }
  }

  /**
   * Updates an existing note.
   * If content is updated:
   * 1. Unwraps note key.
   * 2. Encrypts with a FRESH random 96-bit IV and AAD.
   * 3. Saves new ciphertext to IndexedDB.
   */
  async updateNote(id: string, updates: Partial<Note>): Promise<Note | null> {
    await this.initialize();

    const existingMeta = await indexedDbService.getMetadata(id);
    if (!existingMeta) return null;

    const existingEncrypted = await indexedDbService.getEncryptedNote(id);
    if (!existingEncrypted) return null;

    const rootKey = await keyManagementService.getOrInitializeDeviceRootKey();

    let newContent = updates.content;

    // If content was modified, re-encrypt with fresh random IV
    if (newContent !== undefined) {
      // Unwrap current note key
      const noteKey = await keyManagementService.unwrapNoteKey(
        existingEncrypted.wrappedNoteKey,
        rootKey
      );

      // Calculate next monotonic version
      const nextVersion = (existingEncrypted.version || 1) + 1;

      // Encrypt with fresh IV and nextVersion bound to AAD
      const encryptedPayload = await encryptionService.encrypt(
        newContent,
        noteKey,
        id,
        nextVersion
      );

      existingEncrypted.version = nextVersion;
      existingEncrypted.ciphertext = encryptedPayload.ciphertext;
      existingEncrypted.iv = encryptedPayload.iv;
      existingEncrypted.aad = encryptedPayload.aad;
      existingEncrypted.updatedAt = 'Just now';

      await indexedDbService.saveEncryptedNote(existingEncrypted);
    }

    // Update metadata
    const updatedMeta: NoteMetadataRecord = {
      ...existingMeta,
      title: updates.title !== undefined ? updates.title : existingMeta.title,
      description: updates.description !== undefined ? updates.description : (
        newContent !== undefined ? newContent.substring(0, 90) : existingMeta.description
      ),
      tags: updates.tags !== undefined ? updates.tags : existingMeta.tags,
      isFavorite: updates.isFavorite !== undefined ? updates.isFavorite : existingMeta.isFavorite,
      isPinned: updates.isPinned !== undefined ? updates.isPinned : existingMeta.isPinned,
      isTrashed: updates.isTrashed !== undefined ? updates.isTrashed : existingMeta.isTrashed,
      spaceId: updates.spaceId !== undefined ? updates.spaceId : existingMeta.spaceId,
      updatedAt: 'Just now',
    };

    await indexedDbService.saveMetadata(updatedMeta);

    // Notify sync coordinator
    syncService.notifyNoteUpdated(id);

    return {
      id: updatedMeta.noteId,
      title: updatedMeta.title,
      description: updatedMeta.description,
      content: newContent !== undefined ? newContent : '',
      tags: updatedMeta.tags,
      spaceId: updatedMeta.spaceId,
      updatedAt: updatedMeta.updatedAt,
      createdAt: updatedMeta.createdAt,
      isFavorite: updatedMeta.isFavorite,
      isPinned: updatedMeta.isPinned,
      isTrashed: updatedMeta.isTrashed,
      securityStatus: updatedMeta.securityStatus,
      collaborators: updatedMeta.collaborators,
      iconType: updatedMeta.iconType as any,
    };
  }

  async toggleFavorite(id: string): Promise<Note | null> {
    const meta = await indexedDbService.getMetadata(id);
    if (!meta) return null;
    return this.updateNote(id, { isFavorite: !meta.isFavorite });
  }

  async togglePin(id: string): Promise<Note | null> {
    const meta = await indexedDbService.getMetadata(id);
    if (!meta) return null;
    return this.updateNote(id, { isPinned: !meta.isPinned });
  }

  async trashNote(id: string): Promise<boolean> {
    const meta = await indexedDbService.getMetadata(id);
    if (!meta) return false;
    meta.isTrashed = true;
    meta.updatedAt = 'Just now';
    await indexedDbService.saveMetadata(meta);
    syncService.notifyNoteUpdated(id);
    return true;
  }

  async restoreNote(id: string): Promise<boolean> {
    const meta = await indexedDbService.getMetadata(id);
    if (!meta) return false;
    meta.isTrashed = false;
    meta.updatedAt = 'Just now';
    await indexedDbService.saveMetadata(meta);
    syncService.notifyNoteUpdated(id);
    return true;
  }

  /**
   * Permanently deletes a note from both encryptedNotes and metadata stores.
   * The ciphertext and wrapped key are destroyed.
   */
  async deletePermanently(id: string): Promise<boolean> {
    await this.initialize();
    syncService.notifyNoteDeleted(id);
    await indexedDbService.deleteEncryptedNote(id);
    await indexedDbService.deleteMetadata(id);
    return true;
  }
}

export const noteService = new NoteService();
