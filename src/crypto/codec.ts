/**
 * Binary & Base64 encoding/decoding utilities for Web Crypto serialization.
 * Only used for serialization/transport of already-encrypted ciphertext and keys.
 */

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes = buffer instanceof Uint8Array 
    ? buffer 
    : new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer);
  return uint8ArrayToBase64(bytes);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

export function textToUint8Array(text: string): Uint8Array {
  const encoded = new TextEncoder().encode(text);
  const buffer = new ArrayBuffer(encoded.byteLength);
  const bytes = new Uint8Array(buffer);
  bytes.set(encoded);
  return bytes;
}

export function uint8ArrayToText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function arrayBufferToText(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}
