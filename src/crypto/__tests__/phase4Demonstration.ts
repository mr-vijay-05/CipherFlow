/**
 * CipherFlow Phase 4 - Alice & Bob End-to-End Cryptographic Sharing & Rekey Demonstration
 * 
 * Demonstrates the full lifecycle:
 * Step 1: Alice generates ECDH P-256 identity key pair in Protected Local Vault.
 * Step 2: Bob generates ECDH P-256 identity key pair.
 * Step 3: Carol generates ECDH P-256 identity key pair.
 * Step 4: Alice creates Note "Project Chimera Architecture" with fresh AES-256-GCM key K1.
 * Step 5: Alice shares note with Bob (VIEWER) and Carol (EDITOR) via sealed key envelopes.
 * Step 6: Bob unwraps envelope E_Bob(K1) and decrypts note version 1 plaintext.
 * Step 7: Carol unwraps envelope E_Carol(K1) and decrypts note version 1 plaintext.
 * Step 8: Alice revokes Bob's access.
 * Step 9: Alice performs Cryptographic Rekey:
 *         - Fresh 256-bit AES-GCM key K2 generated.
 *         - Plaintext re-encrypted under K2 with fresh 96-bit IV.
 *         - Version bumped to 2 with canonical AAD.
 *         - Fresh envelope E_Carol(K2) generated for remaining recipient Carol.
 *         - ZERO envelope generated for Bob.
 * Step 10: Alice unwraps K2 and decrypts version 2 plaintext -> SUCCEEDS.
 * Step 11: Carol unwraps E_Carol(K2) and decrypts version 2 plaintext -> SUCCEEDS.
 * Step 12: Bob attempts to decrypt version 2 ciphertext using his cached K1 -> FAILS (AEAD tag mismatch).
 * Step 13: Bob attempts to unwrap Carol's envelope E_Carol(K2) using his private key -> FAILS (ECDH mismatch).
 */

import 'fake-indexeddb/auto';
import assert from 'node:assert';
import { identityKeyService } from '../identityKeys';
import { envelopeCryptoService } from '../sharing';
import { rekeyService } from '../rekeyService';
import { encryptionService, ENCRYPTION_ALGORITHM } from '../encryption';
import { keyManagementService } from '../keys';

