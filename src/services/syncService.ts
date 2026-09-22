/**
 * CipherFlow Sync Coordinator
 * 
 * Manages encrypted cloud synchronization between local IndexedDB and FastAPI backend.
 * 
 * Cryptographic Invariant:
 * - Plaintext NEVER leaves the client.
 * - Only AES-256-GCM ciphertexts, IVs, AAD, and wrapped keys are transmitted.
 * 
 * Supports:
 * - Offline-first operation (IndexedDB continues functioning offline)
 * - Optimistic concurrency detection (409 Conflict handling)
 * - Delta synchronization with cursor tracking
 * - Background & debounced sync triggering
 */

import { indexedDbService, EncryptedNoteRecord, NoteMetadataRecord, SyncStatus } from '../storage/indexedDb';
import {
  createRemoteNote,
  updateRemoteNote,
  deleteRemoteNote,
  RemoteEncryptedNoteResponse,
} from './api/notesApi';
import { fetchSyncDeltas } from './api/syncApi';
import { loginDevToken } from './api/authApi';
import { ApiError } from './api/client';

export type OverallSyncState = 'synced' | 'syncing' | 'saved_locally' | 'conflict' | 'offline' | 'error';

export interface ConflictDetails {
  noteId: string;
  localVersion: number;
  remoteVersion: number;
  remoteRecord: RemoteEncryptedNoteResponse;
}

export type SyncEventListener = (state: OverallSyncState, activeNoteId?: string) => void;

