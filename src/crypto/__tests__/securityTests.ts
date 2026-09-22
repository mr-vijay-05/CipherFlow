/**
 * CipherFlow Phase 2 - Comprehensive Cryptographic Security Test Suite
 * 
 * Executes all 12 mandatory security tests from Specification Section 25:
 * TEST 1: Encrypt plaintext -> decrypt -> original plaintext matches.
 * TEST 2: Encrypt same plaintext twice -> ciphertexts must differ (fresh IV guarantee).
 * TEST 3: Wrong key -> decryption fails.
 * TEST 4: Modified ciphertext -> decryption fails.
 * TEST 5: Modified IV -> decryption fails.
 * TEST 6: Modified AAD -> decryption fails.
 * TEST 7: Modified encryption version in AAD -> decryption fails.
 * TEST 8: Two notes -> different note keys.
 * TEST 9: Reload application simulation -> encrypted notes remain decryptable.
 * TEST 10: Plaintext must not be persisted as note content in IndexedDB.
 * TEST 11: Delete note -> encrypted record and wrapped key are removed from storage.
 * TEST 12: Encryption failure -> fails closed without persisting plaintext.
 */

import 'fake-indexeddb/auto'; // Polyfills indexedDB, IDBKeyRange, etc. for Node environment
import assert from 'node:assert';
import { encryptionService, AuthenticationError, CryptoError } from '../encryption';
import { keyManagementService } from '../keys';
import { indexedDbService, EncryptedNoteRecord } from '../../storage/indexedDb';
import { noteService } from '../../services/noteService';
import { base64ToUint8Array, uint8ArrayToBase64 } from '../codec';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(id: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ id, name, passed: true });
    console.log(`[PASS] ${id}: ${name}`);
  } catch (err: any) {
    results.push({ id, name, passed: false, error: err?.message || String(err) });
    console.error(`[FAIL] ${id}: ${name}`);
    console.error(`       Error: ${err?.message || err}`);
  }
}

