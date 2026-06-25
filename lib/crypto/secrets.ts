import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function masterKey(): Buffer {
  const b64 = process.env.BYOK_ENCRYPTION_KEY;
  if (!b64) throw new Error("BYOK_ENCRYPTION_KEY is not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("BYOK_ENCRYPTION_KEY must be 32 bytes (base64)");
  return key;
}

/** AES-256-GCM → base64(iv | tag | ciphertext). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, masterKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Display-only mask: first 2 + last 4 visible, rest stars; ≤ 6 chars fully masked. */
export function maskKey(plain: string): string {
  if (plain.length <= 6) return "•".repeat(plain.length);
  return plain.slice(0, 2) + "•".repeat(plain.length - 6) + plain.slice(-4);
}
