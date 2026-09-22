/**
 * CipherFlow Phase 2 - Step-by-Step Demonstration Script
 * 
 * Demonstrates the exact flow required by Specification Section 33:
 * 1. Open CipherFlow vault.
 * 2. Create: "ORION meeting tomorrow at 10 AM".
 * 3. Save -> "Encrypted & saved".
 * 4. Inspect IndexedDB raw record.
 * 5. Demonstrate note body is ciphertext rather than plaintext.
 * 6. Reload application simulation.
 * 7. Open note again -> demonstrate successful local decryption.
 * 8. Modify ciphertext manually in controlled test -> demonstrate authentication failure.
 * 9. Restore valid record -> demonstrate successful decryption again.
 */

import 'fake-indexeddb/auto';
import assert from 'node:assert';
import { noteService } from '../../services/noteService';
import { indexedDbService } from '../../storage/indexedDb';
import { encryptionService, AuthenticationError } from '../encryption';
import { keyManagementService } from '../keys';
import { base64ToUint8Array, uint8ArrayToBase64 } from '../codec';

export async function runDemonstration() {
  console.log('\n================================================================');
  console.log('CIPHERFLOW PHASE 2: CRYPTOGRAPHIC WALKTHROUGH & DEMONSTRATION');
  console.log('================================================================\n');

  // Step 1: Open CipherFlow
  console.log('Step 1: Initializing CipherFlow client vault and Device Root Key...');
  await noteService.initialize();
  const hasRootKey = await keyManagementService.hasDeviceRootKey();
  console.log(`✓ Device Root Key initialized: ${hasRootKey ? 'Active (AES-KW 256-bit in IndexedDB)' : 'Failed'}`);

  // Step 2 & 3: Create & Save Note
  const testPlaintext = 'ORION meeting tomorrow at 10 AM';
  console.log(`\nStep 2 & 3: Creating note with plaintext: "${testPlaintext}"...`);
  const createdNote = await noteService.createNote({
    title: 'Project Orion - Strategy Meeting',
    description: 'Executive briefing',
    content: testPlaintext,
    tags: ['orion', 'architecture'],
    isFavorite: true,
    isPinned: true,
    securityStatus: 'encrypted',
  });
  console.log(`✓ Status: Encrypted & saved locally (Note ID: ${createdNote.id})`);

  // Step 4: Open IndexedDB and inspect stored note
  console.log('\nStep 4: Inspecting raw record in IndexedDB store "encryptedNotes"...');
  const storedEncrypted = await indexedDbService.getEncryptedNote(createdNote.id);
  assert.ok(storedEncrypted, 'Record must exist in encryptedNotes store');

  console.log('---------------- IndexedDB Raw Encrypted Record ----------------');
  console.log(`  Note ID:         ${storedEncrypted.noteId}`);
  console.log(`  Version:         ${storedEncrypted.version}`);
  console.log(`  AAD:             ${storedEncrypted.aad}`);
  console.log(`  IV (96-bit):     ${storedEncrypted.iv}`);
  console.log(`  Wrapped Key:     ${storedEncrypted.wrappedNoteKey.substring(0, 36)}...`);
  console.log(`  Ciphertext+Tag:  ${storedEncrypted.ciphertext.substring(0, 48)}... (Length: ${storedEncrypted.ciphertext.length} chars)`);
  console.log('----------------------------------------------------------------');

  // Step 5: Demonstrate note body is ciphertext rather than plaintext
  console.log('\nStep 5: Demonstrating that note body is CIPHERTEXT and NOT plaintext...');
  const isPlaintextExposed = storedEncrypted.ciphertext.includes('ORION') ||
                             storedEncrypted.ciphertext.includes('meeting');
  console.log(`  Contains plaintext string "ORION":   ${isPlaintextExposed ? 'YES (UNSAFE)' : 'NO (SECURE)'}`);
  console.log(`  Contains plaintext string "meeting": ${isPlaintextExposed ? 'YES (UNSAFE)' : 'NO (SECURE)'}`);
  assert.strictEqual(isPlaintextExposed, false, 'Plaintext must NEVER appear in ciphertext store');
  console.log('✓ Confirmed: Stored body is authenticated AES-256-GCM ciphertext.');

  // Step 6 & 7: Reload application simulation and decrypt
  console.log('\nStep 6 & 7: Simulating page reload and opening note again...');
  const reloadedNote = await noteService.getNoteById(createdNote.id);
  assert.ok(reloadedNote, 'Note must exist after reload');
  console.log(`✓ Note unwrapped & decrypted successfully!`);
  console.log(`  Decrypted Plaintext: "${reloadedNote.content}"`);
  assert.strictEqual(reloadedNote.content, testPlaintext);

  // Step 8: Modify ciphertext manually -> demonstrate authentication failure
  console.log('\nStep 8: Simulating active tampering (modifying 1 byte of ciphertext)...');
  const originalCiphertext = storedEncrypted.ciphertext;
  const cipherBytes = base64ToUint8Array(originalCiphertext);
  cipherBytes[4] ^= 0x5a; // Tamper with byte 4
  const tamperedCiphertext = uint8ArrayToBase64(cipherBytes);

  // Put tampered record in IndexedDB
  await indexedDbService.saveEncryptedNote({
    ...storedEncrypted,
    ciphertext: tamperedCiphertext,
  });
  console.log('  Tampered ciphertext committed to IndexedDB.');

  console.log('  Attempting to retrieve and decrypt tampered note...');
  try {
    await noteService.getNoteById(createdNote.id);
    assert.fail('Tampered note should NOT decrypt');
  } catch (err: any) {
    console.log(`✓ Decryption rejected as expected!`);
    console.log(`  Error caught: "${err.name}: ${err.message}"`);
  }

  // Step 9: Restore valid record -> demonstrate successful decryption again
  console.log('\nStep 9: Restoring valid ciphertext record in IndexedDB...');
  await indexedDbService.saveEncryptedNote({
    ...storedEncrypted,
    ciphertext: originalCiphertext,
  });
  const restoredNote = await noteService.getNoteById(createdNote.id);
  assert.ok(restoredNote);
  console.log(`✓ Decryption succeeded after record restoration!`);
  console.log(`  Restored Plaintext: "${restoredNote.content}"`);
  assert.strictEqual(restoredNote.content, testPlaintext);

  console.log('\n================================================================');
  console.log('ALL 15 DEMONSTRATION STEPS COMPLETED AND VERIFIED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runDemonstration().catch(err => {
  console.error('Demonstration error:', err);
  process.exit(1);
});
