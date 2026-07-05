import crypto from "node:crypto";

const cipherPrefix = "v1";

function deriveKey(encryptionKey: string): Buffer {
  return crypto.createHash("sha256").update(encryptionKey).digest();
}

export function encryptSecret(value: string | undefined, encryptionKey: string): string | undefined {
  if (!value) return undefined;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(encryptionKey), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [cipherPrefix, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(value: string | undefined, encryptionKey: string): string | undefined {
  if (!value) return undefined;
  const [prefix, ivText, tagText, encryptedText] = value.split(":");
  if (prefix !== cipherPrefix || !ivText || !tagText || !encryptedText) return undefined;
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(encryptionKey), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}
