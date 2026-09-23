/**
 * CipherFlow - Phase 4 Live Sharing JWK Validation & Envelope Creation Test
 * 
 * Tests:
 * 1. validateP256PublicJwk rejects malformed / 1-byte coordinates fail-closed.
 * 2. validateP256PublicJwk accepts 32-byte P-256 coordinates.
 * 3. importPeerPublicKey validates and imports valid P-256 public JWK.
 * 4. Full envelope creation flow (Alice -> Bob) produces valid sealed envelope with 0 plaintext.
 */

import 'fake-indexeddb/auto';
import { identityKeyService, validateP256PublicJwk, base64urlDecode } from '../identityKeys';
import { envelopeCryptoService } from '../sharing';

async function runLiveSharingJwkTest() {
  console.log('===============================================================');
  console.log('CIPHERFLOW: LIVE SHARING JWK VALIDATION & ENVELOPE TEST');
  console.log('===============================================================');

  // Test 1: Malformed JWK with 1-byte coordinate (the exact bug encountered)
  console.log('\n1. Verifying malformed JWK rejection...');
  const malformedJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: 'bx', // 1 byte in base64url!
    y: 'by',
  };

  let rejected = false;
  let rejectionMessage = '';
  try {
    validateP256PublicJwk(malformedJwk);
  } catch (err: any) {
    rejected = true;
    rejectionMessage = err.message;
  }

  if (rejected && rejectionMessage === 'Recipient public key is invalid or not registered correctly. Expected a P-256 public JWK.') {
    console.log('  ✓ Malformed JWK correctly rejected fail-closed before ECDH.');
    console.log('    Message:', rejectionMessage);
  } else {
    throw new Error(`Expected fail-closed rejection for malformed JWK, got: ${rejectionMessage}`);
  }

  // Test 2: Alice and Bob generate valid WebCrypto P-256 identity key pairs
  console.log('\n2. Initializing WebCrypto P-256 identity keys for Alice and Bob...');
  const aliceId = await identityKeyService.generateFreshIdentityKey('user-alice');
  const bobId = await identityKeyService.generateFreshIdentityKey('user-bob');

  console.log('  Alice JWK crv:', aliceId.publicKeyJwk.crv, 'kty:', aliceId.publicKeyJwk.kty);
  console.log('  Bob JWK crv:', bobId.publicKeyJwk.crv, 'kty:', bobId.publicKeyJwk.kty);

  // Test 3: Validate Bob's public JWK structure and coordinate lengths
  console.log('\n3. Validating Bob public JWK coordinates...');
  validateP256PublicJwk(bobId.publicKeyJwk);
  const xBytes = base64urlDecode(bobId.publicKeyJwk.x as string);
  const yBytes = base64urlDecode(bobId.publicKeyJwk.y as string);
  console.log('  Bob x decoded byteLength:', xBytes.byteLength, '(expected 32)');
  console.log('  Bob y decoded byteLength:', yBytes.byteLength, '(expected 32)');
  if (xBytes.byteLength !== 32 || yBytes.byteLength !== 32) {
    throw new Error('Bob JWK coordinate length is not 32 bytes!');
  }
  console.log('  ✓ Bob public JWK coordinates validated successfully.');

  // Test 4: Import Bob's public key as CryptoKey for ECDH
  console.log('\n4. Importing Bob public key via identityKeyService.importPeerPublicKey()...');
  const bobPeerCryptoKey = await identityKeyService.importPeerPublicKey(bobId.publicKeyJwk);
  console.log('  ✓ Bob CryptoKey imported successfully. Algorithm:', bobPeerCryptoKey.algorithm);

  // Test 5: Alice generates a note key and seals an envelope for Bob
  console.log('\n5. Creating sealed key envelope for Bob (VIEWER)...');
  const noteKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const envelope = await envelopeCryptoService.createEnvelope(
    noteKey,
    bobPeerCryptoKey,
    'user-bob',
    'note-chimera-live-test',
    'VIEWER',
    1,
    'key-user-bob-1'
  );

  console.log('  Envelope ID:', envelope.id);
  console.log('  Algorithm:', envelope.algorithm);
  console.log('  Role:', envelope.role);
  console.log('  Wrapped Note Key Base64 Length:', envelope.wrappedNoteKey.length);
  console.log('  Ephemeral Public Key crv:', envelope.ephemeralPublicKeyJwk.crv);

  // Test 6: Bob unwraps the envelope using his private key in Protected Local Vault
  console.log('\n6. Bob unwraps envelope locally using private key in Protected Vault...');
  const unwrappedKey = await envelopeCryptoService.unwrapEnvelope(envelope, bobId.privateKey);
  const originalExport = await crypto.subtle.exportKey('raw', noteKey);
  const unwrappedExport = await crypto.subtle.exportKey('raw', unwrappedKey);

  const match = Buffer.from(originalExport).equals(Buffer.from(unwrappedExport));
  if (!match) {
    throw new Error('Unwrapped note key bytes do not match original note key!');
  }
  console.log('  ✓ Unwrapped note key bytes match original note key perfectly!');

  console.log('\n===============================================================');
  console.log('ALL LIVE SHARING JWK VALIDATION TESTS PASSED! ✓');
  console.log('===============================================================');
}

runLiveSharingJwkTest().catch(err => {
  console.error('\nTest execution failed:', err);
  process.exit(1);
});
