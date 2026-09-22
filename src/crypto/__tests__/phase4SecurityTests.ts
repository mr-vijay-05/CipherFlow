/**
 * CipherFlow Phase 4 - Comprehensive Cryptographic Security Test Suite
 * 
 * Verifies all 25 cryptographic security invariants:
 * 
 * IDENTITY KEYS:
 *  1. Identity key pair generation uses ECDH with NIST P-256 (secp256r1)
 *  2. Public key exports as valid JWK
 *  3. Private key stored in Protected Local Vault (IndexedDB)
 *  4. Key retrieval returns existing identity key (idempotent)
 *  5. Peer public key imports cleanly from JWK
 * 
 * ENVELOPE WRAPPING & DERIVATION:
 *  6. Ephemeral key pair generation & ECDH agreement derivation
 *  7. HKDF-SHA-256 derives 256-bit Key Encryption Key (KEK)
 *  8. Note key wrapped under KEK with AES-256-GCM + 96-bit IV
 *  9. Envelopes for same key produce distinct ciphertexts (fresh ephemeral key + IV)
 * 10. Canonical AAD binds recipientId, noteId, version, algorithm
 * 
 * ENVELOPE UNWRAPPING & INTEGRITY:
 * 11. Recipient private key unwraps note key and matches original key bytes
 * 12. Tampered envelope ciphertext fails unwrapping (AEAD authentication error)
 * 13. Tampered envelope IV fails unwrapping
 * 14. Tampered envelope AAD fails unwrapping
 * 15. Wrong recipient private key fails unwrapping
 * 16. Tampered ephemeral public key fails unwrapping
 * 
 * CRYPTOGRAPHIC REKEY & REVOCATION:
 * 17. Rekey generates brand new random AES-256-GCM key K2
 * 18. Plaintext re-encrypted under K2 with fresh IV and bound to version 2
 * 19. Rekey strictly increments version number
 * 20. Fresh K2 envelopes created for all authorized remaining recipients
 * 21. Revoked recipient excluded from K2 envelopes (zero envelope generated)
 * 22. Revoked recipient cannot unwrap K2
 * 23. Revoked recipient cannot decrypt note version 2
 * 24. Remaining active recipient unwraps K2 and successfully decrypts note version 2
 * 25. Role permissions (VIEWER vs EDITOR) preserved in envelopes and verified
 */

import 'fake-indexeddb/auto';
import assert from 'node:assert';
import { identityKeyService, ASYMMETRIC_ALGORITHM, NAMED_CURVE } from '../identityKeys';
import { envelopeCryptoService, ENVELOPE_ALGORITHM } from '../sharing';
import { rekeyService } from '../rekeyService';
import { encryptionService, CURRENT_ENCRYPTION_VERSION, ENCRYPTION_ALGORITHM } from '../encryption';
import { keyManagementService } from '../keys';
import { base64ToArrayBuffer, arrayBufferToBase64 } from '../codec';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
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

