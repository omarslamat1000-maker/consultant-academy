// ============================================================
// تشفير أسرار مزودي الذكاء الاصطناعي — AES-256-GCM بمفتاح رئيس خادمي CONFIG_ENCRYPTION_KEY
// لا تُسجَّل القيم السرية ولا تُعاد إلى الواجهة أبدًا
// ============================================================
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

export interface EncryptedSecret {
  encrypted_secret: string; // base64
  secret_iv: string; // base64 (12 bytes)
  auth_tag: string; // base64 (16 bytes)
}

export class EncryptionNotConfiguredError extends Error {
  constructor() {
    super("CONFIG_ENCRYPTION_KEY is not configured");
    this.name = "EncryptionNotConfiguredError";
  }
}

/** يقرأ مفتاح التشفير الرئيس (32 بايت) من base64 أو hex. يرمي خطأ واضحًا إن لم يكن مضبوطًا */
export function loadMasterKey(raw: string | undefined = process.env.CONFIG_ENCRYPTION_KEY): Buffer {
  if (!raw || raw.trim().length === 0) throw new EncryptionNotConfiguredError();
  const trimmed = raw.trim();
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) key = Buffer.from(trimmed, "hex");
  else key = Buffer.from(trimmed, "base64");
  if (key.length !== 32) throw new Error("CONFIG_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

export function isEncryptionConfigured(): boolean {
  try {
    loadMasterKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string, key: Buffer = loadMasterKey()): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted_secret: enc.toString("base64"),
    secret_iv: iv.toString("base64"),
    auth_tag: tag.toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedSecret, key: Buffer = loadMasterKey()): string {
  const iv = Buffer.from(payload.secret_iv, "base64");
  const tag = Buffer.from(payload.auth_tag, "base64");
  const data = Buffer.from(payload.encrypted_secret, "base64");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

/** تلميح آمن للعرض: آخر أربعة أحرف فقط */
export function keyHint(secret: string): string {
  const s = secret.trim();
  if (s.length < 8) return "****";
  return `••••${s.slice(-4)}`;
}

/** مقارنة آمنة زمنيًا */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** إخفاء أي قيمة تشبه مفتاح API داخل نص (للسجلات) */
export function redactSecrets(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_KEY]")
    .replace(/sb_secret_[0-9A-Za-z_-]+/g, "[REDACTED_KEY]")
    .replace(/eyJ[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}/g, "[REDACTED_JWT]")
    .replace(/(api[_-]?key|authorization|x-goog-api-key)(["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, "$1$2[REDACTED]");
}
