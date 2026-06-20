import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// AES-256-GCM. Standard NIST-recommended nonce + tag sizes.
const NONCE_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

// Versioned-blob marker (#49). Blobs that bind row context as AAD are written
// as VERSION_AAD || nonce || ciphertext || tag; legacy blobs (and any write
// with no AAD) keep the original nonce || ciphertext || tag layout with no
// version byte. decrypt() tries the versioned path when the marker is present
// and falls back to legacy, so old ciphertext keeps decrypting untouched and a
// table can adopt AAD one at a time. The Rust side (api/src/crypto.rs) mirrors
// this exactly so cross-language rows round-trip.
const VERSION_AAD = 0x01;

function toAadBuffer(aad: Buffer | string | undefined): Buffer | undefined {
  if (aad === undefined) return undefined;
  const buf = Buffer.isBuffer(aad) ? aad : Buffer.from(aad, "utf8");
  return buf.length > 0 ? buf : undefined;
}

function getMasterKey(): Buffer {
  const raw = process.env.TAS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TAS_ENCRYPTION_KEY is required to encrypt workspace secrets. " +
        "Generate one with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LEN) {
    throw new Error(
      `TAS_ENCRYPTION_KEY must decode to ${KEY_LEN} bytes (got ${key.length}). ` +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

/**
 * Encrypt a UTF-8 plaintext. Returns a packed blob.
 *
 * Without `aad`: legacy layout `nonce || ciphertext || tag` (byte-identical to
 * pre-#49 blobs). With `aad`: versioned layout `0x01 || nonce || ciphertext ||
 * tag` that binds the ciphertext to its row context, so a blob moved into a
 * different row fails to decrypt. Pass the row's stable identity (see
 * `crypto-aad.ts`); the matching `decryptSecret` call must pass the same `aad`.
 */
export function encryptSecret(
  plaintext: string,
  aad?: Buffer | string,
): Buffer {
  const key = getMasterKey();
  const aadBuf = toAadBuffer(aad);
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  if (aadBuf) cipher.setAAD(aadBuf);
  const body = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return aadBuf
    ? Buffer.concat([Buffer.from([VERSION_AAD]), nonce, body, tag])
    : Buffer.concat([nonce, body, tag]);
}

/**
 * Inverse of `encryptSecret`. Throws if the blob is malformed or the master
 * key has changed since the blob was produced.
 *
 * Pass the same `aad` used at encrypt time. A versioned (0x01-prefixed) blob is
 * decrypted with the AAD; anything else falls back to the legacy unbound layout
 * — so pre-#49 ciphertext keeps decrypting even once a caller starts passing
 * `aad`, and is rebound the next time it's rewritten.
 */
export function decryptSecret(blob: Buffer, aad?: Buffer | string): string {
  const key = getMasterKey();
  const aadBuf = toAadBuffer(aad);

  // Versioned + AAD-bound layout, when both the marker and an AAD are present.
  if (
    aadBuf &&
    blob.length >= 1 + NONCE_LEN + TAG_LEN &&
    blob[0] === VERSION_AAD
  ) {
    try {
      const nonce = blob.subarray(1, 1 + NONCE_LEN);
      const body = blob.subarray(1 + NONCE_LEN, blob.length - TAG_LEN);
      const tag = blob.subarray(blob.length - TAG_LEN);
      const decipher = createDecipheriv("aes-256-gcm", key, nonce);
      decipher.setAAD(aadBuf);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(body), decipher.final()]).toString(
        "utf8",
      );
    } catch {
      // Fall through: a legacy blob whose first byte is coincidentally 0x01,
      // or a real mismatch the legacy path will also reject.
    }
  }

  // Legacy layout: nonce || ciphertext || tag, no AAD.
  if (blob.length < NONCE_LEN + TAG_LEN) {
    throw new Error("encrypted blob is shorter than nonce+tag");
  }
  const nonce = blob.subarray(0, NONCE_LEN);
  const body = blob.subarray(NONCE_LEN, blob.length - TAG_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString(
    "utf8",
  );
}

/**
 * Last four characters of a high-entropy secret, used for masked previews.
 * Returns "----" if the secret is shorter than 4 chars (sanity fallback;
 * caller should reject such inputs earlier).
 */
export function last4(plaintext: string): string {
  if (plaintext.length < 4) return "----";
  return plaintext.slice(-4);
}