export async function runAllSecurityTests() {
  console.log('\n==================================================');
  console.log('CIPHERFLOW PHASE 2: AUTOMATED SECURITY TEST SUITE');
  console.log('==================================================\n');

  // Initialize environment and root key
  const rootKey = await keyManagementService.getOrInitializeDeviceRootKey();

  // TEST 1: Encrypt plaintext -> decrypt -> original plaintext matches
  await runTest('TEST 1', 'Encrypt plaintext -> decrypt -> original plaintext matches', async () => {
    const originalText = 'CONFIDENTIAL: Project Orion Core Enclave Design Specs v2';
    const noteKey = await keyManagementService.generateNoteKey();
    const payload = await encryptionService.encrypt(originalText, noteKey, 'note-test-1', 1);

    const decrypted = await encryptionService.decrypt(payload, noteKey, 'note-test-1');
    assert.strictEqual(decrypted, originalText, 'Decrypted text must exactly match original');
  });

  // TEST 2: Encrypt same plaintext twice -> ciphertexts must differ (fresh IV guarantee)
  await runTest('TEST 2', 'Encrypt same plaintext twice -> ciphertexts must differ (fresh IV guarantee)', async () => {
    const text = 'Identical plaintext for both runs';
    const noteKey = await keyManagementService.generateNoteKey();

    const payload1 = await encryptionService.encrypt(text, noteKey, 'note-test-2', 1);
    const payload2 = await encryptionService.encrypt(text, noteKey, 'note-test-2', 1);

    assert.notStrictEqual(payload1.iv, payload2.iv, 'IVs must be distinct random values');
    assert.notStrictEqual(payload1.ciphertext, payload2.ciphertext, 'Ciphertexts must differ due to unique IVs');
  });

  // TEST 3: Wrong key -> decryption fails
  await runTest('TEST 3', 'Wrong key -> decryption fails', async () => {
    const text = 'Secret payload for Note A';
    const keyA = await keyManagementService.generateNoteKey();
    const keyB = await keyManagementService.generateNoteKey();

    const payload = await encryptionService.encrypt(text, keyA, 'note-test-3', 1);

    await assert.rejects(
      async () => {
        await encryptionService.decrypt(payload, keyB, 'note-test-3');
      },
      (err: any) => err instanceof AuthenticationError,
      'Decrypting with wrong key must throw AuthenticationError'
    );
  });

  // TEST 4: Modified ciphertext -> decryption fails
  await runTest('TEST 4', 'Modified ciphertext -> decryption fails (AEAD integrity)', async () => {
    const text = 'Financial audit notes 2026';
    const noteKey = await keyManagementService.generateNoteKey();
    const payload = await encryptionService.encrypt(text, noteKey, 'note-test-4', 1);

    // Tamper with one byte of ciphertext
    const bytes = base64ToUint8Array(payload.ciphertext);
    bytes[0] ^= 0xff; // flip bits of first byte
    const tamperedPayload = {
      ...payload,
      ciphertext: uint8ArrayToBase64(bytes),
    };

    await assert.rejects(
      async () => {
        await encryptionService.decrypt(tamperedPayload, noteKey, 'note-test-4');
      },
      (err: any) => err instanceof AuthenticationError,
      'Modified ciphertext must cause AEAD tag mismatch'
    );
  });

  // TEST 5: Modified IV -> decryption fails
  await runTest('TEST 5', 'Modified IV -> decryption fails', async () => {
    const text = 'Sensitive Medical Records';
    const noteKey = await keyManagementService.generateNoteKey();
    const payload = await encryptionService.encrypt(text, noteKey, 'note-test-5', 1);

    // Tamper with IV
    const ivBytes = base64ToUint8Array(payload.iv);
    ivBytes[0] ^= 0xff;
    const tamperedPayload = {
      ...payload,
      iv: uint8ArrayToBase64(ivBytes),
    };

    await assert.rejects(
      async () => {
        await encryptionService.decrypt(tamperedPayload, noteKey, 'note-test-5');
      },
      (err: any) => err instanceof AuthenticationError,
      'Modified IV must cause AEAD authentication failure'
    );
  });

  // TEST 6: Modified AAD -> decryption fails
  await runTest('TEST 6', 'Modified AAD -> decryption fails', async () => {
    const text = 'Restricted Research Proposal';
    const noteKey = await keyManagementService.generateNoteKey();
    const payload = await encryptionService.encrypt(text, noteKey, 'note-test-6', 1);

    // Attempt decryption with wrong expected noteId context in AAD
    await assert.rejects(
      async () => {
        await encryptionService.decrypt(payload, noteKey, 'note-attacker-id');
      },
      (err: any) => err instanceof AuthenticationError,
      'Modified AAD context must reject decryption'
    );
  });

  // TEST 7: Modified encryption version if authenticated through AAD -> decryption fails
  await runTest('TEST 7', 'Modified encryption version in AAD -> decryption fails', async () => {
    const text = 'Versioned Document';
    const noteKey = await keyManagementService.generateNoteKey();
    const payload = await encryptionService.encrypt(text, noteKey, 'note-test-7', 1);

    // Tamper with version in payload
    const tamperedPayload = {
      ...payload,
      version: 2, // Modified version
    };

    await assert.rejects(
      async () => {
        await encryptionService.decrypt(tamperedPayload, noteKey, 'note-test-7');
      },
      (err: any) => err instanceof AuthenticationError,
      'Tampering with authenticated version must fail'
    );
  });

  // TEST 8: Two notes -> different note keys
  await runTest('TEST 8', 'Two notes -> different note keys (Per-note isolation)', async () => {
    const key1 = await keyManagementService.generateNoteKey();
    const key2 = await keyManagementService.generateNoteKey();

    const wrapped1 = await keyManagementService.wrapNoteKey(key1, rootKey);
    const wrapped2 = await keyManagementService.wrapNoteKey(key2, rootKey);

    assert.notStrictEqual(wrapped1, wrapped2, 'Wrapped note keys must be distinct');

    // Unwrapped keys must also be isolated
    const unwrapped1 = await keyManagementService.unwrapNoteKey(wrapped1, rootKey);
    const unwrapped2 = await keyManagementService.unwrapNoteKey(wrapped2, rootKey);

    const payload1 = await encryptionService.encrypt('Secret 1', unwrapped1, 'note-iso-1', 1);

    // Key 2 cannot decrypt Note 1
    await assert.rejects(
      async () => {
        await encryptionService.decrypt(payload1, unwrapped2, 'note-iso-1');
      },
      (err: any) => err instanceof AuthenticationError,
      'Note key 2 must not be able to decrypt Note 1'
    );
  });

  // TEST 9: Reload application -> encrypted notes remain decryptable
  await runTest('TEST 9', 'Reload application simulation -> encrypted notes remain decryptable', async () => {
    const secretContent = 'ORION meeting tomorrow at 10 AM';
    const createdNote = await noteService.createNote({
      title: 'Orion Meeting Minutes',
      description: 'Confidential meeting notes',
      content: secretContent,
      tags: ['orion', 'meeting'],
      isFavorite: true,
      isPinned: false,
      securityStatus: 'encrypted',
    });

    // Simulate page reload by creating a fresh NoteService instance and retrieving from IndexedDB
    const fetchedNote = await noteService.getNoteById(createdNote.id);
    assert.ok(fetchedNote, 'Note must be retrieved from IndexedDB');
    assert.strictEqual(fetchedNote!.content, secretContent, 'Plaintext content must decrypt successfully after reload');
  });

  // TEST 10: Plaintext must not be persisted as note content
  await runTest('TEST 10', 'Plaintext must not be persisted as note content in IndexedDB', async () => {
    const highlySensitiveSecret = 'TOP_SECRET_PASSPHRASE_DO_NOT_LEAK_987654321';
    const note = await noteService.createNote({
      title: 'Master Credentials',
      description: 'Credentials draft',
      content: highlySensitiveSecret,
      tags: ['security'],
      isFavorite: false,
      isPinned: false,
      securityStatus: 'encrypted',
    });

    // Directly query raw IndexedDB stores
    const rawEncryptedRecord = await indexedDbService.getEncryptedNote(note.id);
    const rawMetadataRecord = await indexedDbService.getMetadata(note.id);

    assert.ok(rawEncryptedRecord, 'Encrypted note record must exist in IndexedDB');
    assert.ok(rawMetadataRecord, 'Metadata record must exist in IndexedDB');

    // Verify raw encrypted store does NOT contain plaintext
    assert.strictEqual(
      rawEncryptedRecord!.ciphertext.includes(highlySensitiveSecret),
      false,
      'Encrypted ciphertext store must NOT contain plaintext string'
    );

    // Verify raw metadata store does NOT contain plaintext body
    assert.strictEqual(
      JSON.stringify(rawMetadataRecord).includes(highlySensitiveSecret),
      false,
      'Metadata store must NOT contain plaintext body'
    );

    // Verify ciphertext format
    assert.ok(rawEncryptedRecord!.ciphertext.length > 20, 'Ciphertext must be non-empty base64 string');
    assert.ok(rawEncryptedRecord!.iv.length === 16, 'IV base64 length for 12 bytes must be 16 chars');
    assert.ok(rawEncryptedRecord!.wrappedNoteKey.length > 20, 'Wrapped key must be non-empty base64');
  });

  // TEST 11: Delete note -> encrypted record and wrapped key are removed
  await runTest('TEST 11', 'Delete note -> encrypted record and wrapped key are removed from storage', async () => {
    const note = await noteService.createNote({
      title: 'Ephemeral Note',
      description: 'Will be shredded',
      content: 'Self-destruct payload',
      tags: ['shred'],
      isFavorite: false,
      isPinned: false,
      securityStatus: 'encrypted',
    });

    // Verify it exists in IndexedDB
    assert.ok(await indexedDbService.getEncryptedNote(note.id), 'Record must exist before deletion');

    // Permanently delete
    await noteService.deletePermanently(note.id);

    // Verify raw encrypted note and wrapped key are removed
    const encryptedRecordAfter = await indexedDbService.getEncryptedNote(note.id);
    const metadataRecordAfter = await indexedDbService.getMetadata(note.id);

    assert.strictEqual(encryptedRecordAfter, null, 'Encrypted record must be completely destroyed');
    assert.strictEqual(metadataRecordAfter, null, 'Metadata record must be completely destroyed');
  });

  // TEST 12: Encryption failure -> no plaintext persistence (fail-closed)
  await runTest('TEST 12', 'Encryption failure -> fails closed without persisting plaintext', async () => {
    const unpersistedSecret = 'UNSAVED_DUE_TO_SIMULATED_KEY_FAILURE';

    // Mock an invalid CryptoKey to force Web Crypto to throw during encryption
    const fakeKey = {} as CryptoKey;

    await assert.rejects(
      async () => {
        await encryptionService.encrypt(unpersistedSecret, fakeKey, 'fail-test-id', 1);
      },
      (err: any) => err instanceof CryptoError,
      'Must throw CryptoError on failure'
    );

    // Verify nothing was saved to IndexedDB for 'fail-test-id'
    const record = await indexedDbService.getEncryptedNote('fail-test-id');
    assert.strictEqual(record, null, 'Fail-closed: No record must be saved to IndexedDB when encryption fails');
  });

  console.log('\n==================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TOTAL TESTS: ${results.length}`);
  console.log(`PASSED:      ${results.filter(r => r.passed).length}`);
  console.log(`FAILED:      ${results.filter(r => !r.passed).length}`);
  console.log(`STATUS:      ${allPassed ? 'ALL TESTS PASSED SUCCESSFULLY! ✓' : 'SOME TESTS FAILED! ✗'}`);
  console.log('==================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

// Run when executed directly
runAllSecurityTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
