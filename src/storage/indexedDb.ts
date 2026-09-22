/**
 * IndexedDB storage abstraction for CipherFlow.
 * Manages encrypted note records, wrapped keys, and non-extractable CryptoKey storage.
 * Note content is NEVER stored unencrypted.
 */

export type SyncStatus = 'synced' | 'pending_create' | 'pending_update' | 'pending_delete' | 'conflict';

export interface EncryptedNoteRecord {
  noteId: string;
  ciphertext: string; // Base64 encoded AES-256-GCM ciphertext + tag
  iv: string; // Base64 encoded 96-bit IV
  wrappedNoteKey: string; // Base64 encoded AES-KW wrapped note key
  version: number;
  aad: string; // Plaintext canonical AAD representation
  createdAt: string;
  updatedAt: string;
  // Phase 3 Sync metadata
  syncStatus?: SyncStatus;
  remoteVersion?: number;
  lastSyncedAt?: string;
}

export interface NoteMetadataRecord {
  noteId: string;
  title: string;
  description: string;
  tags: string[];
  spaceId?: string;
  isFavorite: boolean;
  isPinned: boolean;
  isTrashed?: boolean;
  securityStatus: 'encrypted' | 'shared' | 'locked';
  collaborators?: any[];
  iconType?: string;
  createdAt: string;
  updatedAt: string;
  // Phase 3 Sync metadata
  syncStatus?: SyncStatus;
  remoteVersion?: number;
}

export interface StoredCryptoKey {
  id: string;
  key: CryptoKey;
  version: number;
  createdAt: string;
}

const DB_NAME = 'cipherflow_vault_v2';
const DB_VERSION = 1;

const STORES = {
  CRYPTO_KEYS: 'cryptoKeys',
  ENCRYPTED_NOTES: 'encryptedNotes',
  METADATA: 'metadata',
} as const;

export class IndexedDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. cryptoKeys store
        if (!db.objectStoreNames.contains(STORES.CRYPTO_KEYS)) {
          db.createObjectStore(STORES.CRYPTO_KEYS, { keyPath: 'id' });
        }

        // 2. encryptedNotes store
        if (!db.objectStoreNames.contains(STORES.ENCRYPTED_NOTES)) {
          db.createObjectStore(STORES.ENCRYPTED_NOTES, { keyPath: 'noteId' });
        }

        // 3. metadata store
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          const metaStore = db.createObjectStore(STORES.METADATA, { keyPath: 'noteId' });
          metaStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          metaStore.createIndex('spaceId', 'spaceId', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- CryptoKey Storage ---

  async saveCryptoKey(id: string, key: CryptoKey, version: number = 1): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CRYPTO_KEYS, 'readwrite');
      const store = tx.objectStore(STORES.CRYPTO_KEYS);
      const record: StoredCryptoKey = {
        id,
        key,
        version,
        createdAt: new Date().toISOString(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getCryptoKey(id: string): Promise<StoredCryptoKey | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CRYPTO_KEYS, 'readonly');
      const store = tx.objectStore(STORES.CRYPTO_KEYS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Encrypted Notes Storage ---

  async saveEncryptedNote(record: EncryptedNoteRecord): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENCRYPTED_NOTES, 'readwrite');
      const store = tx.objectStore(STORES.ENCRYPTED_NOTES);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getEncryptedNote(noteId: string): Promise<EncryptedNoteRecord | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENCRYPTED_NOTES, 'readonly');
      const store = tx.objectStore(STORES.ENCRYPTED_NOTES);
      const req = store.get(noteId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllEncryptedNotes(): Promise<EncryptedNoteRecord[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENCRYPTED_NOTES, 'readonly');
      const store = tx.objectStore(STORES.ENCRYPTED_NOTES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteEncryptedNote(noteId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENCRYPTED_NOTES, 'readwrite');
      const store = tx.objectStore(STORES.ENCRYPTED_NOTES);
      const req = store.delete(noteId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Metadata Storage ---

  async saveMetadata(record: NoteMetadataRecord): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.METADATA, 'readwrite');
      const store = tx.objectStore(STORES.METADATA);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getMetadata(noteId: string): Promise<NoteMetadataRecord | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.METADATA, 'readonly');
      const store = tx.objectStore(STORES.METADATA);
      const req = store.get(noteId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllMetadata(): Promise<NoteMetadataRecord[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.METADATA, 'readonly');
      const store = tx.objectStore(STORES.METADATA);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteMetadata(noteId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.METADATA, 'readwrite');
      const store = tx.objectStore(STORES.METADATA);
      const req = store.delete(noteId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Cleanup / Purge ---

  async clearAll(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.CRYPTO_KEYS, STORES.ENCRYPTED_NOTES, STORES.METADATA], 'readwrite');
      tx.objectStore(STORES.CRYPTO_KEYS).clear();
      tx.objectStore(STORES.ENCRYPTED_NOTES).clear();
      tx.objectStore(STORES.METADATA).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const indexedDbService = new IndexedDbService();
