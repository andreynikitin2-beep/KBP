import crypto from "crypto";
import bcrypt from "bcryptjs";

// ── Encryption of stored secrets (SMTP / LDAP passwords, AI API key) ─────────
//
// Format: enc:v1:<iv b64>:<tag b64>:<ciphertext b64>, AES-256-GCM.
// The key is derived from the SECRETS_KEY env var. Values without the prefix
// are legacy plaintext: they are read as-is and encrypted on the next write.

const PREFIX = "enc:v1:";
const MIN_KEY_LENGTH = 32;

function getKey(): Buffer {
  const raw = process.env.SECRETS_KEY || "";
  if (raw.length < MIN_KEY_LENGTH) {
    throw new Error(
      `SECRETS_KEY не задан или короче ${MIN_KEY_LENGTH} символов. ` +
      "Сгенерируйте ключ командой `openssl rand -hex 32` и добавьте его в .env.",
    );
  }
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

/** Fail fast at startup instead of on the first secret read. */
export function assertSecretsKey(): void {
  getKey();
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(value: string | null | undefined): string {
  if (!value || isEncrypted(value)) return value || "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

export function decryptSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (!isEncrypted(value)) return value;
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || dataB64 === undefined) throw new Error("Повреждённый зашифрованный секрет");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

/** Show the first/last characters only, as for the AI API key. */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 2) + "••••••••" + (value.length > 8 ? value.slice(-2) : "");
}

/** A masked or empty value from the UI means "keep the stored secret". */
export function isMaskedOrEmpty(value: unknown): boolean {
  return typeof value !== "string" || value === "" || value.includes("••");
}

// ── User passwords ───────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 10;

export function isPasswordHash(value: string | null | undefined): boolean {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

/** Empty string stays empty: it marks AD users without a local password. */
export function hashPassword(password: string): string {
  if (!password || isPasswordHash(password)) return password;
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

/**
 * Check a password against the stored value. Legacy plaintext values still
 * match; `needsRehash` tells the caller to replace them with a hash.
 */
export function verifyPassword(password: string, stored: string | null | undefined): { ok: boolean; needsRehash: boolean } {
  if (!password || !stored) return { ok: false, needsRehash: false };
  if (isPasswordHash(stored)) return { ok: bcrypt.compareSync(password, stored), needsRehash: false };
  const a = Buffer.from(password, "utf8");
  const b = Buffer.from(stored, "utf8");
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok, needsRehash: ok };
}

// ── Session tokens ───────────────────────────────────────────────────────────

/** Sessions are stored by token hash, so a DB dump does not yield live tokens. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}
