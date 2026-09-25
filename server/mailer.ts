// Отправка писем с сервера: общий SMTP-транспорт и фоновая очередь уведомлений.
//
// Уведомления пишутся в notification_log со статусом LOGGED («В очереди»). Фоновая
// задача раз в минуту (и сразу после появления нового уведомления) забирает готовые к
// отправке записи, отправляет их и ставит SENT. При ошибке — повтор с паузой; после
// MAX_ATTEMPTS попыток запись получает FAILED и текст ошибки в last_error.
// Пока почта выключена или SMTP не настроен, записи просто ждут в очереди.
import type { EmailConfig, NotificationLog } from "@shared/schema";
import { storage } from "./storage";

export const MAX_ATTEMPTS = 5;
// Пауза перед попыткой N+1 после N-й неудачи (минуты).
const RETRY_DELAYS_MIN = [1, 5, 15, 60];
const BATCH_SIZE = 20;
const POLL_INTERVAL_MS = 60_000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface MailTransport {
  sendMail(message: { from: string; to: string; subject: string; text: string; html?: string }): Promise<unknown>;
}

export type TransportFactory = (config: EmailConfig) => Promise<MailTransport>;

export async function createMailTransport(config: EmailConfig): Promise<MailTransport> {
  const nodemailer = await import("nodemailer");
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort || 587,
    secure: config.smtpUseTls && config.smtpPort === 465,
    requireTLS: config.smtpUseTls && config.smtpPort !== 465,
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword || "" } : undefined,
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    tls: { rejectUnauthorized: false },
  } as any);
}

export function formatFrom(config: EmailConfig): string {
  return config.senderName ? `"${config.senderName}" <${config.senderAddress}>` : config.senderAddress;
}

export function materialLink(materialId: string): string | null {
  const base = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");
  return base ? `${base}/materials/${materialId}` : null;
}

export function buildNotificationText(n: NotificationLog, materialTitle: string | null): string {
  const lines = ["Здравствуйте!", "", `${n.subject}.`];
  if (n.relatedMaterialId) {
    lines.push("");
    if (materialTitle) lines.push(`Материал: ${materialTitle}`);
    const link = materialLink(n.relatedMaterialId);
    if (link) lines.push(`Ссылка: ${link}`);
  }
  lines.push("", "—", "Портал инструкций. Письмо отправлено автоматически, отвечать на него не нужно.");
  return lines.join("\n");
}

async function resolveMaterialTitle(n: NotificationLog): Promise<string | null> {
  if (!n.relatedMaterialId) return null;
  const versions = await storage.getMaterialVersionsByMaterialId(n.relatedMaterialId);
  const v = versions.find((x) => x.id === n.relatedVersionId) ?? versions[0];
  return v?.title ?? null;
}

function errorText(e: unknown): string {
  const msg = (e as any)?.message ?? String(e);
  return String(msg).slice(0, 1000);
}

export type QueueRunResult = { sent: number; failed: number; retried: number; skipped?: string };

/** Один проход по очереди. Возвращает счётчики — для логов и тестов. */
export async function processEmailQueue(
  opts: { now?: Date; transportFactory?: TransportFactory } = {},
): Promise<QueueRunResult> {
  const now = opts.now ?? new Date();
  const result: QueueRunResult = { sent: 0, failed: 0, retried: 0 };

  const config = await storage.getEmailConfig();
  if (!config || !config.enabled || !config.smtpHost || !config.senderAddress) {
    return { ...result, skipped: "email_disabled" };
  }

  const due = await storage.getDueNotifications(now, BATCH_SIZE);
  if (due.length === 0) return result;

  const transport = await (opts.transportFactory ?? createMailTransport)(config);
  const from = formatFrom(config);

  for (const n of due) {
    if (!EMAIL_RE.test(n.toAddress)) {
      await storage.updateNotification(n.id, {
        status: "FAILED",
        attempts: n.attempts + 1,
        lastError: `Некорректный адрес получателя: «${n.toAddress}»`,
        nextAttemptAt: null,
      });
      result.failed++;
      continue;
    }

    try {
      const title = await resolveMaterialTitle(n);
      await transport.sendMail({ from, to: n.toAddress, subject: n.subject, text: buildNotificationText(n, title) });
      await storage.updateNotification(n.id, {
        status: "SENT",
        attempts: n.attempts + 1,
        sentAt: new Date(),
        lastError: null,
        nextAttemptAt: null,
      });
      result.sent++;
    } catch (e) {
      const attempts = n.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await storage.updateNotification(n.id, { status: "FAILED", attempts, lastError: errorText(e), nextAttemptAt: null });
        result.failed++;
      } else {
        const delayMin = RETRY_DELAYS_MIN[Math.min(attempts - 1, RETRY_DELAYS_MIN.length - 1)];
        await storage.updateNotification(n.id, {
          attempts,
          lastError: errorText(e),
          nextAttemptAt: new Date(now.getTime() + delayMin * 60_000),
        });
        result.retried++;
      }
    }
  }
  return result;
}

// ── Фоновый запуск ────────────────────────────────────────────────────────────
// Один процесс приложения — достаточно флага, чтобы проходы не пересекались.
let running = false;
let rerunRequested = false;

async function runOnce(): Promise<void> {
  if (running) {
    rerunRequested = true;
    return;
  }
  running = true;
  try {
    do {
      rerunRequested = false;
      const r = await processEmailQueue();
      if (r.sent || r.failed || r.retried) {
        console.log(`[email] queue: sent=${r.sent} retried=${r.retried} failed=${r.failed}`);
      }
    } while (rerunRequested);
  } catch (e) {
    console.error("[email] queue error:", errorText(e));
  } finally {
    running = false;
  }
}

/** Разбудить очередь сразу (например, после создания уведомления). */
export function kickEmailQueue(): void {
  void runOnce();
}

export function startEmailQueue(): void {
  setInterval(() => void runOnce(), POLL_INTERVAL_MS).unref();
  void runOnce();
}