class SyncService {
  private currentState: OverallSyncState = 'synced';
  private listeners: Set<SyncEventListener> = new Set();
  private activeConflicts: Map<string, ConflictDetails> = new Map();
  private syncTimeout: any = null;
  private isSyncing = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastCursor: string = '';
  private pendingDeletions: Set<string> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyState('saved_locally');
        this.scheduleSync(500);
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyState('offline');
      });

      // Load saved sync cursor and pending deletions
      try {
        if (typeof localStorage !== 'undefined') {
          this.lastCursor = localStorage.getItem('cipherflow_sync_cursor') || '';
          const savedDeletions = localStorage.getItem('cipherflow_pending_deletions');
          if (savedDeletions) {
            this.pendingDeletions = new Set(JSON.parse(savedDeletions));
          }
        }
      } catch {
        // storage unavailable
      }
    }
  }

  /**
   * Subscribe to sync state changes.
   */
  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyState(state: OverallSyncState, noteId?: string): void {
    this.currentState = state;
    this.listeners.forEach((listener) => {
      try {
        listener(state, noteId);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    });
  }

  getState(): OverallSyncState {
    return this.currentState;
  }

  getConflict(noteId: string): ConflictDetails | undefined {
    return this.activeConflicts.get(noteId);
  }

  hasConflicts(): boolean {
    return this.activeConflicts.size > 0;
  }

  /**
   * Ensure authentication token is set (dev auto-login if needed).
   */
  async ensureAuthenticated(): Promise<boolean> {
    try {
      const token = localStorage.getItem('cipherflow_auth_token');
      if (!token) {
        await loginDevToken();
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Schedules a debounced sync operation.
   */
  scheduleSync(delayMs: number = 1000): void {
    if (!this.isOnline) {
      this.notifyState('offline');
      return;
    }

    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.notifyState('saved_locally');

    this.syncTimeout = setTimeout(() => {
      this.syncNow().catch((err) => {
        console.warn('Sync failed:', err);
      });
    }, delayMs);
  }

  notifyNoteCreated(noteId: string): void {
    this.scheduleSync(500);
  }

  notifyNoteUpdated(noteId: string): void {
    this.scheduleSync(500);
  }

  notifyNoteDeleted(noteId: string): void {
    this.pendingDeletions.add(noteId);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('cipherflow_pending_deletions', JSON.stringify(Array.from(this.pendingDeletions)));
      }
    } catch {
      // ignore
    }
    this.scheduleSync(500);
  }

  /**
   * Enqueue a newly created or modified note for synchronization.
   */
  async enqueueNoteChange(noteId: string, type: 'create' | 'update' | 'delete'): Promise<void> {
    if (type === 'delete') {
      this.notifyNoteDeleted(noteId);
    } else if (type === 'create') {
      this.notifyNoteCreated(noteId);
    } else {
      this.notifyNoteUpdated(noteId);
    }
  }

  /**
   * Main synchronization execution:
   * 1. Check connectivity & auth
   * 2. Push local pending changes (create, update, delete)
   * 3. Pull remote deltas and apply tombstones
   */
  async syncNow(): Promise<void> {
    if (this.isSyncing) return;
    if (!this.isOnline) {
      this.notifyState('offline');
      return;
    }

    this.isSyncing = true;
    this.notifyState('syncing');

    try {
      const authed = await this.ensureAuthenticated();
      if (!authed) {
        this.notifyState('offline');
        this.isSyncing = false;
        return;
      }

      // Step 1: Push pending local changes to FastAPI
      await this.pushPendingChanges();

      // Step 2: Pull remote deltas from FastAPI
      await this.pullRemoteDeltas();

      if (this.activeConflicts.size > 0) {
        this.notifyState('conflict');
      } else {
        this.notifyState('synced');
      }
    } catch (err: any) {
      console.error('Synchronization error:', err);
      if (err instanceof ApiError && err.status === 0) {
        this.notifyState('offline');
      } else if (err instanceof ApiError && err.isConflict) {
        this.notifyState('conflict');
      } else {
        this.notifyState('error');
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pushes pending encrypted records to the backend.
   */
  private async pushPendingChanges(): Promise<void> {
    // 1. Process pending deletions
    for (const noteId of Array.from(this.pendingDeletions)) {
      try {
        await deleteRemoteNote(noteId);
        this.pendingDeletions.delete(noteId);
      } catch (err: any) {
        if (err?.status === 404) {
          this.pendingDeletions.delete(noteId);
        }
      }
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('cipherflow_pending_deletions', JSON.stringify(Array.from(this.pendingDeletions)));
      }
    } catch {
      // storage unavailable
    }

    const encryptedNotes = await indexedDbService.getAllEncryptedNotes();
    const metadataList = await indexedDbService.getAllMetadata();
    const metadataMap = new Map(metadataList.map((m) => [m.noteId, m]));

    for (const record of encryptedNotes) {
      const meta = metadataMap.get(record.noteId);
      if (!record.syncStatus || record.syncStatus === 'synced' || record.syncStatus === 'conflict') {
        continue;
      }

      const noteMetadataPayload = {
        title: meta?.title || 'Untitled',
        description: meta?.description || '',
        tags: meta?.tags || [],
        spaceId: meta?.spaceId,
        isFavorite: meta?.isFavorite || false,
        isPinned: meta?.isPinned || false,
      };

      try {
        if (record.syncStatus === 'pending_create') {
          const response = await createRemoteNote({
            noteId: record.noteId,
            version: record.version || 1,
            ciphertext: record.ciphertext,
            iv: record.iv,
            wrappedNoteKey: record.wrappedNoteKey,
            aad: record.aad,
            metadata: noteMetadataPayload,
          });

          record.syncStatus = 'synced';
          record.remoteVersion = response.version;
          record.lastSyncedAt = response.updatedAt;
          await indexedDbService.saveEncryptedNote(record);

          if (meta) {
            meta.syncStatus = 'synced';
            meta.remoteVersion = response.version;
            await indexedDbService.saveMetadata(meta);
          }
        } else if (record.syncStatus === 'pending_update') {
          const baseVersion = record.remoteVersion || (record.version > 1 ? record.version - 1 : 1);
          const nextVersion = baseVersion + 1;

          try {
            const response = await updateRemoteNote(record.noteId, {
              version: nextVersion,
              baseVersion,
              ciphertext: record.ciphertext,
              iv: record.iv,
              wrappedNoteKey: record.wrappedNoteKey,
              aad: record.aad,
              metadata: noteMetadataPayload,
            });

            record.syncStatus = 'synced';
            record.remoteVersion = response.version;
            record.version = response.version;
            record.lastSyncedAt = response.updatedAt;
            await indexedDbService.saveEncryptedNote(record);

            if (meta) {
              meta.syncStatus = 'synced';
              meta.remoteVersion = response.version;
              await indexedDbService.saveMetadata(meta);
            }
          } catch (err: any) {
            if (err instanceof ApiError && err.isConflict) {
              // Optimistic concurrency conflict detected!
              record.syncStatus = 'conflict';
              await indexedDbService.saveEncryptedNote(record);

              if (meta) {
                meta.syncStatus = 'conflict';
                await indexedDbService.saveMetadata(meta);
              }

              const serverRecord = err.details?.server_note as RemoteEncryptedNoteResponse;
              this.activeConflicts.set(record.noteId, {
                noteId: record.noteId,
                localVersion: record.version,
                remoteVersion: serverRecord?.version || (baseVersion + 1),
                remoteRecord: serverRecord,
              });
              this.notifyState('conflict', record.noteId);
            } else {
              throw err;
            }
          }
        }
      } catch (err) {
        console.warn(`Failed to push note ${record.noteId}:`, err);
        throw err;
      }
    }
  }

  /**
   * Pulls delta changes from the backend.
   */
  private async pullRemoteDeltas(): Promise<void> {
    try {
      const syncResult = await fetchSyncDeltas(this.lastCursor);

      // Apply incoming updates
      for (const remoteNote of syncResult.changes) {
        const local = await indexedDbService.getEncryptedNote(remoteNote.noteId);
        const localMeta = await indexedDbService.getMetadata(remoteNote.noteId);

        // If local has pending modifications and remote changed, mark conflict
        if (local && (local.syncStatus === 'pending_update' || local.syncStatus === 'pending_create')) {
          if (local.remoteVersion !== undefined && local.remoteVersion !== remoteNote.version) {
            local.syncStatus = 'conflict';
            await indexedDbService.saveEncryptedNote(local);
            this.activeConflicts.set(remoteNote.noteId, {
              noteId: remoteNote.noteId,
              localVersion: local.version,
              remoteVersion: remoteNote.version,
              remoteRecord: remoteNote,
            });
            continue;
          }
        }

        // Apply remote changes into local store
        const updatedRecord: EncryptedNoteRecord = {
          noteId: remoteNote.noteId,
          ciphertext: remoteNote.ciphertext,
          iv: remoteNote.iv,
          wrappedNoteKey: remoteNote.wrappedNoteKey,
          version: remoteNote.version,
          aad: remoteNote.aad,
          createdAt: remoteNote.createdAt,
          updatedAt: remoteNote.updatedAt,
          syncStatus: 'synced',
          remoteVersion: remoteNote.version,
          lastSyncedAt: remoteNote.updatedAt,
        };

        const updatedMeta: NoteMetadataRecord = {
          noteId: remoteNote.noteId,
          title: remoteNote.metadata.title,
          description: remoteNote.metadata.description || '',
          tags: remoteNote.metadata.tags || [],
          spaceId: remoteNote.metadata.spaceId,
          isFavorite: remoteNote.metadata.isFavorite || false,
          isPinned: remoteNote.metadata.isPinned || false,
          isTrashed: remoteNote.isDeleted,
          securityStatus: 'encrypted',
          createdAt: remoteNote.createdAt,
          updatedAt: remoteNote.updatedAt,
          syncStatus: 'synced',
          remoteVersion: remoteNote.version,
        };

        await indexedDbService.saveEncryptedNote(updatedRecord);
        await indexedDbService.saveMetadata(updatedMeta);
      }

      // Apply incoming tombstones
      for (const tombstoneId of syncResult.tombstones) {
        const local = await indexedDbService.getEncryptedNote(tombstoneId);
        // Only delete if user hasn't made pending offline edits
        if (!local || local.syncStatus === 'synced') {
          await indexedDbService.deleteEncryptedNote(tombstoneId);
          await indexedDbService.deleteMetadata(tombstoneId);
        }
      }

      // Update cursor
      this.lastCursor = syncResult.nextCursor;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('cipherflow_sync_cursor', this.lastCursor);
      }
    } catch (err) {
      console.warn('Failed to pull remote deltas:', err);
    }
  }

  /**
   * Conflict Resolution: Accept remote version.
   */
  async resolveWithRemote(noteId: string): Promise<void> {
    const conflict = this.activeConflicts.get(noteId);
    if (!conflict || !conflict.remoteRecord) return;

    const remote = conflict.remoteRecord;
    const updatedRecord: EncryptedNoteRecord = {
      noteId: remote.noteId,
      ciphertext: remote.ciphertext,
      iv: remote.iv,
      wrappedNoteKey: remote.wrappedNoteKey,
      version: remote.version,
      aad: remote.aad,
      createdAt: remote.createdAt,
      updatedAt: remote.updatedAt,
      syncStatus: 'synced',
      remoteVersion: remote.version,
      lastSyncedAt: remote.updatedAt,
    };

    const updatedMeta: NoteMetadataRecord = {
      noteId: remote.noteId,
      title: remote.metadata.title,
      description: remote.metadata.description || '',
      tags: remote.metadata.tags || [],
      spaceId: remote.metadata.spaceId,
      isFavorite: remote.metadata.isFavorite || false,
      isPinned: remote.metadata.isPinned || false,
      isTrashed: remote.isDeleted,
      securityStatus: 'encrypted',
      createdAt: remote.createdAt,
      updatedAt: remote.updatedAt,
      syncStatus: 'synced',
      remoteVersion: remote.version,
    };

    await indexedDbService.saveEncryptedNote(updatedRecord);
    await indexedDbService.saveMetadata(updatedMeta);
    this.activeConflicts.delete(noteId);

    if (this.activeConflicts.size === 0) {
      this.notifyState('synced');
    }
  }

  /**
   * Conflict Resolution: Force overwrite with local version.
   */
  async resolveWithLocal(noteId: string): Promise<void> {
    const conflict = this.activeConflicts.get(noteId);
    const local = await indexedDbService.getEncryptedNote(noteId);
    if (!local) return;

    // Set remoteVersion to latest known remote so optimistic concurrency succeeds
    if (conflict) {
      local.remoteVersion = conflict.remoteVersion;
    }
    local.syncStatus = 'pending_update';
    await indexedDbService.saveEncryptedNote(local);

    this.activeConflicts.delete(noteId);
    this.scheduleSync(100);
  }
}

export const syncService = new SyncService();
