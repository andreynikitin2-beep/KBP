// Шифрование секретов, хеши паролей и токенов сессий.
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  assertSecretsKey,
  decryptSecret,
  encryptSecret,
  hashPassword,
  hashToken,
  isEncrypted,
  isMaskedOrEmpty,
  isPasswordHash,
  maskSecret,
  verifyPassword,
} from "./secrets";

const savedKey = process.env.SECRETS_KEY;
const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);

beforeEach(() => {
  process.env.SECRETS_KEY = KEY_A;
});

afterAll(() => {
  if (savedKey === undefined) delete process.env.SECRETS_KEY;
  else process.env.SECRETS_KEY = savedKey;
});

describe("encryptSecret / decryptSecret", () => {
  it("шифрует и расшифровывает значение", () => {
    const enc = encryptSecret("smtp-pass");
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain("smtp-pass");
    expect(decryptSecret(enc)).toBe("smtp-pass");
  });

  it("каждый раз даёт новый шифртекст", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });

  it("не шифрует повторно и не трогает пустое значение", () => {
    const enc = encryptSecret("x");
    expect(encryptSecret(enc)).toBe(enc);
    expect(encryptSecret("")).toBe("");
  });

  it("читает старое значение без префикса как есть", () => {
    expect(decryptSecret("legacy-plain")).toBe("legacy-plain");
  });

  it("падает при другом ключе", () => {
    const enc = encryptSecret("x");
    process.env.SECRETS_KEY = KEY_B;
    expect(() => decryptSecret(enc)).toThrow();
  });

  it("требует ключ не короче 32 символов", () => {
    process.env.SECRETS_KEY = "short";
    expect(() => assertSecretsKey()).toThrow(/SECRETS_KEY/);
    expect(() => encryptSecret("x")).toThrow(/SECRETS_KEY/);
  });
});

describe("маскирование", () => {
  it("не раскрывает секрет и распознаётся как маска", () => {
    const masked = maskSecret("supersecretpassword");
    expect(masked).not.toContain("secret");
    expect(isMaskedOrEmpty(masked)).toBe(true);
    expect(isMaskedOrEmpty("")).toBe(true);
    expect(isMaskedOrEmpty(undefined)).toBe(true);
    expect(isMaskedOrEmpty("new-password")).toBe(false);
  });
});

describe("пароли пользователей", () => {
  it("хеширует пароль и проверяет его", () => {
    const hash = hashPassword("s3cret");
    expect(isPasswordHash(hash)).toBe(true);
    expect(verifyPassword("s3cret", hash)).toEqual({ ok: true, needsRehash: false });
    expect(verifyPassword("wrong", hash).ok).toBe(false);
  });

  it("принимает старый пароль открытым текстом и просит перехешировать", () => {
    expect(verifyPassword("1", "1")).toEqual({ ok: true, needsRehash: true });
    expect(verifyPassword("2", "1")).toEqual({ ok: false, needsRehash: false });
  });

  it("пустой сохранённый пароль не пускает ни с каким паролем", () => {
    expect(verifyPassword("anything", "").ok).toBe(false);
    expect(verifyPassword("anything", null).ok).toBe(false);
  });

  it("пустой пароль остаётся пустым, хеш не хешируется повторно", () => {
    expect(hashPassword("")).toBe("");
    const hash = hashPassword("x");
    expect(hashPassword(hash)).toBe(hash);
  });
});

describe("hashToken", () => {
  it("даёт 64 hex-символа и не совпадает с токеном", () => {
    const token = "6f1c2c1e-1111-4222-8333-944455556666";
    const h = hashToken(token);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(token);
    expect(hashToken(token)).toBe(h);
  });
});
