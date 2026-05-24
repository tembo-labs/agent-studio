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
 * Encrypt a UTF-8 plaintext. Returns a packed blob: nonce || ciphertext || tag.
 * The whole blob is what goes into the `workspace_secret.ciphertext` column.
 */
export function encryptSecret(plaintext: string): Buffer {
  const key = getMasterKey();
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const body = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, body, tag]);
}

/**
 * Inverse of `encryptSecret`. Throws if the blob is malformed or the
 * master key has changed since the blob was produced.
 */
export function decryptSecret(blob: Buffer): string {
  if (blob.length < NONCE_LEN + TAG_LEN) {
    throw new Error("encrypted blob is shorter than nonce+tag");
  }
  const key = getMasterKey();
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
