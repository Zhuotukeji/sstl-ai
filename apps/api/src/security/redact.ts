import crypto from "node:crypto";

const secretKeyPattern = /(authorization|cookie|token|secret|password|passwd|pwd|api[_-]?key|pixel[_-]?secret|session)/i;
const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const longQuerySecretPattern = /([?&](?:token|key|secret|sig|signature|auth|password)=)[^&#\s]+/gi;
const freeTextSecretPattern =
  /\b(authorization|cookie|token|secret|password|passwd|pwd|api[_-]?key|pixel[_-]?secret|session)\s*[:=]\s*([^\s,;&]+)/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

export function hashSensitive(value: string, salt: string): string {
  return crypto.createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 16);
}

export function redactValue(value: unknown, salt: string): unknown {
  if (Array.isArray(value)) return value.map((item) => redactValue(item, salt));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = secretKeyPattern.test(key) ? `[redacted:${hashSensitive(String(item), salt)}]` : redactValue(item, salt);
    }
    return out;
  }
  if (typeof value === "string") {
    return value
      .replace(bearerPattern, "Bearer [redacted]")
      .replace(freeTextSecretPattern, "$1=[redacted]")
      .replace(longQuerySecretPattern, "$1[redacted]")
      .replace(ipPattern, (match) => `[ip:${hashSensitive(match, salt)}]`);
  }
  return value;
}

export function summarizeForAudit(value: unknown, salt: string): string {
  const redacted = redactValue(value, salt);
  return JSON.stringify(redacted).slice(0, 500);
}
