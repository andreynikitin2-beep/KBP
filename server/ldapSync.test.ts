// Проверка сертификата LDAPS: по умолчанию включена, CA задаётся файлом.
import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("./storage", () => ({ storage: {} }));

const { ldapTlsOptions } = await import("./ldapSync");

afterEach(() => {
  delete process.env.LDAP_TLS_INSECURE;
  delete process.env.LDAP_CA_FILE;
});

describe("ldapTlsOptions", () => {
  it("для ldap:// TLS не используется", () => {
    expect(ldapTlsOptions("ldap://dc.local")).toBeUndefined();
  });

  it("для ldaps:// сертификат проверяется по умолчанию", () => {
    expect(ldapTlsOptions("ldaps://dc.local")).toEqual({ rejectUnauthorized: true });
  });

  it("использует корпоративный CA из LDAP_CA_FILE", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "kbp-ca-")), "ca.pem");
    fs.writeFileSync(file, "-----BEGIN CERTIFICATE-----\nx\n-----END CERTIFICATE-----\n");
    process.env.LDAP_CA_FILE = file;
    const opts = ldapTlsOptions("ldaps://dc.local");
    expect(opts?.rejectUnauthorized).toBe(true);
    expect(opts?.ca?.toString()).toContain("BEGIN CERTIFICATE");
  });

  it("LDAP_TLS_INSECURE=true отключает проверку", () => {
    process.env.LDAP_TLS_INSECURE = "true";
    expect(ldapTlsOptions("ldaps://dc.local")).toEqual({ rejectUnauthorized: false });
  });
});
