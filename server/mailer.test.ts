// Очередь писем: что уходит, что повторяется, что помечается ошибкой.
// Хранилище замокано — тест не трогает базу и не ходит в SMTP.
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { EmailConfig, NotificationLog } from "@shared/schema";

const { getEmailConfig, getDueNotifications, updateNotification, getMaterialVersionsByMaterialId } = vi.hoisted(() => ({
  getEmailConfig: vi.fn(),
  getDueNotifications: vi.fn(),
  updateNotification: vi.fn(),
  getMaterialVersionsByMaterialId: vi.fn(),
}));

vi.mock("./storage", () => ({
  storage: { getEmailConfig, getDueNotifications, updateNotification, getMaterialVersionsByMaterialId },
}));

import { processEmailQueue, buildNotificationText, MAX_ATTEMPTS } from "./mailer";

const config: EmailConfig = {
  id: "cfg",
  senderAddress: "kb@example.local",
  senderName: "Портал",
  smtpHost: "smtp.example.local",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  smtpUseTls: true,
  enabled: true,
};

function notif(over: Partial<NotificationLog> = {}): NotificationLog {
  return {
    id: "n1",
    createdAt: new Date("2026-09-25T10:00:00Z"),
    toAddress: "user@example.local",
    subject: "Новая версия: Инструкция",
    template: "new_version",
    relatedMaterialId: "m1",
    relatedVersionId: "v1",
    relatedRfcId: null,
    status: "LOGGED",
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    sentAt: null,
    ...over,
  };
}

const now = new Date("2026-09-25T12:00:00Z");

describe("processEmailQueue", () => {
  const sendMail = vi.fn();
  const transportFactory = vi.fn(async () => ({ sendMail }));

  beforeEach(() => {
    vi.clearAllMocks();
    getEmailConfig.mockResolvedValue(config);
    getMaterialVersionsByMaterialId.mockResolvedValue([{ id: "v1", title: "Инструкция" }]);
    sendMail.mockResolvedValue({});
  });

  it("отправляет письмо и ставит SENT", async () => {
    getDueNotifications.mockResolvedValue([notif()]);
    const r = await processEmailQueue({ now, transportFactory });

    expect(r).toEqual({ sent: 1, failed: 0, retried: 0 });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: '"Портал" <kb@example.local>', to: "user@example.local", subject: "Новая версия: Инструкция" }),
    );
    expect(updateNotification).toHaveBeenCalledWith("n1", expect.objectContaining({ status: "SENT", attempts: 1, lastError: null }));
  });

  it("при ошибке SMTP оставляет в очереди и планирует повтор", async () => {
    getDueNotifications.mockResolvedValue([notif()]);
    sendMail.mockRejectedValue(new Error("Connection timeout"));
    const r = await processEmailQueue({ now, transportFactory });

    expect(r.retried).toBe(1);
    const [, patch] = updateNotification.mock.calls[0];
    expect(patch.status).toBeUndefined();
    expect(patch).toMatchObject({ attempts: 1, lastError: "Connection timeout" });
    expect(patch.nextAttemptAt.getTime()).toBe(now.getTime() + 60_000);
  });

  it("после последней попытки ставит FAILED", async () => {
    getDueNotifications.mockResolvedValue([notif({ attempts: MAX_ATTEMPTS - 1 })]);
    sendMail.mockRejectedValue(new Error("550 rejected"));
    const r = await processEmailQueue({ now, transportFactory });

    expect(r.failed).toBe(1);
    expect(updateNotification).toHaveBeenCalledWith(
      "n1",
      expect.objectContaining({ status: "FAILED", attempts: MAX_ATTEMPTS, lastError: "550 rejected", nextAttemptAt: null }),
    );
  });

  it("некорректный адрес — сразу FAILED без обращения к SMTP", async () => {
    getDueNotifications.mockResolvedValue([notif({ toAddress: "" })]);
    const r = await processEmailQueue({ now, transportFactory });

    expect(r.failed).toBe(1);
    expect(sendMail).not.toHaveBeenCalled();
    expect(updateNotification).toHaveBeenCalledWith("n1", expect.objectContaining({ status: "FAILED" }));
  });

  it("почта выключена — очередь не трогается", async () => {
    getEmailConfig.mockResolvedValue({ ...config, enabled: false });
    const r = await processEmailQueue({ now, transportFactory });

    expect(r.skipped).toBe("email_disabled");
    expect(getDueNotifications).not.toHaveBeenCalled();
    expect(transportFactory).not.toHaveBeenCalled();
  });
});

describe("buildNotificationText", () => {
  it("добавляет название и ссылку на материал, если задан PUBLIC_URL", () => {
    vi.stubEnv("PUBLIC_URL", "https://kb.example.local/");
    const text = buildNotificationText(notif(), "Инструкция");
    expect(text).toContain("Новая версия: Инструкция.");
    expect(text).toContain("Материал: Инструкция");
    expect(text).toContain("Ссылка: https://kb.example.local/materials/m1");
    vi.unstubAllEnvs();
  });

  it("без PUBLIC_URL ссылку не пишет", () => {
    vi.stubEnv("PUBLIC_URL", "");
    expect(buildNotificationText(notif(), "Инструкция")).not.toContain("Ссылка:");
    vi.unstubAllEnvs();
  });
});
