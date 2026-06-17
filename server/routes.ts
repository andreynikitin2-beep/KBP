import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { performLdapSync, syncSingleLdapUser } from "./ldapSync";
import { sanitizeHtml } from "@shared/sanitize";

// Sanitize the HTML stored inside a material version's content before it is
// persisted. Page/HTML content lives in contentPage.html.
function sanitizeContentPage(data: any): any {
  if (!data || typeof data !== "object") return data;
  if (data.contentPage && typeof data.contentPage === "object" && typeof data.contentPage.html === "string") {
    return {
      ...data,
      contentPage: { ...data.contentPage, html: sanitizeHtml(data.contentPage.html) },
    };
  }
  return data;
}

const TIMESTAMP_FIELDS = [
  "createdAt", "lastReviewedAt", "nextReviewAt", "viewedAt",
  "slaReactedAt", "slaUpdatedAt", "lastSyncAt", "deactivatedAt", "syncedAt",
  "addedAt", "assignedAt", "acknowledgedAt", "rejectedAt", "archivedAt"
];

function coerceDates(data: any): any {
  if (!data || typeof data !== "object") return data;
  const result = { ...data };
  for (const key of TIMESTAMP_FIELDS) {
    if (key in result && typeof result[key] === "string") {
      result[key] = new Date(result[key]);
    }
  }
  return result;
}

function sanitizeApiKey(key: string): string {
  // Replace typographic dashes (em dash —, en dash –) with hyphens, strip other non-ASCII
  return key
    .replace(/\u2014/g, "-") // em dash —
    .replace(/\u2013/g, "-") // en dash –
    .replace(/[^\x20-\x7E]/g, ""); // strip remaining non-printable / non-ASCII
}

