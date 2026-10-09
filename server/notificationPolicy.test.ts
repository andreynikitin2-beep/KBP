// Тема письма собирается на сервере: префикс из списка + настоящее название материала.
import { describe, it, expect } from "vitest";
import { buildMaterialSubject, sanitizeSystemSubject } from "./notificationPolicy";

describe("buildMaterialSubject", () => {
  it("берёт префикс из запроса, а название — из базы", () => {
    const r = buildMaterialSubject("Публикация отклонена: что угодно от клиента", "VPN");
    expect(r).toEqual({ ok: true, subject: "Публикация отклонена: VPN" });
  });

  it("для новой версии добавляет номер версии из базы", () => {
    expect(buildMaterialSubject("Новая версия: X (9.9)", "VPN", "1.2")).toEqual({ ok: true, subject: "Новая версия: VPN (1.2)" });
  });

  it("отклоняет произвольный текст и неизвестные префиксы", () => {
    expect(buildMaterialSubject("Срочно смените пароль по ссылке", "VPN").ok).toBe(false);
    expect(buildMaterialSubject("Срочно: смените пароль", "VPN").ok).toBe(false);
    expect(buildMaterialSubject(42, "VPN").ok).toBe(false);
  });
});

describe("sanitizeSystemSubject", () => {
  it("убирает переводы строк и ограничивает длину", () => {
    const r = sanitizeSystemSubject("AD\r\nBcc: x@y" + "z".repeat(400));
    expect(r.ok && r.subject.includes("\n")).toBe(false);
    expect(r.ok && r.subject.length).toBe(300);
  });

  it("пустая тема недопустима", () => {
    expect(sanitizeSystemSubject("  ").ok).toBe(false);
  });
});