export async function runDemonstration(): Promise<boolean> {
  console.log('=============================================================================');
  console.log('CIPHERFLOW PHASE 4: SECURE SHARING & CRYPTOGRAPHIC REVOCATION DEMONSTRATION');
  console.log('Tagline: "Your Knowledge. Your Control."');
  console.log('=============================================================================\n');

  try {
    // STEP 1: Alice identity key
    console.log('STEP 1: Alice initializes ECDH P-256 identity key pair...');
    identityKeyService.clearCache();
    const aliceKeys = await identityKeyService.getOrInitializeIdentityKey('alice');
    console.log(`  -> Alice public key: ${aliceKeys.publicKeyJwk.crv} (x: ${aliceKeys.publicKeyJwk.x?.substring(0, 8)}...)`);
    console.log('  -> Alice private key: Stored in Client-Side Protected Local Vault (IndexedDB)');

    // STEP 2: Bob identity key
    console.log('\nSTEP 2: Bob initializes ECDH P-256 identity key pair...');
    identityKeyService.clearCache();
    const bobKeys = await identityKeyService.getOrInitializeIdentityKey('bob');
    console.log(`  -> Bob public key: ${bobKeys.publicKeyJwk.crv} (x: ${bobKeys.publicKeyJwk.x?.substring(0, 8)}...)`);

    // STEP 3: Carol identity key
    console.log('\nSTEP 3: Carol initializes ECDH P-256 identity key pair...');
    identityKeyService.clearCache();
    const carolKeys = await identityKeyService.getOrInitializeIdentityKey('carol');
    console.log(`  -> Carol public key: ${carolKeys.publicKeyJwk.crv} (x: ${carolKeys.publicKeyJwk.x?.substring(0, 8)}...)`);

    // STEP 4: Alice creates note
    console.log('\nSTEP 4: Alice creates note "Project Chimera Architecture" with K1...');
    const originalPlaintext = 'TOP SECRET: Distributed consensus algorithm and zero-knowledge accumulator state.';
    const noteId = 'note-chimera-001';
    const noteKeyK1 = await keyManagementService.generateNoteKey();
    const encryptedV1 = await encryptionService.encrypt(
      originalPlaintext,
      noteKeyK1,
      noteId,
      1
    );
    console.log(`  -> Note ID: ${noteId}, Version: ${encryptedV1.version}`);
    console.log(`  -> Ciphertext (Base64): ${encryptedV1.ciphertext.substring(0, 36)}...`);
    console.log(`  -> IV (96-bit Base64): ${encryptedV1.iv}`);
    console.log(`  -> AAD: "${encryptedV1.aad}"`);

    // STEP 5: Alice shares with Bob and Carol
    console.log('\nSTEP 5: Alice generates sealed key envelopes for Bob (VIEWER) and Carol (EDITOR)...');
    const bobEnvelopeV1 = await envelopeCryptoService.createEnvelope(
      noteKeyK1,
      bobKeys.publicKey,
      'bob',
      noteId,
      'VIEWER',
      1
    );
    const carolEnvelopeV1 = await envelopeCryptoService.createEnvelope(
      noteKeyK1,
      carolKeys.publicKey,
      'carol',
      noteId,
      'EDITOR',
      1
    );
    console.log(`  -> E_Bob(K1) Envelope ID: ${bobEnvelopeV1.id}, Role: ${bobEnvelopeV1.role}`);
    console.log(`  -> E_Bob(K1) Ephemeral Key: ${bobEnvelopeV1.ephemeralPublicKeyJwk.crv}`);
    console.log(`  -> E_Carol(K1) Envelope ID: ${carolEnvelopeV1.id}, Role: ${carolEnvelopeV1.role}`);

    // STEP 6: Bob unwraps and decrypts
    console.log('\nSTEP 6: Bob receives note, unwraps E_Bob(K1), and decrypts v1 plaintext...');
    const bobUnwrappedK1 = await envelopeCryptoService.unwrapEnvelope(bobEnvelopeV1, bobKeys.privateKey);
    const bobDecryptedV1 = await encryptionService.decrypt(
      {
        version: 1,
        algorithm: ENCRYPTION_ALGORITHM,
        ciphertext: encryptedV1.ciphertext,
        iv: encryptedV1.iv,
        aad: encryptedV1.aad,
      },
      bobUnwrappedK1,
      noteId
    );
    console.log(`  -> [PASS] Bob decrypted plaintext: "${bobDecryptedV1}"`);
    assert.strictEqual(bobDecryptedV1, originalPlaintext);

    // STEP 7: Carol unwraps and decrypts
    console.log('\nSTEP 7: Carol receives note, unwraps E_Carol(K1), and decrypts v1 plaintext...');
    const carolUnwrappedK1 = await envelopeCryptoService.unwrapEnvelope(carolEnvelopeV1, carolKeys.privateKey);
    const carolDecryptedV1 = await encryptionService.decrypt(
      {
        version: 1,
        algorithm: ENCRYPTION_ALGORITHM,
        ciphertext: encryptedV1.ciphertext,
        iv: encryptedV1.iv,
        aad: encryptedV1.aad,
      },
      carolUnwrappedK1,
      noteId
    );
    console.log(`  -> [PASS] Carol decrypted plaintext: "${carolDecryptedV1}"`);
    assert.strictEqual(carolDecryptedV1, originalPlaintext);

    // STEP 8: Revocation of Bob
    console.log('\nSTEP 8: Alice revokes Bob\'s access...');
    console.log('  -> Notice: Revoking access performs automatic cryptographic rekeying (K2)');
    console.log('     and prevents future access to newly protected versions.');
    console.log('     It cannot erase plaintext that Bob already viewed or captured.');

    // STEP 9: Cryptographic Rekey (K2)
    console.log('\nSTEP 9: Alice performs Cryptographic Rekey to seal version 2...');
    const remainingRecipients = [
      {
        userId: 'carol',
        role: 'EDITOR' as const,
        publicKeyJwk: carolKeys.publicKeyJwk,
      },
    ]; // Bob is EXCLUDED

    const updatedPlaintext = 'TOP SECRET v2: Added quantum-resistant Falcon signatures to accumulator state.';
    const rekeyResult = await rekeyService.rotateNoteKey(
      noteId,
      updatedPlaintext,
      1,
      remainingRecipients,
      'alice'
    );
    console.log(`  -> New Version: ${rekeyResult.version} (bumped from baseVersion ${rekeyResult.baseVersion})`);
    console.log(`  -> New Ciphertext (Base64): ${rekeyResult.ciphertext.substring(0, 36)}...`);
    console.log(`  -> New IV: ${rekeyResult.iv}`);
    console.log(`  -> New Envelopes Generated: ${rekeyResult.keyEnvelopes.length} (Carol only)`);
    console.log(`  -> Bob envelopes count: ${rekeyResult.keyEnvelopes.filter(e => e.recipientUserId === 'bob').length} (ZERO)`);

    // STEP 10: Alice decrypts v2
    console.log('\nSTEP 10: Alice decrypts version 2 with fresh K2...');
    const aliceDecryptedV2 = await encryptionService.decrypt(
      {
        version: 2,
        algorithm: ENCRYPTION_ALGORITHM,
        ciphertext: rekeyResult.ciphertext,
        iv: rekeyResult.iv,
        aad: rekeyResult.aad,
      },
      rekeyResult.newNoteKey,
      noteId
    );
    console.log(`  -> [PASS] Alice decrypted v2: "${aliceDecryptedV2}"`);
    assert.strictEqual(aliceDecryptedV2, updatedPlaintext);

    // STEP 11: Carol unwraps E_Carol(K2) and decrypts v2
    console.log('\nSTEP 11: Carol unwraps E_Carol(K2) and decrypts version 2...');
    const carolEnvelopeV2 = rekeyResult.keyEnvelopes[0];
    const carolUnwrappedK2 = await envelopeCryptoService.unwrapEnvelope(carolEnvelopeV2, carolKeys.privateKey);
    const carolDecryptedV2 = await encryptionService.decrypt(
      {
        version: 2,
        algorithm: ENCRYPTION_ALGORITHM,
        ciphertext: rekeyResult.ciphertext,
        iv: rekeyResult.iv,
        aad: rekeyResult.aad,
      },
      carolUnwrappedK2,
      noteId
    );
    console.log(`  -> [PASS] Carol decrypted v2: "${carolDecryptedV2}"`);
    assert.strictEqual(carolDecryptedV2, updatedPlaintext);

    // STEP 12: Bob attempts to decrypt v2 with K1 -> FAILS
    console.log('\nSTEP 12: Revoked Bob attempts to decrypt version 2 using old K1...');
    let bobK1Decrypted = false;
    try {
      await encryptionService.decrypt(
        {
          version: 2,
          algorithm: ENCRYPTION_ALGORITHM,
          ciphertext: rekeyResult.ciphertext,
          iv: rekeyResult.iv,
          aad: rekeyResult.aad,
        },
        bobUnwrappedK1,
        noteId
      );
      bobK1Decrypted = true;
    } catch (err: any) {
      console.log(`  -> [BLOCKED] Decryption failed as expected: ${err.message}`);
    }
    assert.strictEqual(bobK1Decrypted, false, 'Revoked Bob must not be able to decrypt v2 with K1!');

    // STEP 13: Bob attempts to unwrap Carol's envelope -> FAILS
    console.log('\nSTEP 13: Revoked Bob attempts to unwrap Carol\'s K2 envelope E_Carol(K2)...');
    let bobEnvelopeUnwrapped = false;
    try {
      await envelopeCryptoService.unwrapEnvelope(carolEnvelopeV2, bobKeys.privateKey);
      bobEnvelopeUnwrapped = true;
    } catch (err: any) {
      console.log(`  -> [BLOCKED] Envelope unwrap failed as expected: ${err.message}`);
    }
    assert.strictEqual(bobEnvelopeUnwrapped, false, 'Bob must not be able to unwrap Carol\'s envelope!');

    console.log('\n=============================================================================');
    console.log('DEMONSTRATION COMPLETE: ALL 13 CRYPTOGRAPHIC PHASES VERIFIED SUCCESSFULLY');
    console.log('Core Invariant Proved: "We don\'t share the note itself. We share controlled');
    console.log('cryptographic access to the note\'s encryption key."');
    console.log('=============================================================================\n');

    return true;
  } catch (err) {
    console.error('\nDEMONSTRATION FAILED:', err);
    return false;
  }
}

runDemonstration().then(success => {
  if (!success) process.exit(1);
});