function buildChatEndpoint(baseUrl?: string | null): string {
  if (!baseUrl) return "https://api.openai.com/v1/chat/completions";
  const base = baseUrl.replace(/\/$/, "");
  // If user already specified the full endpoint (ends with /chat/completions), use as-is
  if (base.endsWith("/chat/completions")) return base;
  return `${base}/chat/completions`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/auth/users-list", async (_req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        source: u.source,
        department: u.department,
        roles: u.roles,
        isAvailable: u.isAvailable,
        deactivatedAt: u.deactivatedAt,
      })));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { userId, password } = req.body;
      if (!userId || !password) {
        return res.status(400).json({ error: "Не указан пользователь или пароль" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Пользователь не найден" });
      }

      if (user.source === "ad") {
        const adConfig = await storage.getAdIntegrationConfig();
        if (adConfig && adConfig.enabled && adConfig.mode === "LDAP" && adConfig.ssoUrl && adConfig.baseDn) {
          const { authenticateViaLdap } = await import("./ldapSync");
          const ldapResult = await authenticateViaLdap(
            adConfig.ssoUrl,
            adConfig.baseDn,
            user.adAccountName || user.username,
            password,
          );
          if (!ldapResult.ok) {
            return res.status(401).json({ error: ldapResult.message });
          }
        } else {
          if (user.password && user.password !== password) {
            return res.status(401).json({ error: "Неверный пароль" });
          }
        }
      } else {
        if (user.password !== password) {
          return res.status(401).json({ error: "Неверный пароль" });
        }
      }

      await storage.updateUser(user.id, { lastLoginAt: new Date() });
      const token = await storage.createSession(user.id);
      const { password: _p, ...safeUser } = user;
      res.json({ ok: true, user: { ...safeUser, lastLoginAt: new Date().toISOString() }, token });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (token) await storage.deleteSession(token);
      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });

  // USERS
  app.get("/api/users", async (_req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const user = await storage.createUser(coerceDates(req.body));
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, coerceDates(req.body));
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // USER SUBSCRIPTIONS
  app.get("/api/users/:userId/subscriptions", async (req, res) => {
    try {
      const subs = await storage.getSubscriptionsByUser(req.params.userId);
      res.json(subs);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // CATALOG NODES
  app.get("/api/catalog-nodes", async (_req, res) => {
    try {
      const nodes = await storage.getCatalogNodes();
      res.json(nodes);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/catalog-nodes", async (req, res) => {
    try {
      const node = await storage.createCatalogNode(req.body);
      res.json(node);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/catalog-nodes/:id", async (req, res) => {
    try {
      const node = await storage.updateCatalogNode(req.params.id, req.body);
      if (!node) return res.status(404).json({ error: "Catalog node not found" });
      res.json(node);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/catalog-nodes/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCatalogNode(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Catalog node not found" });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // VISIBILITY GROUPS
  app.get("/api/visibility-groups", async (_req, res) => {
    try {
      const groups = await storage.getVisibilityGroups();
      res.json(groups);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/visibility-groups", async (req, res) => {
    try {
      const group = await storage.createVisibilityGroup(req.body);
      res.json(group);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/visibility-groups/:id", async (req, res) => {
    try {
      const group = await storage.updateVisibilityGroup(req.params.id, req.body);
      if (!group) return res.status(404).json({ error: "Visibility group not found" });
      res.json(group);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/visibility-groups/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteVisibilityGroup(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Visibility group not found" });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // IMAGES (uploaded screenshots referenced by URL instead of inline base64)
  app.post("/api/images", async (req, res) => {
    try {
      const { dataUrl } = req.body as { dataUrl?: string };
      if (!dataUrl || typeof dataUrl !== "string") {
        return res.status(400).json({ error: "dataUrl is required" });
      }
      const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
      if (!match) {
        return res.status(400).json({ error: "Invalid data URL" });
      }
      const mimeType = match[1];
      const data = match[2];
      if (!mimeType.startsWith("image/")) {
        return res.status(400).json({ error: "Only image uploads are allowed" });
      }
      const image = await storage.createImage({ data, mimeType });
      res.json({ id: image.id, url: `/api/images/${image.id}` });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/images/:id", async (req, res) => {
    try {
      const image = await storage.getImage(req.params.id);
      if (!image) return res.status(404).json({ error: "Image not found" });
      const buffer = Buffer.from(image.data, "base64");
      res.setHeader("Content-Type", image.mimeType);
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // MATERIAL VERSIONS
  app.get("/api/material-versions", async (_req, res) => {
    try {
      const versions = await storage.getMaterialVersions();
      res.json(versions.map(({ contentFileData: _cfd, ...rest }: any) => rest));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/material-versions/:id", async (req, res) => {
    try {
      const version = await storage.getMaterialVersion(req.params.id);
      if (!version) return res.status(404).json({ error: "Material version not found" });
      const { contentFileData: _cfd, ...rest } = version as any;
      res.json(rest);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/material-versions/:id/file", async (req, res) => {
    try {
      const version = await storage.getMaterialVersion(req.params.id);
      if (!version || !(version as any).contentFileData) {
        return res.status(404).json({ error: "File not found" });
      }
      const fileInfo = version.contentFile as any;
      const mimeType = fileInfo?.type === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const fileName = fileInfo?.name || "file";
      const buffer = Buffer.from((version as any).contentFileData, "base64");
      const isInline = req.query.inline === "true";
      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        isInline
          ? `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
          : `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/material-versions", async (req, res) => {
    try {
      const version = await storage.createMaterialVersion(coerceDates(sanitizeContentPage(req.body)));
      res.json(version);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/material-versions/:id", async (req, res) => {
    try {
      const version = await storage.updateMaterialVersion(req.params.id, coerceDates(sanitizeContentPage(req.body)));
      if (!version) return res.status(404).json({ error: "Material version not found" });
      res.json(version);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/materials/:materialId", async (req, res) => {
    try {
      const deleted = await storage.deleteMaterialByMaterialId(req.params.materialId);
      if (!deleted) return res.status(404).json({ error: "Material not found" });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // MATERIALS SUB-ROUTES
  app.get("/api/materials/:materialId/versions", async (req, res) => {
    try {
      const versions = await storage.getMaterialVersionsByMaterialId(req.params.materialId);
      res.json(versions);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/materials/:materialId/subscribers", async (req, res) => {
    try {
      const subs = await storage.getSubscribers(req.params.materialId);
      res.json(subs);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/materials/:materialId/subscribers", async (req, res) => {
    try {
      const sub = await storage.addSubscriber({ materialId: req.params.materialId, userId: req.body.userId });
      res.json(sub);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/materials/:materialId/subscribers/:userId", async (req, res) => {
    try {
      const removed = await storage.removeSubscriber(req.params.materialId, req.params.userId);
      if (!removed) return res.status(404).json({ error: "Subscriber not found" });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/materials/:materialId/audit-views", async (req, res) => {
    try {
      const views = await storage.getAuditViews(req.params.materialId);
      res.json(views);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/materials/:materialId/rfcs", async (req, res) => {
    try {
      const rfcs = await storage.getRfcsByMaterialId(req.params.materialId);
      res.json(rfcs);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/materials/:materialId/ratings", async (req, res) => {
    try {
      const ratings = await storage.getRatingsByMaterial(req.params.materialId);
      res.json(ratings);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // AUDIT VIEWS
  app.post("/api/audit-views", async (req, res) => {
    try {
      const view = await storage.createAuditView(coerceDates(req.body));
      res.json(view);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // VIEW LOG
  app.post("/api/view-log", async (req, res) => {
    try {
      const log = await storage.createViewLog(coerceDates(req.body));
      res.json(log);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/view-log/check", async (req, res) => {
    try {
      const { materialId, userId, minutes } = req.query;
      if (!materialId || !userId || !minutes) {
        return res.status(400).json({ error: "materialId, userId, and minutes query params are required" });
      }
      const logs = await storage.getRecentViewLog(
        materialId as string,
        userId as string,
        Number(minutes)
      );
      res.json(logs);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // RFCS
  app.get("/api/rfcs", async (_req, res) => {
    try {
      const rfcs = await storage.getRfcs();
      res.json(rfcs);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/rfcs/:id", async (req, res) => {
    try {
      const rfc = await storage.getRfc(req.params.id);
      if (!rfc) return res.status(404).json({ error: "RFC not found" });
      res.json(rfc);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/rfcs", async (req, res) => {
    try {
      const rfc = await storage.createRfc(coerceDates(req.body));
      res.json(rfc);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/rfcs/:id", async (req, res) => {
    try {
      const rfc = await storage.updateRfc(req.params.id, coerceDates(req.body));
      if (!rfc) return res.status(404).json({ error: "RFC not found" });
      res.json(rfc);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // RFC COMMENTS
  app.get("/api/rfcs/:rfcId/comments", async (req, res) => {
    try {
      const comments = await storage.getRfcComments(req.params.rfcId);
      res.json(comments);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/rfcs/:rfcId/comments", async (req, res) => {
    try {
      const comment = await storage.createRfcComment({ rfcId: req.params.rfcId, ...req.body });
      res.json(comment);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // NOTIFICATIONS
  app.get("/api/notifications", async (_req, res) => {
    try {
      const notifications = await storage.getNotifications();
      res.json(notifications);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const notification = await storage.createNotification(coerceDates(req.body));
      res.json(notification);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // HELPFUL RATINGS
  app.get("/api/ratings", async (_req, res) => {
    try {
      const ratings = await storage.getRatings();
      res.json(ratings);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/ratings/check", async (req, res) => {
    try {
      const { userId, materialId, date } = req.query;
      if (!userId || !materialId || !date) {
        return res.status(400).json({ error: "userId, materialId, and date query params are required" });
      }
      const rating = await storage.getRating(
        userId as string,
        materialId as string,
        date as string
      );
      if (!rating) return res.status(404).json({ error: "Rating not found" });
      res.json(rating);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/ratings", async (req, res) => {
    try {
      const rating = await storage.createRating(req.body);
      res.json(rating);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // EMAIL CONFIG
  app.get("/api/email-config", async (_req, res) => {
    try {
      const config = await storage.getEmailConfig();
      res.json(config || null);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.put("/api/email-config", async (req, res) => {
    try {
      const config = await storage.upsertEmailConfig(req.body);
      res.json(config);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/email/test", async (req, res) => {
    try {
      const { to } = req.body;
      if (!to || typeof to !== "string") {
        return res.status(400).json({ message: "Укажите адрес получателя" });
      }
      const config = await storage.getEmailConfig();
      if (!config || !config.smtpHost) {
        return res.status(400).json({ message: "SMTP-сервер не настроен" });
      }
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: config.smtpUseTls && (config.smtpPort === 465),
        requireTLS: config.smtpUseTls && (config.smtpPort !== 465),
        auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword || "" } : undefined,
        connectionTimeout: 8000,
        greetingTimeout: 5000,
        tls: { rejectUnauthorized: false },
      } as any);
      await transporter.sendMail({
        from: config.senderName ? `"${config.senderName}" <${config.senderAddress}>` : config.senderAddress,
        to,
        subject: "Тестовое письмо — Центр знаний ЦОС",
        text: "Это тестовое письмо от Портала инструкций. Если вы получили это письмо, настройка почтовой рассылки работает корректно.",
        html: "<p>Это тестовое письмо от <strong>Портала инструкций</strong>.</p><p>Если вы получили это письмо, настройка почтовой рассылки работает корректно.</p>",
      });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Ошибка отправки письма" });
    }
  });

  // EMAIL TEMPLATES
  app.get("/api/email-templates", async (_req, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      res.json(templates);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/email-templates/:id", async (req, res) => {
    try {
      const template = await storage.updateEmailTemplate(req.params.id, req.body);
      if (!template) return res.status(404).json({ error: "Email template not found" });
      res.json(template);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // MATERIAL FEEDBACK (report error / suggest improvement)
  async function sendFeedbackEmail(opts: {
    templateKey: string;
    materialId: string;
    reporterUserId: string;
    message: string;
  }) {
    const versions = await storage.getMaterialVersionsByMaterialId(opts.materialId);
    const current = versions.find((v) => v.status === "Опубликовано" || v.status === "На пересмотре") ?? versions[0];
    if (!current) throw new Error("Material not found");

    const allUsers = await storage.getUsers();
    const reporter = allUsers.find((u) => u.id === opts.reporterUserId);
    const owner = allUsers.find((u) => u.id === (current.passport as any)?.ownerId);
    const admins = allUsers.filter((u) => (u.roles as string[]).includes("Администратор"));

    const recipientEmails = Array.from(
      new Set([
        ...(owner?.email ? [owner.email] : []),
        ...admins.map((a) => a.email).filter(Boolean),
      ])
    );
    if (recipientEmails.length === 0) return { emailSent: false, reason: "no_recipients" };

    const config = await storage.getEmailConfig();
    if (!config?.smtpHost) return { emailSent: false, reason: "smtp_not_configured" };

    const template = await storage.getEmailTemplateByKey(opts.templateKey);
    const title = (current.passport as any)?.title ?? current.title ?? opts.materialId;
    const link = `${process.env.PUBLIC_URL || ""}` + `/materials/${opts.materialId}`;
    const ownerName = owner?.displayName ?? "Владелец";

    const render = (str: string) =>
      str
        .replace(/\{\{title\}\}/g, title)
        .replace(/\{\{reporter\}\}/g, reporter?.displayName ?? opts.reporterUserId)
        .replace(/\{\{owner\}\}/g, ownerName)
        .replace(/\{\{message\}\}/g, opts.message)
        .replace(/\{\{link\}\}/g, link);

    const subject = template ? render(template.subject) : render(`Обратная связь по «{{title}}» от {{reporter}}`);
    const body = template ? render(template.body) : render(`{{reporter}} написал(а):\n\n{{message}}\n\nМатериал: {{link}}`);

    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: config.smtpUseTls && config.smtpPort === 465,
        requireTLS: config.smtpUseTls && config.smtpPort !== 465,
        auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword || "" } : undefined,
        connectionTimeout: 8000,
        greetingTimeout: 5000,
        tls: { rejectUnauthorized: false },
      } as any);

      const from = config.senderName ? `"${config.senderName}" <${config.senderAddress}>` : config.senderAddress;
      await transporter.sendMail({ from, to: recipientEmails.join(", "), subject, text: body });
      return { emailSent: true };
    } catch (smtpErr: any) {
      console.error("[email] Feedback send failed:", smtpErr?.message);
      return { emailSent: false, reason: "smtp_error" };
    }
  }

  app.post("/api/materials/:materialId/report-error", async (req, res) => {
    try {
      const userId = (req as any).session?.userId ?? req.headers["x-user-id"] as string;
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ ok: false, message: "Текст сообщения не может быть пустым" });
      const result = await sendFeedbackEmail({
        templateKey: "report_error",
        materialId: req.params.materialId,
        reporterUserId: userId,
        message: message.trim(),
      });
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(500).json({ ok: false, message: e?.message || "Ошибка отправки" });
    }
  });

  app.post("/api/materials/:materialId/suggest-improvement", async (req, res) => {
    try {
      const userId = (req as any).session?.userId ?? req.headers["x-user-id"] as string;
      const { message } = req.body;
      if (!message?.trim()) return res.status(400).json({ ok: false, message: "Текст сообщения не может быть пустым" });
      const result = await sendFeedbackEmail({
        templateKey: "suggest_improvement",
        materialId: req.params.materialId,
        reporterUserId: userId,
        message: message.trim(),
      });
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(500).json({ ok: false, message: e?.message || "Ошибка отправки" });
    }
  });

  // POLICY REVIEW PERIODS
  app.get("/api/policy/review-periods", async (_req, res) => {
    try {
      const periods = await storage.getPolicyReviewPeriods();
      res.json(periods);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/policy/review-periods/:id", async (req, res) => {
    try {
      const period = await storage.updatePolicyReviewPeriod(req.params.id, req.body);
      if (!period) return res.status(404).json({ error: "Policy review period not found" });
      res.json(period);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // POLICY RBAC DEFAULTS
  app.get("/api/policy/rbac-defaults", async (_req, res) => {
    try {
      const defaults = await storage.getPolicyRbacDefaults();
      res.json(defaults);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/policy/rbac-defaults/:id", async (req, res) => {
    try {
      const rbac = await storage.updatePolicyRbacDefault(req.params.id, req.body);
      if (!rbac) return res.status(404).json({ error: "Policy RBAC default not found" });
      res.json(rbac);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // AD INTEGRATION CONFIG
  app.get("/api/ad-config", async (_req, res) => {
    try {
      const config = await storage.getAdIntegrationConfig();
      res.json(config || null);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.put("/api/ad-config", async (req, res) => {
    try {
      const body = req.body;
      const dbData: any = {};
      if (body.enabled !== undefined) dbData.enabled = body.enabled;
      if (body.mode !== undefined) dbData.mode = body.mode;
      if (body.ssoUrl !== undefined) dbData.ssoUrl = body.ssoUrl;
      if (body.bindDn !== undefined) dbData.bindDn = body.bindDn;
      if (body.bindPassword !== undefined) dbData.bindPassword = body.bindPassword;
      if (body.baseDn !== undefined) dbData.baseDn = body.baseDn;
      if (body.syncFrequencyMinutes !== undefined) dbData.syncFrequencyMinutes = body.syncFrequencyMinutes;
      if (body.syncStatus !== undefined) dbData.syncStatus = body.syncStatus;
      if (body.lastSyncAt !== undefined) dbData.lastSyncAt = body.lastSyncAt ? new Date(body.lastSyncAt) : null;
      if (body.syncedUsersCount !== undefined) dbData.syncedUsersCount = body.syncedUsersCount;
      if (body.deactivatedCount !== undefined) dbData.deactivatedCount = body.deactivatedCount;
      if (body.mapping) {
        if (body.mapping.roles !== undefined) dbData.mappingRoles = body.mapping.roles;
        if (body.mapping.department !== undefined) dbData.mappingDepartment = body.mapping.department;
        if (body.mapping.legalEntity !== undefined) dbData.mappingLegalEntity = body.mapping.legalEntity;
        if (body.mapping.displayName !== undefined) dbData.mappingDisplayName = body.mapping.displayName;
        if (body.mapping.email !== undefined) dbData.mappingEmail = body.mapping.email;
      }
      const config = await storage.upsertAdIntegrationConfig(dbData);
      res.json(config);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // AD SYNC LOG
  app.get("/api/ad-sync-log", async (_req, res) => {
    try {
      const logs = await storage.getAdSyncLogs();
      res.json(logs);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/ad-sync-log", async (req, res) => {
    try {
      const log = await storage.createAdSyncLog(coerceDates(req.body));
      res.json(log);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // LDAP SYNC
  app.post("/api/ad-sync", async (_req, res) => {
    try {
      const result = await performLdapSync();
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, message: String(e) });
    }
  });

  app.post("/api/ad-sync/user", async (req, res) => {
    try {
      const { accountName } = req.body;
      if (!accountName || typeof accountName !== "string" || !accountName.trim()) {
        return res.status(400).json({ ok: false, message: "Не указано имя аккаунта" });
      }
      const result = await syncSingleLdapUser(accountName.trim());
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, message: String(e) });
    }
  });

  // EFFECTIVE VIS GROUP MAP
  app.get("/api/effective-vis-groups", async (_req, res) => {
    try {
      const map = await storage.getEffectiveVisGroupMap();
      res.json(map);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.put("/api/effective-vis-groups/:materialId", async (req, res) => {
    try {
      const result = await storage.upsertEffectiveVisGroupMap(req.params.materialId, req.body.visibilityGroupIds);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/effective-vis-groups/:materialId", async (req, res) => {
    try {
      const deleted = await storage.deleteEffectiveVisGroupMap(req.params.materialId);
      if (!deleted) return res.status(404).json({ error: "Effective vis group map not found" });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // NEW HIRES CONFIG
  app.get("/api/new-hires/config", async (_req, res) => {
    try {
      const config = await storage.getNewHiresConfig();
      res.json(config || { enabled: false });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.put("/api/new-hires/config", async (req, res) => {
    try {
      const config = await storage.upsertNewHiresConfig(req.body);
      res.json(config);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // NEW HIRE PROFILES
  app.get("/api/new-hires/profiles", async (_req, res) => {
    try {
      const profiles = await storage.getNewHireProfiles();
      res.json(profiles);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/new-hires/profiles", async (req, res) => {
    try {
      const profile = await storage.createNewHireProfile(coerceDates(req.body));
      res.json(profile);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/new-hires/profiles/:id", async (req, res) => {
    try {
      const profile = await storage.updateNewHireProfile(req.params.id, coerceDates(req.body));
      if (!profile) return res.status(404).json({ error: "New hire profile not found" });
      res.json(profile);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // NEW HIRE ASSIGNMENTS
  app.get("/api/new-hires/assignments", async (_req, res) => {
    try {
      const assignments = await storage.getNewHireAssignments();
      res.json(assignments);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/new-hires/assignments/user/:userId", async (req, res) => {
    try {
      const assignments = await storage.getNewHireAssignmentsByUser(req.params.userId);
      res.json(assignments);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/new-hires/assignments", async (req, res) => {
    try {
      const data = coerceDates(req.body);
      const existing = await storage.getNewHireAssignmentsByUser(data.userId);
      const dup = existing.find((a: any) => a.materialId === data.materialId);
      if (dup) return res.json(dup);
      const assignment = await storage.createNewHireAssignment(data);
      res.json(assignment);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/new-hires/assignments/:id/acknowledge", async (req, res) => {
    try {
      const assignment = await storage.updateNewHireAssignment(req.params.id, {
        acknowledgedAt: new Date(),
        acknowledgedVersionId: req.body.acknowledgedVersionId,
      });
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      res.json(assignment);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // AI STATUS (public to any authenticated user)
  app.get("/api/ai/status", async (_req, res) => {
    try {
      const settings = await storage.getAiSettings();
      res.json({
        enabled: settings?.enabled ?? false,
        htmlGeneratorEnabled: (settings?.enabled ?? false) && (settings?.htmlGeneratorEnabled ?? false),
      });
    } catch {
      res.json({ enabled: false, htmlGeneratorEnabled: false });
    }
  });

  async function verifySession(req: any): Promise<{ user: Awaited<ReturnType<typeof storage.getUser>>; token: string } | null> {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return null;
    const user = await storage.getSessionUser(token);
    if (!user) return null;
    return { user, token };
  }

  function isAdmin(user: NonNullable<Awaited<ReturnType<typeof storage.getUser>>>): boolean {
    return (user.roles as string[]).includes("Администратор");
  }

  // AI SETTINGS (admin only)
  app.get("/api/admin/ai-settings", async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      if (!isAdmin(session.user)) return res.status(403).json({ error: "Доступ только для администраторов" });
      const settings = await storage.getAiSettings();
      if (!settings) return res.json(null);
      const { apiKey, ...rest } = settings;
      const maskedKey = apiKey
        ? apiKey.slice(0, 4) + "••••••••" + (apiKey.length > 8 ? apiKey.slice(-4) : "")
        : "";
      res.json({ ...rest, apiKey: maskedKey });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.put("/api/admin/ai-settings", async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      if (!isAdmin(session.user)) return res.status(403).json({ error: "Доступ только для администраторов" });
      const { provider, apiKey, model, baseUrl, enabled, loggingEnabled, htmlGeneratorEnabled, htmlGeneratorSystemPrompt } = req.body;
      const existing = await storage.getAiSettings();
      const rawKey = apiKey && !apiKey.includes("••") ? apiKey : (existing?.apiKey || "");
      const finalKey = sanitizeApiKey(rawKey);
      const data: any = {
        provider: provider || "openai",
        apiKey: finalKey,
        model: model || "gpt-4o",
        baseUrl: baseUrl || "",
        enabled: enabled ?? false,
        loggingEnabled: loggingEnabled ?? true,
        htmlGeneratorEnabled: htmlGeneratorEnabled ?? (existing?.htmlGeneratorEnabled ?? false),
        htmlGeneratorSystemPrompt: htmlGeneratorSystemPrompt ?? (existing?.htmlGeneratorSystemPrompt ?? ""),
        updatedAt: new Date(),
      };
      const saved = await storage.upsertAiSettings(data);
      const { apiKey: savedKey, ...rest } = saved;
      const maskedKey = savedKey
        ? savedKey.slice(0, 4) + "••••••••" + (savedKey.length > 8 ? savedKey.slice(-4) : "")
        : "";
      res.json({ ...rest, apiKey: maskedKey });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // AI QUERY LOG (admin only)
  app.get("/api/admin/ai-query-log", async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      if (!isAdmin(session.user)) return res.status(403).json({ error: "Доступ только для администраторов" });
      const logs = await storage.getAiQueryLogs(500);
      const users = await storage.getUsers();
      const userMap: Record<string, string> = {};
      for (const u of users) userMap[u.id] = u.displayName || u.username;
      const enriched = logs.map((l) => ({ ...l, userName: userMap[l.userId] || l.userId }));
      res.json(enriched);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // AI TEST CONNECTION
  app.post("/api/admin/ai-test", async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      if (!isAdmin(session.user)) return res.status(403).json({ error: "Доступ только для администраторов" });
      const { provider, apiKey, model, baseUrl } = req.body;
      let key = apiKey;
      if (!key || key.includes("••")) {
        const stored = await storage.getAiSettings();
        key = stored?.apiKey || "";
      }
      key = sanitizeApiKey(key);
      if (!key) return res.status(400).json({ ok: false, message: "API-ключ не указан" });

      const testMsg = "Ответь одним словом: привет";

      if (provider === "anthropic") {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: model || "claude-3-5-sonnet-20241022",
            max_tokens: 20,
            messages: [{ role: "user", content: testMsg }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) {
          const err: any = await r.json().catch(() => ({}));
          return res.json({ ok: false, message: err?.error?.message || `HTTP ${r.status}` });
        }
        return res.json({ ok: true });
      } else {
        const endpoint = buildChatEndpoint(baseUrl);
        const r = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: model || "gpt-4o",
            max_tokens: 20,
            messages: [{ role: "user", content: testMsg }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) {
          const rawBody = await r.text().catch(() => "");
          console.error(`[ai-test] ${r.status} POST ${endpoint} model=${model || "gpt-4o"} body:`, rawBody || "(empty)");
          let errMsg = `HTTP ${r.status}`;
          try {
            const err = JSON.parse(rawBody);
            errMsg = err?.error?.message || err?.message || errMsg;
          } catch {}
          if (errMsg === `HTTP ${r.status}`) {
            errMsg = `HTTP ${r.status} — URL: ${endpoint}`;
          }
          return res.json({ ok: false, message: errMsg });
        }
        return res.json({ ok: true });
      }
    } catch (e: any) {
      res.json({ ok: false, message: e?.message || "Ошибка подключения" });
    }
  });

  // AI HTML GENERATOR
  app.post("/api/ai/generate-html", async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });

      const aiConfig = await storage.getAiSettings();
      if (!aiConfig || !aiConfig.enabled)
        return res.status(400).json({ error: "AI-помощник не настроен или отключён" });
      if (!aiConfig.htmlGeneratorEnabled)
        return res.status(400).json({ error: "AI HTML-генератор отключён администратором" });
      if (!aiConfig.apiKey)
        return res.status(400).json({ error: "API-ключ не настроен" });

      const { text, fileBase64, fileType, currentHtml, instruction } = req.body as {
        text?: string;
        fileBase64?: string;
        fileType?: "pdf" | "docx";
        currentHtml?: string;
        instruction?: string;
      };

      let warning: string | undefined;
      let sourceText = "";

      const isRefine = Boolean(currentHtml && currentHtml.trim() && instruction && instruction.trim());

      if (isRefine) {
        // Refinement mode: rework the existing draft using the author's follow-up
        // instruction. No source file/text extraction needed.
      } else if (fileBase64) {
        const base64Data = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
        const buffer = Buffer.from(base64Data, "base64");
        if (buffer.length > 20 * 1024 * 1024) {
          return res.status(400).json({ error: "Файл превышает 20 МБ" });
        }
        if (fileType === "docx") {
          const mammoth = (await import("mammoth")).default;
          const result = await mammoth.extractRawText({ buffer });
          sourceText = result.value || "";
        } else if (fileType === "pdf") {
          const { PDFParse } = await import("pdf-parse");
          const parser = new PDFParse({ data: new Uint8Array(buffer) });
          try {
            const result = await parser.getText();
            sourceText = result.text || "";
          } finally {
            await parser.destroy().catch(() => {});
          }
          if (sourceText.trim().length < 30) {
            warning = "Из PDF извлечено мало текста — возможно, это скан. Распознавание изображений (OCR) не выполняется.";
          }
        } else {
          return res.status(400).json({ error: "Неподдерживаемый тип файла" });
        }
      } else if (text && text.trim()) {
        sourceText = text;
      } else {
        return res.status(400).json({ error: "Не указан текст или файл для обработки" });
      }

      if (!isRefine) {
        // Clean artifacts: page numbers, repeated whitespace, common header/footer noise
        sourceText = sourceText
          .replace(/\r\n/g, "\n")
          .replace(/^\s*(?:стр\.?|страница|page)\s*\d+(?:\s*(?:из|of|\/)\s*\d+)?\s*$/gim, "")
          .replace(/^\s*\d+\s*$/gm, "")
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        if (!sourceText) {
          return res.status(400).json({ error: "Не удалось извлечь текст из источника" });
        }

        const MAX_SOURCE = 40000;
        if (sourceText.length > MAX_SOURCE) {
          sourceText = sourceText.slice(0, MAX_SOURCE);
          warning = (warning ? warning + " " : "") + "Текст инструкции был усечён до 40 000 символов.";
        }
      }

      const defaultRules = `Ты — помощник, который превращает текст инструкции в чистую HTML-страницу единого корпоративного формата для внутреннего портала знаний.
Правила оформления:
- Используй семантические теги: <h1> для названия, <h2>/<h3> для разделов, <p>, <ol>/<ul>, <table>, <blockquote>.
- Обязательно выдели раздел «Пошаговая инструкция» как <h2>Пошаговая инструкция</h2>, а сами шаги оформи нумерованным списком <ol>.
- Если какой-то фрагмент исходного текста явно описывает шаг, но его смысл или порядок не удаётся однозначно распознать, оформи этот шаг как <li data-unrecognized-step="true">…</li> — позже автор вручную исправит такие шаги. Не помечай так шаги, которые понятны.
- Там, где в тексте упоминается скриншот, изображение, «см. рисунок» и т.п., вставь плейсхолдер вида <div data-placeholder="screenshot" class="screenshot-placeholder">Здесь будет скриншот: краткое описание</div> вместо картинки.
- Не выдумывай информацию, которой нет в исходном тексте.
- Не добавляй inline-стили, <style>, <script>, <head>, <body>, markdown или markdown-ограждения (\`\`\`). Верни ТОЛЬКО валидный HTML-фрагмент содержимого.`;

      const adminRules = (aiConfig.htmlGeneratorSystemPrompt || "").trim();
      const systemPrompt = adminRules
        ? `${defaultRules}\n\nДополнительные правила оформления от администратора:\n${adminRules}`
        : defaultRules;

      const userPrompt = isRefine
        ? `Ниже приведена текущая HTML-страница инструкции и пожелание автора по её доработке. Внеси изменения согласно пожеланию, строго соблюдая те же правила оформления. Сохрани всё содержимое, которое автор не просил менять (включая уже вставленные изображения и плейсхолдеры). Верни ТОЛЬКО обновлённый HTML-фрагмент, без пояснений.\n\nТЕКУЩИЙ HTML:\n---\n${currentHtml}\n---\n\nПОЖЕЛАНИЕ АВТОРА:\n---\n${instruction}\n---`
        : `Преобразуй следующий текст инструкции в HTML-страницу по указанным правилам.\n\nИСХОДНЫЙ ТЕКСТ:\n---\n${sourceText}\n---`;

      // — Flush 200 OK headers immediately so the proxy idle-timeout doesn't
      //   kill the connection while we wait for the LLM (can take 60-120 s).
      //   We send a newline keepalive every 5 s; JSON.parse ignores leading
      //   whitespace so the client receives valid JSON at the end.
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const streamEnd = (payload: object) => {
        clearInterval(keepAlive);
        if (!res.writableEnded) {
          try { res.end(JSON.stringify(payload)); } catch {}
        }
      };

      const keepAlive = setInterval(() => {
        if (res.writableEnded) { clearInterval(keepAlive); return; }
        try { res.write("\n"); } catch { clearInterval(keepAlive); }
      }, 5000);

      let html = "";

      if (aiConfig.provider === "anthropic") {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": sanitizeApiKey(aiConfig.apiKey),
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: aiConfig.model || "claude-3-5-sonnet-20241022",
            max_tokens: 8192,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          }),
          signal: AbortSignal.timeout(300000),
        });
        if (!r.ok) {
          const err: any = await r.json().catch(() => ({}));
          return streamEnd({ error: err?.error?.message || "Ошибка LLM" });
        }
        const data: any = await r.json();
        html = data.content?.[0]?.text || "";
      } else {
        const chatEndpoint = buildChatEndpoint(aiConfig.baseUrl);
        const r = await fetch(chatEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sanitizeApiKey(aiConfig.apiKey)}`,
          },
          body: JSON.stringify({
            model: aiConfig.model || "gpt-4o",
            max_tokens: 8192,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
          signal: AbortSignal.timeout(300000),
        });
        if (!r.ok) {
          const err: any = await r.json().catch(() => ({}));
          return streamEnd({ error: err?.error?.message || "Ошибка LLM" });
        }
        const data: any = await r.json();
        html = data.choices?.[0]?.message?.content || "";
      }

      // Strip markdown code fences if the model wrapped the output
      html = html
        .replace(/^\s*```(?:html)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();

      if (!html) return streamEnd({ error: "LLM вернул пустой результат" });

      // Sanitize the model output before it ever reaches the author/editor.
      html = sanitizeHtml(html);
      if (!html) return streamEnd({ error: "LLM вернул пустой результат" });

      streamEnd({ html, warning });
    } catch (e: any) {
      console.error("[generate-html]", e?.message || e);
      if (res.headersSent) {
        // Headers already flushed — encode the error in the body stream
        if (!res.writableEnded) {
          try { res.end(JSON.stringify({ error: e?.message || "Ошибка генерации HTML" })); } catch {}
        }
      } else {
        res.status(500).json({ error: e?.message || "Ошибка генерации HTML" });
      }
    }
  });

  // AI CHAT HISTORY
  app.get("/api/ai/history", async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      const sessions = await storage.getAiChatSessions(session.user.id);
      const result = await Promise.all(
        sessions.slice(0, 20).map(async (s) => {
          const msgs = await storage.getAiChatMessages(s.id);
          return { ...s, messages: msgs };
        })
      );
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Внутренняя ошибка" });
    }
  });

  app.delete("/api/ai/history/:sessionId", async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      const chatSession = await storage.getAiChatSession(req.params.sessionId);
      if (!chatSession) return res.status(404).json({ error: "Сессия не найдена" });
      if (chatSession.userId !== session.user.id) return res.status(403).json({ error: "Нет доступа" });
      const ok = await storage.deleteAiChatSession(req.params.sessionId);
      res.json({ ok });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Внутренняя ошибка" });
    }
  });

  // AI CHAT WITH RAG
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, history = [], sessionId: incomingSessionId } = req.body;
      if (!message)
        return res.status(400).json({ error: "message обязателен" });

      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });

      const user = session.user;
      const userId = user.id;

      const aiConfig = await storage.getAiSettings();

      if (!user) return res.status(401).json({ error: "Пользователь не найден" });
      if (!aiConfig || !aiConfig.enabled)
        return res.status(400).json({ error: "AI-помощник не настроен или отключён" });
      if (!aiConfig.apiKey)
        return res.status(400).json({ error: "API-ключ не настроен" });

      const [allVersions, groups] = await Promise.all([
        storage.searchPublishedMaterialsByQuery(message),
        storage.getVisibilityGroups(),
      ]);

      const isAdmin = (user.roles as string[]).includes("Администратор");

      const accessible = allVersions.filter((v: any) => {
        if (isAdmin) return true;
        const gIds = v.visibilityGroupIds as string[];
        if (!gIds || gIds.length === 0) return true;
        for (const gId of gIds) {
          const group = groups.find((g) => g.id === gId);
          if (!group) continue;
          if (group.isSystem) return true;
          if ((group.memberIds as string[]).includes(userId)) return true;
        }
        return false;
      });

      const materialsWithText = accessible
        .map((v: any) => {
          let text = "";
          if ((v.contentKind === "page" || v.contentKind === "html") && v.contentPage) {
            text = ((v.contentPage as any).html || "")
              .replace(/<[^>]*>/g, " ")
              .replace(/&[a-z]+;/gi, " ")
              .replace(/\s+/g, " ")
              .trim();
          } else if (v.contentKind === "file" && v.contentFile) {
            text = ((v.contentFile as any).extractedText || "")
              .replace(/\s+/g, " ")
              .trim();
          }
          return { materialId: v.materialId, title: v.title, text, rank: (v as any).rank ?? 0 };
        })
        .filter((m: any) => m.text.length > 50);

      // Sort by FTS rank DESC; include both ranked and unranked (page/html may have rank=0)
      const sorted = [...materialsWithText].sort((a: any, b: any) => b.rank - a.rank);
      const contextMaterials = sorted.slice(0, 8);

      if (contextMaterials.length === 0) {
        return res.json({
          answer:
            "К сожалению, в базе знаний не найдено материалов, доступных вам и релевантных вашему вопросу.",
          sources: [],
        });
      }

      const MAX_CHARS = 3000;
      const contextBlocks = contextMaterials
        .map(
          (m: any) =>
            `[ID: ${m.materialId}] Материал: "${m.title}"\n${m.text.slice(0, MAX_CHARS)}`,
        )
        .join("\n\n---\n\n");

      const systemPrompt = `Ты — AI-помощник внутреннего портала знаний «Центр знаний ЦОС». Отвечай на вопросы сотрудников полно и развёрнуто, опираясь СТРОГО на предоставленные фрагменты из базы знаний. Если ответа нет в предоставленных материалах — честно сообщи об этом. Не придумывай информацию. Отвечай на русском языке. Не перечисляй источники в конце ответа — они будут добавлены автоматически.\n\nДоступные материалы из базы знаний:\n---\n${contextBlocks}\n---`;

      const chatHistory = (history as any[]).map((h) => ({
        role: h.role,
        content: h.content,
      }));

      let answer = "";

      if (aiConfig.provider === "anthropic") {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": sanitizeApiKey(aiConfig.apiKey),
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: aiConfig.model || "claude-3-5-sonnet-20241022",
            max_tokens: 2048,
            system: systemPrompt,
            messages: [...chatHistory, { role: "user", content: message }],
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (res.headersSent) return;
        if (!r.ok) {
          const err: any = await r.json().catch(() => ({}));
          return res
            .status(500)
            .json({ error: err?.error?.message || "Ошибка LLM" });
        }
        const data: any = await r.json();
        answer = data.content?.[0]?.text || "";
      } else {
        const chatEndpoint = buildChatEndpoint(aiConfig.baseUrl);
        const r = await fetch(chatEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sanitizeApiKey(aiConfig.apiKey)}`,
          },
          body: JSON.stringify({
            model: aiConfig.model || "gpt-4o",
            max_tokens: 2048,
            messages: [
              { role: "system", content: systemPrompt },
              ...chatHistory,
              { role: "user", content: message },
            ],
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (res.headersSent) return;
        if (!r.ok) {
          const err: any = await r.json().catch(() => ({}));
          return res
            .status(500)
            .json({ error: err?.error?.message || "Ошибка LLM" });
        }
        const data: any = await r.json();
        answer = data.choices?.[0]?.message?.content || "";
      }

      // Determine which materials were actually used by lexical overlap with the answer.
      // Tokenise answer into significant lowercase words (≥4 chars, Cyrillic/Latin).
      function tokenize(text: string): Set<string> {
        const words = text.toLowerCase().match(/[а-яёa-z]{4,}/g) || [];
        return new Set(words);
      }
      const answerTokens = tokenize(answer);
      const STOP = new Set(["этот","этого","этому","этим","этих","что","как","для","при","или","все","они","его","её","или","над","под","без","про","через","после","перед","между","которые","который","которая","которого"]);
      answerTokens.forEach((w) => { if (STOP.has(w)) answerTokens.delete(w); });

      const scoredMaterials = contextMaterials.map((m: any) => {
        const matTokens = tokenize(m.text);
        let hits = 0;
        answerTokens.forEach((w) => { if (matTokens.has(w)) hits++; });
        const score = answerTokens.size > 0 ? hits / answerTokens.size : 0;
        return { ...m, score };
      });

      // Keep materials where ≥8% of answer words appear in the material text, or top-1 if none qualify
      const THRESHOLD = 0.08;
      let usedMaterials = scoredMaterials.filter((m: any) => m.score >= THRESHOLD);
      if (usedMaterials.length === 0 && scoredMaterials.length > 0) {
        // Fallback: top-1 by score
        const best = scoredMaterials.reduce((a: any, b: any) => a.score >= b.score ? a : b);
        if (best.score > 0) usedMaterials = [best];
      }

      const sources = usedMaterials.map((m: any) => ({
        materialId: m.materialId,
        title: m.title,
      }));

      if (aiConfig.loggingEnabled !== false) {
        storage.createAiQueryLog({
          userId,
          question: message,
          sourcesUsed: sources.map((s: any) => s.materialId),
          tokensUsed: null,
        }).catch(() => {});
      }

      let activeSessionId = incomingSessionId as string | undefined;
      if (activeSessionId) {
        const existing = await storage.getAiChatSession(activeSessionId);
        if (!existing || existing.userId !== userId) activeSessionId = undefined;
      }
      if (!activeSessionId) {
        const newSession = await storage.createAiChatSession(userId, message.slice(0, 120));
        activeSessionId = newSession.id;
      } else {
        storage.touchAiChatSession(activeSessionId).catch(() => {});
      }

      await Promise.all([
        storage.createAiChatMessage({ sessionId: activeSessionId, role: "user", content: message, sources: null }),
        storage.createAiChatMessage({ sessionId: activeSessionId, role: "assistant", content: answer, sources }),
      ]);

      if (!res.headersSent)
        res.json({ answer, sources, sessionId: activeSessionId });
    } catch (e: any) {
      if (!res.headersSent)
        res.status(500).json({ error: e?.message || "Внутренняя ошибка" });
    }
  });

  return httpServer;
}