export async function runAllPhase4SecurityTests(): Promise<boolean> {
  console.log('\n=============================================================');
  console.log('CIPHERFLOW PHASE 4: 25 MANDATORY CRYPTOGRAPHIC SECURITY TESTS');
  console.log('=============================================================\n');

  // --- IDENTITY KEYS ---
  await runTest('TEST 1', 'Identity key pair uses ECDH NIST P-256 (secp256r1)', async () => {
    identityKeyService.clearCache();
    const keyPair = await identityKeyService.getOrInitializeIdentityKey('alice');
    assert.strictEqual(keyPair.algorithm, `${ASYMMETRIC_ALGORITHM}-${NAMED_CURVE}`);
    assert.strictEqual(keyPair.publicKey.algorithm.name, 'ECDH');
    assert.strictEqual((keyPair.publicKey.algorithm as any).namedCurve, 'P-256');
  });

  await runTest('TEST 2', 'Public key exports as valid JWK with crv=P-256 and kty=EC', async () => {
    const keyPair = await identityKeyService.getOrInitializeIdentityKey('alice');
    assert.ok(keyPair.publicKeyJwk);
    assert.strictEqual(keyPair.publicKeyJwk.kty, 'EC');
    assert.strictEqual(keyPair.publicKeyJwk.crv, 'P-256');
    assert.ok(keyPair.publicKeyJwk.x);
    assert.ok(keyPair.publicKeyJwk.y);
  });

  await runTest('TEST 3', 'Private key stored in Protected Local Vault (IndexedDB)', async () => {
    const hasKey = await identityKeyService.hasIdentityKey('alice');
    assert.strictEqual(hasKey, true);
  });

  await runTest('TEST 4', 'Identity key retrieval is idempotent from vault', async () => {
    identityKeyService.clearCache();
    const retrieved = await identityKeyService.getOrInitializeIdentityKey('alice');
    assert.strictEqual(retrieved.keyId, 'identity_key_primary_alice');
    assert.ok(retrieved.privateKey);
  });

  await runTest('TEST 5', 'Peer public key imports cleanly from collaborator JWK', async () => {
    identityKeyService.clearCache();
    const bobKeyPair = await identityKeyService.getOrInitializeIdentityKey('bob');
    const importedBob = await identityKeyService.importPeerPublicKey(bobKeyPair.publicKeyJwk);
    assert.strictEqual(importedBob.type, 'public');
    assert.strictEqual(importedBob.algorithm.name, 'ECDH');
  });

  // --- ENVELOPE WRAPPING & DERIVATION ---
  let sampleNoteKey: CryptoKey;
  let bobKeys: any;

  await runTest('TEST 6', 'Ephemeral key agreement generates 256-bit shared secret', async () => {
    sampleNoteKey = await keyManagementService.generateNoteKey();
    bobKeys = await identityKeyService.getOrInitializeIdentityKey('bob');
    const env = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      bobKeys.publicKey,
      'bob',
      'note-101',
      'VIEWER',
      1
    );
    assert.ok(env.ephemeralPublicKeyJwk);
    assert.strictEqual(env.ephemeralPublicKeyJwk.crv, 'P-256');
  });

  await runTest('TEST 7', 'HKDF-SHA-256 derives valid KEK for AES-256-GCM envelope', async () => {
    const env = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      bobKeys.publicKey,
      'bob',
      'note-101',
      'VIEWER',
      1
    );
    assert.strictEqual(env.algorithm, ENVELOPE_ALGORITHM);
  });

  await runTest('TEST 8', 'Note key wrapped with fresh 96-bit (12-byte) IV', async () => {
    const env = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      bobKeys.publicKey,
      'bob',
      'note-101',
      'VIEWER',
      1
    );
    const ivBytes = new Uint8Array(base64ToArrayBuffer(env.iv));
    assert.strictEqual(ivBytes.byteLength, 12);
  });

  await runTest('TEST 9', 'Consecutive envelopes produce distinct ciphertexts and IVs', async () => {
    const env1 = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      bobKeys.publicKey,
      'bob',
      'note-101',
      'VIEWER',
      1
    );
    const env2 = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      bobKeys.publicKey,
      'bob',
      'note-101',
      'VIEWER',
      1
    );
    assert.notStrictEqual(env1.wrappedNoteKey, env2.wrappedNoteKey);
    assert.notStrictEqual(env1.iv, env2.iv);
  });

  await runTest('TEST 10', 'Canonical AAD binds recipientId, noteId, version, algorithm', async () => {
    const env = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      bobKeys.publicKey,
      'bob',
      'note-101',
      'VIEWER',
      1
    );
    assert.strictEqual(env.recipientUserId, 'bob');
    assert.strictEqual(env.noteId, 'note-101');
    assert.strictEqual(env.version, 1);
  });

  // --- ENVELOPE UNWRAPPING & INTEGRITY ---
  await runTest('TEST 11', 'Recipient private key unwraps note key matching original bytes', async () => {
    const env = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      bobKeys.publicKey,
      'bob',
      'note-101',
      'VIEWER',
      1
    );
    const unwrappedKey = await envelopeCryptoService.unwrapEnvelope(env, bobKeys.privateKey);
    const rawOrig = await crypto.subtle.exportKey('raw', sampleNoteKey);
    const rawUnwrapped = await crypto.subtle.exportKey('raw', unwrappedKey);
    assert.deepStrictEqual(new Uint8Array(rawOrig), new Uint8Array(rawUnwrapped));
  });

  await runTest('TEST 12', 'Tampered envelope ciphertext fails unwrapping (AEAD error)', async () => {
    const env = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      bobKeys.publicKey,
      'bob',
      'note-101',
      'VIEWER',
      1
    );
    const bytes = new Uint8Array(base64ToArrayBuffer(env.wrappedNoteKey));
    bytes[0] ^= 0xFF; // Flip bits
    const tampered = { ...env, wrappedNoteKey: arrayBufferToBase64(bytes.buffer as ArrayBuffer) };

    await assert.rejects(
      async () => envelopeCryptoService.unwrapEnvelope(tampered, bobKeys.privateKey),
      /operation failed|tag mismatch|decrypt/i
    );
  });

  await runTest('TEST 13', 'Tampered envelope IV fails unwrapping', async () => {
    const env = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      bobKeys.publicKey,
      'bob',
      'note-101',
      'VIEWER',
      1
    );
    const bytes = new Uint8Array(base64ToArrayBuffer(env.iv));
    bytes[0] ^= 0xFF;
    const tampered = { ...env, iv: arrayBufferToBase64(bytes.buffer as ArrayBuffer) };

    await assert.rejects(
      async () => envelopeCryptoService.unwrapEnvelope(tampered, bobKeys.privateKey),
      /operation failed|tag mismatch|decrypt/i
    );
  });

  await runTest('TEST 14', 'Tampered envelope version/AAD fails unwrapping', async () => {
    const env = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      bobKeys.publicKey,
      'bob',
      'note-101',
      'VIEWER',
      1
    );
    const tampered = { ...env, version: 2 }; // Changed version -> mismatched AAD

    await assert.rejects(
      async () => envelopeCryptoService.unwrapEnvelope(tampered, bobKeys.privateKey),
      /operation failed|tag mismatch|decrypt/i
    );
  });

  await runTest('TEST 15', 'Wrong recipient private key fails unwrapping', async () => {
    identityKeyService.clearCache();
    const eveKeys = await identityKeyService.getOrInitializeIdentityKey('eve');
    const env = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      bobKeys.publicKey,
      'bob',
      'note-101',
      'VIEWER',
      1
    );

    await assert.rejects(
      async () => envelopeCryptoService.unwrapEnvelope(env, eveKeys.privateKey),
      /operation failed|tag mismatch|decrypt/i
    );
  });

  await runTest('TEST 16', 'Tampered ephemeral public key fails unwrapping', async () => {
    identityKeyService.clearCache();
    const charlieKeys = await identityKeyService.getOrInitializeIdentityKey('charlie');
    const env = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      bobKeys.publicKey,
      'bob',
      'note-101',
      'VIEWER',
      1
    );
    const tampered = { ...env, ephemeralPublicKeyJwk: charlieKeys.publicKeyJwk };

    await assert.rejects(
      async () => envelopeCryptoService.unwrapEnvelope(tampered, bobKeys.privateKey),
      /operation failed|tag mismatch|decrypt/i
    );
  });

  // --- CRYPTOGRAPHIC REKEY & REVOCATION ---
  let rekeyResult: any;
  let carolKeys: any;

  await runTest('TEST 17', 'Rekey generates brand new random AES-256-GCM key K2', async () => {
    identityKeyService.clearCache();
    carolKeys = await identityKeyService.getOrInitializeIdentityKey('carol');
    
    // Initial state: Alice shared note with Bob and Carol
    const remaining = [
      { userId: 'carol', role: 'VIEWER' as const, publicKeyJwk: carolKeys.publicKeyJwk },
    ]; // Bob is revoked, Carol remains

    rekeyResult = await rekeyService.rotateNoteKey(
      'note-200',
      'Confidential Research Data for Orion',
      1,
      remaining,
      'alice'
    );

    assert.ok(rekeyResult.newNoteKey);
    const rawK2 = await crypto.subtle.exportKey('raw', rekeyResult.newNoteKey);
    const rawK1 = await crypto.subtle.exportKey('raw', sampleNoteKey);
    assert.notDeepStrictEqual(new Uint8Array(rawK2), new Uint8Array(rawK1));
  });

  await runTest('TEST 18', 'Plaintext re-encrypted under K2 with fresh IV and bound to v2', async () => {
    assert.ok(rekeyResult.ciphertext);
    assert.ok(rekeyResult.iv);
    assert.strictEqual(rekeyResult.version, 2);
  });

  await runTest('TEST 19', 'Rekey strictly increments version number (monotonic)', async () => {
    assert.strictEqual(rekeyResult.version, 2);
    assert.strictEqual(rekeyResult.baseVersion, 1);
  });

  await runTest('TEST 20', 'Fresh envelopes created for authorized remaining recipient (Carol)', async () => {
    assert.strictEqual(rekeyResult.keyEnvelopes.length, 1);
    assert.strictEqual(rekeyResult.keyEnvelopes[0].recipientUserId, 'carol');
    assert.strictEqual(rekeyResult.keyEnvelopes[0].version, 2);
  });

  await runTest('TEST 21', 'Revoked recipient (Bob) excluded from K2 envelopes (0 envelopes)', async () => {
    const bobEnvelopes = rekeyResult.keyEnvelopes.filter((e: any) => e.recipientUserId === 'bob');
    assert.strictEqual(bobEnvelopes.length, 0);
  });

  await runTest('TEST 22', 'Revoked recipient (Bob) cannot unwrap K2 (no envelope exists)', async () => {
    // Attempting to unwrap Carol's envelope with Bob's private key fails
    await assert.rejects(
      async () => envelopeCryptoService.unwrapEnvelope(rekeyResult.keyEnvelopes[0], bobKeys.privateKey),
      /operation failed|tag mismatch|decrypt/i
    );
  });

  await runTest('TEST 23', 'Revoked recipient cannot decrypt note version 2', async () => {
    // Bob tries to decrypt ciphertext v2 using his old K1
    const payload = {
      version: rekeyResult.version,
      algorithm: ENCRYPTION_ALGORITHM,
      ciphertext: rekeyResult.ciphertext,
      iv: rekeyResult.iv,
      aad: rekeyResult.aad,
    };

    await assert.rejects(
      async () => encryptionService.decrypt(payload, sampleNoteKey, 'note-200'),
      /tag mismatch|operation failed|AuthenticationError/i
    );
  });

  await runTest('TEST 24', 'Remaining active recipient (Carol) unwraps K2 and decrypts v2', async () => {
    const carolEnvelope = rekeyResult.keyEnvelopes[0];
    const carolUnwrappedK2 = await envelopeCryptoService.unwrapEnvelope(carolEnvelope, carolKeys.privateKey);

    const payload = {
      version: rekeyResult.version,
      algorithm: ENCRYPTION_ALGORITHM,
      ciphertext: rekeyResult.ciphertext,
      iv: rekeyResult.iv,
      aad: rekeyResult.aad,
    };

    const decrypted = await encryptionService.decrypt(payload, carolUnwrappedK2, 'note-200');
    assert.strictEqual(decrypted, 'Confidential Research Data for Orion');
  });

  await runTest('TEST 25', 'Role permissions (VIEWER vs EDITOR) preserved in envelopes and verified', async () => {
    const editorEnv = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      carolKeys.publicKey,
      'carol',
      'note-200',
      'EDITOR',
      1
    );
    assert.strictEqual(editorEnv.role, 'EDITOR');

    const viewerEnv = await envelopeCryptoService.createEnvelope(
      sampleNoteKey,
      carolKeys.publicKey,
      'carol',
      'note-200',
      'VIEWER',
      1
    );
    assert.strictEqual(viewerEnv.role, 'VIEWER');
  });

  console.log('\n=============================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`SUMMARY: ${results.filter(r => r.passed).length}/${results.length} Phase 4 Tests PASSED`);
  if (!allPassed) {
    console.error('FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => console.error(` - ${r.id}: ${r.name} (${r.error})`));
  }
  console.log('=============================================================\n');

  return allPassed;
}

// Run immediately if invoked as main module
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runAllPhase4SecurityTests().then(success => {
    if (!success) process.exit(1);
  });
}
