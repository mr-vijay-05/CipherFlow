/**
 * CIPHERFLOW — ROUND 2 SECURITY VALIDATION FIX
 * Automated Tamper Detection & Audit Log Integration Test
 */

import 'fake-indexeddb/auto';
import assert from 'node:assert';
import { securityService } from '../../services/securityService';
import { noteService } from '../../services/noteService';
import { indexedDbService } from '../../storage/indexedDb';
import { encryptionService, AuthenticationError } from '../encryption';
import { base64ToUint8Array, arrayBufferToBase64 } from '../codec';
import { auditService, formatAuditTimestamp } from '../../services/auditService';

async function runTamperValidationSuite() {
  console.log('===============================================================');
  console.log('CIPHERFLOW: ROUND 2 LIVE TAMPER DETECTION VALIDATION SUITE');
  console.log('===============================================================\n');

  // STEP 1: Run security diagnostic
  console.log('Executing securityService.runTamperDetectionTest()...');
  const result = await securityService.runTamperDetectionTest();

  console.log('Diagnostic Result:');
  console.log(`  - Original decrypts:    ${result.originalDecrypts ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  - Tampered rejected:    ${result.tamperedRejected ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  - Plaintext not exposed: ${result.plaintextNotExposed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  - Storage untouched:    ${result.storageUntouched ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  - Status:               ${result.status}\n`);

  assert.strictEqual(result.originalDecrypts, true, 'Original ciphertext must decrypt');
  assert.strictEqual(result.tamperedRejected, true, 'Tampered ciphertext must be rejected');
  assert.strictEqual(result.plaintextNotExposed, true, 'Plaintext must not be exposed');
  assert.strictEqual(result.storageUntouched, true, 'Storage record must remain unmodified');
  assert.strictEqual(result.status, 'PASS', 'Overall diagnostic status must be PASS');

  // STEP 2: Verify live application path fail-closed behavior
  console.log('Verifying application note decryption fail-closed behavior...');
  const testNote = await noteService.createNote({
    title: 'Fail-Closed Test Note',
    description: 'Test note for fail closed verification.',
    content: 'Top Secret payload: Fail-closed verification.',
    tags: ['tamper-test'],
    isFavorite: false,
    isPinned: false,
    securityStatus: 'encrypted',
  });

  const storedEncrypted = await indexedDbService.getEncryptedNote(testNote.id);
  assert.ok(storedEncrypted, 'Encrypted note must exist in IndexedDB');
  const originalCiphertext = storedEncrypted.ciphertext;

  // Tamper 1 bit of stored ciphertext temporarily to test getNoteById fail-closed
  const rawBytes = base64ToUint8Array(originalCiphertext);
  rawBytes[0] ^= 0x01;
  storedEncrypted.ciphertext = arrayBufferToBase64(rawBytes.buffer as ArrayBuffer);
  await indexedDbService.saveEncryptedNote(storedEncrypted);

  let decryptionThrew = false;
  try {
    await noteService.getNoteById(testNote.id);
  } catch (err: any) {
    decryptionThrew = true;
    console.log(`  ✓ Application decryption failed as expected: ${err.message}`);
    assert.ok(
      err instanceof AuthenticationError || err.name === 'OperationError' || err.name === 'AuthenticationError',
      'Must throw AuthenticationError or OperationError'
    );
  }
  assert.strictEqual(decryptionThrew, true, 'getNoteById must fail closed on tampered ciphertext');

  // Restore stored record
  storedEncrypted.ciphertext = originalCiphertext;
  await indexedDbService.saveEncryptedNote(storedEncrypted);

  // STEP 3: Verify timestamp formatting with Intl
  console.log('\nVerifying UTC timestamp conversion...');
  const sampleUtc = '2026-09-22T21:15:32.123Z';
  const formatted = formatAuditTimestamp(sampleUtc);
  console.log(`  - UTC Input:  ${sampleUtc}`);
  console.log(`  - Formatted:  ${formatted}`);
  assert.ok(formatted && formatted !== sampleUtc, 'Formatted timestamp must be localized via Intl');

  console.log('\n===============================================================');
  console.log('ALL TAMPER DETECTION & AUDIT INTEGRATION TESTS PASSED! ✓');
  console.log('===============================================================');
}

runTamperValidationSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
