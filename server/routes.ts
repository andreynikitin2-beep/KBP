import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { spawn } from "child_process";
import crypto from "crypto";
import { storage, recoverContentFile, recoverAdditionalFile } from "./storage";
import { performLdapSync, syncSingleLdapUser } from "./ldapSync";
import { createMailTransport, formatFrom, kickEmailQueue } from "./mailer";
import { sanitizeHtml } from "@shared/sanitize";
import * as fileStorage from "./fileStorage";
import { extractDocumentText } from "./documentText";
import { isMaskedOrEmpty, maskSecret, verifyPassword } from "./secrets";
import { canChangeCatalogNode, hasAdminRole, isAdminRoute, isPublicRoute } from "./apiAccess";
import {
  canCreateVersion,
  canUpdateVersion,
  canViewVersion,
  isMaterialManager,
  type AccessContext,
  type VersionRow,
} from "@shared/materialAccess";

const SESSION_COOKIE = "kb_session";
const MIN_PASSWORD_LENGTH = 8;
// Same window as the client: repeated opens within it count as one view.
const VIEW_DEDUP_MINUTES = 30;

/** YYYY-MM-DD in Moscow time — the portal's day for "one rating per day". */
function moscowDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
// Uploads are buffered in memory until complete; same limit as nginx (512m).
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;
const MAX_UPLOAD_CHUNKS = 512; // HTTP fallback sends 1 MB chunks
const SAFE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readCookie(req: any, name: string): string {
  const header: string = req.headers?.cookie || "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      try { return decodeURIComponent(part.slice(eq + 1).trim()); } catch { return ""; }
    }
  }
  return "";
}

/**
 * Links, <img> and the PDF preview cannot send the Authorization header, so
 * the session token is mirrored into an HttpOnly cookie. It is accepted only
 * for GET requests (see verifySession); SameSite=Strict blocks cross-site use.
 */
function setSessionCookie(req: any, res: any, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    path: "/api",
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  });
}

function encryptPortalSettings(json: string, password: string): Buffer {
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("KBPS"), salt, iv, tag, encrypted]);
}

function decryptPortalSettings(buf: Buffer, password: string): string {
  if (buf.length < 68 || buf.slice(0, 4).toString() !== "KBPS") throw new Error("Неверный формат файла");
  const salt = buf.slice(4, 36);
  const iv = buf.slice(36, 52);
  const tag = buf.slice(52, 68);
  const encrypted = buf.slice(68);
  const key = crypto.scryptSync(password, salt, 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}

const HTML_GENERATOR_DEFAULT_PROMPT = `Ты — технический писатель и UX-редактор базы знаний. Твоя задача — преобразовывать инструкции, переданные автором в формате PDF, DOC/DOCX или обычного текста, в единообразные HTML-страницы для внутренней базы знаний.

## ЗАДАЧА
Преобразуй исходный текст инструкции (из файла или текстового описания процесса) в профессиональную HTML-страницу единого корпоративного формата, готовую к размещению в базе знаний.

## СТИЛЬ И ТОНАЛЬНОСТЬ
- Нейтральный, объясняющий тон — как опытный коллега проводит новичка по процессу
- Структура: контекст и цель → что нужно для начала → шаги → нюансы и ограничения
- Язык: русский, короткие предложения, в шагах — повелительное наклонение («Откройте...», «Нажмите...», «Заполните...»)
- Без канцелярита и избыточных вводных конструкций
- Один шаг = одно действие; не объединять несколько действий в один пункт
- Если в исходном файле шаги расположены непоследовательно или дублируются — переупорядочить и схлопнуть дубликаты при переносе в HTML

## КОРПОРАТИВНАЯ ЦВЕТОВАЯ СХЕМА
Используется та же палитра, что и в письмах — для единого визуального языка компании:

| Переменная         | HEX     | Применение                                              |
|--------------------|---------|---------------------------------------------------------------|
| Midnight Blue      | #41566D | Заголовки разделов внутри карточек, акцентная линия           |
| Graphite           | #323E48 | Основной текст, заголовки разделов                            |
| Turquoise          | #45A19F | Номера шагов, акценты, маркеры списков                        |
| Green              | #92C143 | Опционально для позитивных статусов внутри шагов (фон #F2F8E8)|
| Orange             | #F29957 | Предупреждения, ограничения (фон светлый: #FEF3EA)            |
| Gray               | #ACB3BC | Вторичный текст, подписи к скриншотам, строка «Результат»     |
| Фон страницы       | #F4F5F6 | Внешний фон вокруг карточек разделов                          |
| Фон блоков         | #FFFFFF | Белые карточки разделов                                       |

## ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ К HTML-СТРАНИЦЕ
Это веб-страница базы знаний, а не email-рассылка — ограничения Outlook не действуют:
- Допустимы flexbox/grid, встроенный <style> в <head>, CSS-переменные
- Один самостоятельный HTML-файл без внешних зависимостей: стили только встроенным <style> в <head>, отдельные CSS-файлы не подключать
- Адаптивная вёрстка: корректное отображение от 360px (мобильный) до 1200px+ (десктоп)
- Шрифты: системный стек (system-ui, "Segoe UI", Arial, sans-serif)
- Семантичная вёрстка: <header>, <nav>, <main>, <section>, <footer> вместо вложенных <div>
- На каждом заголовке раздела — якорь (id), чтобы можно было дать прямую ссылку на нужный шаг
- Скриншоты/иллюстрации — через <img> с обязательным alt-текстом; подпись под изображением — серый текст 12px
- Картинки кодируются в base64 прямо в src — внешних файлов и ссылок на хранилище не использовать
- Сворачиваемые блоки (FAQ, доп. сведения) — через <details>/<summary> (работает без JS)
- JavaScript не использовать; вся интерактивность реализуется чисто на HTML/CSS
- Код, команды, названия полей форм — моноширинный шрифт (Consolas, Menlo, monospace), фон #F4F5F6, padding 8–12px, border-radius 4px
- Доступность: контраст текста не ниже AA, основной текст не менее 14px, видимые focus-стили на интерактивных элементах
- Версия для печати: через @media print скрывать навигацию и интерактивные элементы

## СТРУКТУРА ИНСТРУКЦИИ

### 1. ШАПКА / ТИТУЛЬНЫЙ БЛОК
- Заголовок инструкции — Graphite #323E48, 24–28px, жирный
- Без хлебных крошек, плашки актуальности и строки «Версия: / Обновлено: / Автор:» — эта информация уже выводится самим порталом

### 2. КОРОТКОЕ ОПИСАНИЕ (TL;DR)
- Белый фон, отступы 24px
- 1–2 предложения: что делает инструкция и в какой ситуации её применять
- При необходимости отдельной строкой: «Эта инструкция не подходит, если...» со ссылкой на смежную инструкцию

### 3. ПРЕДВАРИТЕЛЬНЫЕ ТРЕБОВАНИЯ
- Заголовок раздела: Midnight Blue #41566D, 16px, жирный, нижняя линия-разделитель 2px solid #45A19F
- Список с маркерами-галочками (#45A19F): какие права доступа, программы, документы или данные нужны до начала
- Раздел не выводить, если у процесса нет предварительных условий

### 4. ПОШАГОВАЯ ИНСТРУКЦИЯ (ядро страницы)
- Каждый шаг — отдельный блок с рамкой 1px solid #E8EAEC, отступ между шагами 12px
- Слева круглый маркер с номером шага (фон #45A19F, белый текст, 28×28px)
- Заголовок шага — жирный #323E48, 14–16px; текст шага — обычный вес, тот же цвет
- При наличии скриншота — изображение под текстом шага с подписью 12px серым
- При наличии ожидаемого результата — отдельная строка курсивом, серый текст: «Результат: ...»

### 5. ВАЖНО / ОГРАНИЧЕНИЯ / ТИПИЧНЫЕ ОШИБКИ
- Фон #FEF3EA, рамка слева 4px solid #F29957, значок ⚠ перед заголовком
- Заголовок «Обратите внимание» — жирный #323E48
- Текст: ограничения процесса, частые ошибки пользователей, последствия неправильного выполнения

### 6. ОСОБЫЕ СЛУЧАИ / ИСКЛЮЧЕНИЯ (опционально)
- Белый фон, рамка слева 4px solid #45A19F (отличать цветом от блока «Важно»)
- Заголовок «Особые случаи» — жирный #41566D
- Сценарии вида «если у вас..., то...»

### 7. ЧАСТЫЕ ВОПРОСЫ (опционально)
- Сворачиваемые блоки <details>/<summary>
- Вопрос — жирный #323E48; при раскрытии ответ — обычный вес, тот же цвет
- Фон каждого блока белый, рамка 1px solid #E8EAEC

## ОТСТУПЫ МЕЖДУ БЛОКАМИ
Между разделами — воздух 16–24px (margin/padding секции); фон страницы #F4F5F6 виден между белыми карточками разделов.

## ПРАВИЛА ОБРАБОТКИ ИСХОДНОГО ФАЙЛА
- Если в исходнике нет данных для опционального раздела (3, 6 или 7) — раздел полностью пропускается, без пустых заголовков
- Если исходный файл содержит изображения/скриншоты — переносить их как <img>, не описывать словами
- Верни ТОЛЬКО валидный HTML-фрагмент содержимого страницы — без обёртки <html>/<body>/<head>, без <style>, без markdown-ограждений`;

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
  "createdAt", "updatedAt", "lastReviewedAt", "nextReviewAt", "viewedAt",
  "slaReactedAt", "slaUpdatedAt", "lastSyncAt", "deactivatedAt", "syncedAt",
  "addedAt", "assignedAt", "acknowledgedAt", "rejectedAt", "archivedAt",
  "lastLoginAt", "expiresAt", "lastTestedAt"
];

/**
 * Unexpected failures: log the details, send the client a neutral message so
 * database errors, paths and stack details do not leak.
 */
function sendServerError(req: any, res: any, e: unknown): void {
  console.error(`[api] ${req?.method} ${req?.originalUrl?.split("?")[0]} failed:`, e);
  if (!res.headersSent) res.status(500).json({ error: "Внутренняя ошибка сервера" });
}

/** Never send password hashes to the client. */
function toPublicUser<T extends { password?: unknown }>(user: T): Omit<T, "password"> {
  const { password: _password, ...rest } = user;
  return rest;
}

/** Tell the client whether a file version's binary actually exists on disk. */
function withFileStatus<T extends { id: string; contentKind?: string | null }>(version: T): T & { contentFileStored?: boolean } {
  if (version.contentKind !== "file") return version;
  return { ...version, contentFileStored: fileStorage.hasContentFile(version.id) };
}

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

function contextExcerpt(text: string, query: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const tokens = Array.from(new Set(
    query.toLowerCase().match(/[а-яёa-z0-9]{3,}/g) || [],
  ));
  const lowerText = text.toLowerCase();
  const positions = tokens
    .map((token) => lowerText.indexOf(token))
    .filter((position) => position >= 0);

  // Keep the beginning when the query has no direct substring hit. Otherwise
  // center the excerpt near the first matching term so later PDF pages are
  // available to the model as well.
  const firstHit = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, Math.min(firstHit - 800, text.length - maxChars));
  const excerpt = text.slice(start, start + maxChars);
  return `${start > 0 ? "… " : ""}${excerpt}${start + maxChars < text.length ? " …" : ""}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Every /api route requires a session; admin routes also require the role.
  app.use("/api", async (req, res, next) => {
    const path = req.originalUrl.split("?")[0];
    if (isPublicRoute(req.method, path)) return next();
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      if (isAdminRoute(req.method, path) && !hasAdminRole(session.user)) {
        return res.status(403).json({ error: "Доступ только для администраторов" });
      }
      (req as any).auth = session;
      // Sessions created before the cookie existed: give the browser one so
      // downloads and images keep working.
      if (session.token && readCookie(req, SESSION_COOKIE) !== session.token) {
        setSessionCookie(req, res, session.token);
      }
      next();
    } catch (e) {
      next(e);
    }
  });

  // Health check — used by Docker healthcheck and load balancers
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  app.get("/api/auth/users-list", async (req, res) => {
    try {
      // Public (login form): only who can sign in, and only their name —
      // no logins, departments, roles or account status.
      const users = await storage.getUsers();
      res.json(users
        .filter((u) => !u.deactivatedAt && u.isAvailable)
        .map((u) => ({ id: u.id, displayName: u.displayName })));
    } catch (e) {
      sendServerError(req, res, e);
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
      if (user.deactivatedAt) {
        return res.status(403).json({ error: "Учётная запись отключена" });
      }

      let passwordToRehash: string | undefined;
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
          // LDAP is off: only a local password can authenticate. An AD user
          // without one must not get in with an arbitrary password.
          const check = verifyPassword(password, user.password);
          if (!check.ok) {
            return res.status(401).json({ error: "Неверный пароль" });
          }
          if (check.needsRehash) passwordToRehash = password;
        }
      } else {
        const check = verifyPassword(password, user.password);
        if (!check.ok) {
          return res.status(401).json({ error: "Неверный пароль" });
        }
        if (check.needsRehash) passwordToRehash = password;
      }

      // Legacy plaintext password matched — replace it with a hash.
      await storage.updateUser(user.id, {
        lastLoginAt: new Date(),
        ...(passwordToRehash ? { password: passwordToRehash } : {}),
      });
      const token = await storage.createSession(user.id);
      setSessionCookie(req, res, token);
      const { password: _p, ...safeUser } = user;
      res.json({ ok: true, user: { ...safeUser, lastLoginAt: new Date().toISOString() }, token });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (token) await storage.deleteSession(token);
      res.clearCookie(SESSION_COOKIE, { path: "/api" });
      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });

  // USERS
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users.map(toPublicUser));
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(toPublicUser(user));
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const body = req.body ?? {};
      if (body.source !== "ad" && (typeof body.password !== "string" || body.password.length < MIN_PASSWORD_LENGTH)) {
        return res.status(400).json({ error: `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов` });
      }
      const user = await storage.createUser(coerceDates(body));
      res.json(toPublicUser(user));
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, coerceDates(req.body));
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(toPublicUser(user));
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // USER SUBSCRIPTIONS
  app.get("/api/users/:userId/subscriptions", async (req, res) => {
    try {
      if (!isSelfOrAdmin(req, req.params.userId)) return res.status(403).json({ error: "Недостаточно прав" });
      const subs = await storage.getSubscriptionsByUser(req.params.userId);
      res.json(subs);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // CATALOG NODES
  app.get("/api/catalog-nodes", async (req, res) => {
    try {
      const nodes = await storage.getCatalogNodes();
      res.json(nodes);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  async function catalogChangeAllowed(req: any, nodeId?: string): Promise<boolean> {
    const node = nodeId ? await storage.getCatalogNode(nodeId) : undefined;
    const parentId = nodeId ? node?.parentId : req.body?.parentId;
    const parent = parentId ? await storage.getCatalogNode(parentId) : undefined;
    return canChangeCatalogNode({ user: req.auth.user, method: req.method, body: req.body, node, parent });
  }

  app.post("/api/catalog-nodes", async (req, res) => {
    try {
      if (!(await catalogChangeAllowed(req))) return res.status(403).json({ error: "Недостаточно прав" });
      const node = await storage.createCatalogNode(req.body);
      res.json(node);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.patch("/api/catalog-nodes/:id", async (req, res) => {
    try {
      if (!(await catalogChangeAllowed(req, req.params.id))) return res.status(403).json({ error: "Недостаточно прав" });
      const node = await storage.updateCatalogNode(req.params.id, req.body);
      if (!node) return res.status(404).json({ error: "Catalog node not found" });
      res.json(node);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.delete("/api/catalog-nodes/:id", async (req, res) => {
    try {
      if (!(await catalogChangeAllowed(req, req.params.id))) return res.status(403).json({ error: "Недостаточно прав" });
      const deleted = await storage.deleteCatalogNode(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Catalog node not found" });
      res.json({ success: true });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // VISIBILITY GROUPS
  app.get("/api/visibility-groups", async (req, res) => {
    try {
      const groups = await storage.getVisibilityGroups();
      res.json(groups);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.post("/api/visibility-groups", async (req, res) => {
    try {
      const group = await storage.createVisibilityGroup(req.body);
      res.json(group);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.patch("/api/visibility-groups/:id", async (req, res) => {
    try {
      const group = await storage.updateVisibilityGroup(req.params.id, req.body);
      if (!group) return res.status(404).json({ error: "Visibility group not found" });
      res.json(group);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.delete("/api/visibility-groups/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteVisibilityGroup(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Visibility group not found" });
      res.json({ success: true });
    } catch (e) {
      sendServerError(req, res, e);
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
      // Raster formats only: SVG can carry scripts that run on our origin.
      if (!SAFE_IMAGE_TYPES.has(mimeType.toLowerCase())) {
        return res.status(400).json({ error: "Допустимы только изображения PNG, JPEG, GIF или WebP" });
      }
      const image = await storage.createImage({ data, mimeType });
      res.json({ id: image.id, url: `/api/images/${image.id}` });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/images/:id", async (req, res) => {
    try {
      const image = await storage.getImage(req.params.id);
      if (!image) return res.status(404).json({ error: "Image not found" });
      const buffer = Buffer.from(image.data, "base64");
      const safe = SAFE_IMAGE_TYPES.has(String(image.mimeType).toLowerCase());
      // Images stored before the whitelist (e.g. SVG) are served as downloads
      // and sandboxed, so opening them directly cannot run scripts.
      res.setHeader("Content-Type", safe ? image.mimeType : "application/octet-stream");
      if (!safe) res.setHeader("Content-Disposition", "attachment");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(buffer);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // MATERIAL ACCESS — visibility and edit rights are checked here, not only in the UI.
  async function loadAccessContext(): Promise<AccessContext> {
    const [groups, nodes, effective] = await Promise.all([
      storage.getVisibilityGroups(),
      storage.getCatalogNodes(),
      storage.getEffectiveVisGroupMap(),
    ]);
    return {
      groups: groups as any,
      nodes: nodes as any,
      effectiveGroupIds: Object.fromEntries(effective.map((e: any) => [e.materialId, e.visibilityGroupIds as string[]])),
    };
  }

  /** The version if the current user may see it; otherwise null (callers answer 404, not 403, to avoid leaking existence). */
  async function getVisibleVersion(req: any, versionId: string) {
    const version = await storage.getMaterialVersion(versionId);
    if (!version) return null;
    const ctx = await loadAccessContext();
    return canViewVersion(req.auth.user, version as VersionRow, ctx) ? version : null;
  }

  async function canViewMaterialId(req: any, materialId: string): Promise<boolean> {
    const versions = await storage.getMaterialVersionsByMaterialId(materialId);
    if (versions.length === 0) return false;
    const ctx = await loadAccessContext();
    return versions.some((v) => canViewVersion(req.auth.user, v as VersionRow, ctx));
  }

  /** Material ids the user may see (any visible version). */
  async function visibleMaterialIds(user: any): Promise<Set<string>> {
    const [versions, ctx] = await Promise.all([storage.getMaterialVersions(), loadAccessContext()]);
    const ids = new Set<string>();
    for (const v of versions) {
      if (!ids.has(v.materialId) && canViewVersion(user, v as VersionRow, ctx)) ids.add(v.materialId);
    }
    return ids;
  }

  /** Requests about another user's data: only that user or an admin. */
  function isSelfOrAdmin(req: any, userId: unknown): boolean {
    const me = req.auth.user;
    return userId === me.id || hasAdminRole(me);
  }

  async function canManageMaterialId(user: any, materialId: string): Promise<boolean> {
    const [all, ctx] = await Promise.all([storage.getMaterialVersionsByMaterialId(materialId), loadAccessContext()]);
    return all.some((v) => isMaterialManager(user, v as VersionRow, all as VersionRow[], ctx));
  }

  /** Uploading or deleting a material's files: the same people who may edit it. */
  async function canManageVersionFiles(user: any, versionId: string): Promise<boolean> {
    const version = await storage.getMaterialVersion(versionId);
    if (!version) return false;
    const [all, ctx] = await Promise.all([
      storage.getMaterialVersionsByMaterialId(version.materialId),
      loadAccessContext(),
    ]);
    return isMaterialManager(user, version as VersionRow, all as VersionRow[], ctx);
  }

  // MATERIAL VERSIONS
  app.get("/api/material-versions", async (req, res) => {
    try {
      const [versions, ctx] = await Promise.all([storage.getMaterialVersions(), loadAccessContext()]);
      const user = (req as any).auth.user;
      res.json(
        versions
          .filter((v) => canViewVersion(user, v as VersionRow, ctx))
          .map(({ contentFileData: _cfd, additionalFilesData: _afd, ...rest }: any) => withFileStatus(rest)),
      );
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/material-versions/:id", async (req, res) => {
    try {
      const version = await getVisibleVersion(req, req.params.id);
      if (!version) return res.status(404).json({ error: "Material version not found" });
      const { contentFileData: _cfd, additionalFilesData: _afd, ...rest } = version as any;
      res.json(withFileStatus(rest));
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/material-versions/:id/file", async (req, res) => {
    try {
      const version = await getVisibleVersion(req, req.params.id);
      if (!version) return res.status(404).json({ error: "File not found" });

      // Try filesystem first, then support both legacy inline storage formats.
      // Older records may have kept the base64 payload in contentFileData or
      // inside contentFile before the filesystem migration.
      let buffer = fileStorage.readContentFile(req.params.id);
      const contentFile = (version.contentFile as any) || {};
      const legacyBase64Candidates = [
        (version as any).contentFileData,
        contentFile.dataBase64,
        contentFile.base64,
      ];
      const legacyBase64 = legacyBase64Candidates.find(
        (value) => typeof value === "string" && value.length > 0,
      );

      if (!buffer && legacyBase64) {
        buffer = Buffer.from(legacyBase64, "base64");
        // Lazy-migrate: write to FS and remove all inline payload copies.
        fileStorage.writeContentFile(req.params.id, buffer);
        const {
          dataBase64: _dataBase64,
          base64: _base64,
          ...fileMetadata
        } = contentFile;
        await storage.updateMaterialVersion(req.params.id, {
          contentFileData: null,
          contentFile: fileMetadata,
        } as any).catch(() => {});
      }
      if (!buffer) {
        // A copied version (or one whose upload was interrupted) may lack the
        // binary while an earlier version of the same material still has it.
        const recovered = await recoverContentFile(req.params.id, version.materialId, contentFile.name);
        if (recovered) {
          buffer = recovered.buffer;
          console.log(`[file] Recovered attachment for ${req.params.id} from ${recovered.sourceVersionId}`);
        }
      }
      if (!buffer) return res.status(404).json({ error: "Файл не загружен на сервер" });

      const fileInfo = contentFile;
      const mimeType = fileInfo?.type === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const fileName = fileInfo?.name || "file";
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
      sendServerError(req, res, e);
    }
  });

  // Chunked file upload — each chunk ≤ 5 MB, proxy-safe
  const _chunkStore = new Map<string, { chunks: (Buffer | null)[]; total: number; name?: string; fileType?: string; ts: number }>();
  setInterval(() => {
    const cutoff = Date.now() - 3600_000;
    for (const [k, v] of Array.from(_chunkStore.entries())) if (v.ts < cutoff) _chunkStore.delete(k);
  }, 60_000).unref();

  app.post("/api/material-versions/:id/file-chunk", express.raw({ limit: "2mb", type: "application/octet-stream" }), async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      const { id } = req.params;
      const index = parseInt(req.query.index as string);
      const total = parseInt(req.query.total as string);
      const name = typeof req.query.name === "string" ? req.query.name : undefined;
      const fileType = typeof req.query.type === "string" ? req.query.type : undefined;
      if (isNaN(index) || isNaN(total) || index < 0 || index >= total || total > MAX_UPLOAD_CHUNKS)
        return res.status(400).json({ error: "Неверные параметры чанка" });
      if (!Buffer.isBuffer(req.body) || req.body.length === 0)
        return res.status(400).json({ error: "Пустое тело чанка" });

      if (!_chunkStore.has(id) || _chunkStore.get(id)!.total !== total) {
        // Validate before buffering anything: the id ends up in a file path.
        if (!fileStorage.isSafeStorageId(id) || !(await storage.getMaterialVersion(id))) {
          return res.status(404).json({ error: "Версия не найдена" });
        }
        if (!(await canManageVersionFiles(session.user, id))) {
          return res.status(403).json({ error: "Недостаточно прав для загрузки файла" });
        }
        _chunkStore.set(id, { chunks: new Array(total).fill(null), total, name, fileType, ts: Date.now() });
      }
      const entry = _chunkStore.get(id)!;
      entry.chunks[index] = req.body;
      entry.ts = Date.now();

      const allReceived = entry.chunks.every((c) => c !== null);
      if (allReceived) {
        const full = Buffer.concat(entry.chunks as Buffer[]);
        fileStorage.writeContentFile(id, full);
        const version = await storage.getMaterialVersion(id);
        const existingFile = (version?.contentFile as any) || {};
        const updatedFile = { ...existingFile, ...(entry.name ? { name: entry.name } : {}), ...(entry.fileType ? { type: entry.fileType } : {}) };
        try {
          const extractedText = await extractDocumentText(full, entry.fileType, entry.name);
          if (extractedText) updatedFile.extractedText = extractedText;
        } catch (error) {
          console.warn(`[file-upload] ${entry.fileType || "document"} text extraction failed:`, error);
        }
        await storage.updateMaterialVersion(id, { contentFile: updatedFile } as any);
        _chunkStore.delete(id);
        return res.json({ ok: true, done: true });
      }
      const received = entry.chunks.filter((c) => c !== null).length;
      res.json({ ok: true, done: false, received });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.put("/api/material-versions/:id/file-data", express.raw({ limit: "100mb", type: "application/octet-stream" }), async (req, res) => {
    try {
      const version = await storage.getMaterialVersion(req.params.id);
      if (!version) return res.status(404).json({ error: "Material version not found" });
      if (!(await canManageVersionFiles((req as any).auth.user, req.params.id))) {
        return res.status(403).json({ error: "Недостаточно прав для загрузки файла" });
      }
      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({ error: "Empty body" });
      }
      fileStorage.writeContentFile(req.params.id, buffer);
      const name = typeof req.query.name === "string" ? req.query.name : undefined;
      const type = typeof req.query.type === "string" ? req.query.type : undefined;
      const existingFile = (version.contentFile as any) || {};
      const updatedFile = { ...existingFile, ...(name ? { name } : {}), ...(type ? { type } : {}) };
      try {
        const extractedText = await extractDocumentText(buffer, type, name);
        if (extractedText) updatedFile.extractedText = extractedText;
      } catch (error) {
        console.warn(`[file-upload] ${type || "document"} text extraction failed:`, error);
      }
      await storage.updateMaterialVersion(req.params.id, { contentFile: updatedFile } as any);
      res.json({ ok: true });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // Additional files: chunked upload, delete, download
  const _addChunkStore = new Map<string, { chunks: (Buffer | null)[]; total: number; name?: string; fileType?: string; fileSize?: number; ts: number }>();
  setInterval(() => {
    const cutoff = Date.now() - 3_600_000;
    for (const [k, v] of Array.from(_addChunkStore.entries())) if (v.ts < cutoff) _addChunkStore.delete(k);
  }, 60_000).unref();

  app.post("/api/material-versions/:id/additional-file-chunk", express.raw({ limit: "2mb", type: "application/octet-stream" }), async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      const { id } = req.params;
      const fileId = typeof req.query.fileId === "string" ? req.query.fileId : null;
      const index = parseInt(req.query.index as string);
      const total = parseInt(req.query.total as string);
      const name = typeof req.query.name === "string" ? req.query.name : undefined;
      const fileType = typeof req.query.type === "string" ? req.query.type : undefined;
      const fileSize = typeof req.query.size === "string" ? parseInt(req.query.size) : undefined;
      if (!fileId) return res.status(400).json({ error: "fileId обязателен" });
      if (!fileStorage.isSafeStorageId(fileId)) return res.status(400).json({ error: "Недопустимый fileId" });
      if (isNaN(index) || isNaN(total) || index < 0 || index >= total || total > MAX_UPLOAD_CHUNKS) return res.status(400).json({ error: "Неверные параметры чанка" });
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "Пустое тело чанка" });
      const storeKey = `${id}:${fileId}`;
      if (!_addChunkStore.has(storeKey) || _addChunkStore.get(storeKey)!.total !== total) {
        if (!fileStorage.isSafeStorageId(id) || !(await storage.getMaterialVersion(id))) {
          return res.status(404).json({ error: "Версия не найдена" });
        }
        if (!(await canManageVersionFiles(session.user, id))) {
          return res.status(403).json({ error: "Недостаточно прав для загрузки файла" });
        }
        _addChunkStore.set(storeKey, { chunks: new Array(total).fill(null), total, name, fileType, fileSize, ts: Date.now() });
      }
      const entry = _addChunkStore.get(storeKey)!;
      entry.chunks[index] = req.body;
      entry.ts = Date.now();
      if (entry.chunks.every(c => c !== null)) {
        const full = Buffer.concat(entry.chunks as Buffer[]);
        fileStorage.writeAdditionalFile(id, fileId, full);
        const version = await storage.getMaterialVersion(id);
        if (!version) return res.status(404).json({ error: "Версия не найдена" });
        const existingFiles = (version.additionalFiles as any[]) ?? [];
        const updatedFiles = [...existingFiles.filter((f: any) => f.id !== fileId), { id: fileId, name: entry.name, type: entry.fileType, size: full.length }];
        await storage.updateMaterialVersion(id, { additionalFiles: updatedFiles } as any);
        _addChunkStore.delete(storeKey);
        return res.json({ ok: true, done: true });
      }
      res.json({ ok: true, done: false, received: entry.chunks.filter(c => c !== null).length });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.delete("/api/material-versions/:id/additional-file/:fileId", async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      const { id, fileId } = req.params;
      const version = await storage.getMaterialVersion(id);
      if (!version) return res.status(404).json({ error: "Версия не найдена" });
      if (!(await canManageVersionFiles(session.user, id))) return res.status(403).json({ error: "Недостаточно прав" });
      fileStorage.deleteAdditionalFile(id, fileId);
      const existingFiles = (version.additionalFiles as any[]) ?? [];
      const updatedFiles = existingFiles.filter((f: any) => f.id !== fileId);
      // Also clean up any legacy DB entry for this file
      const existingData = (version.additionalFilesData as any) ?? {};
      const { [fileId]: _removed, ...updatedData } = existingData;
      await storage.updateMaterialVersion(id, { additionalFiles: updatedFiles, additionalFilesData: updatedData } as any);
      res.json({ ok: true });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/material-versions/:id/additional-file/:fileId", async (req, res) => {
    try {
      const version = await getVisibleVersion(req, req.params.id);
      if (!version) return res.status(404).json({ error: "Версия не найдена" });
      const { id, fileId } = req.params;

      // Try filesystem first, fall back to legacy base64 in DB
      let buffer = fileStorage.readAdditionalFile(id, fileId);
      if (!buffer) {
        const legacyData = ((version.additionalFilesData as any) ?? {})[fileId];
        if (legacyData) {
          buffer = Buffer.from(legacyData, "base64");
          // Lazy-migrate to FS and remove from DB
          fileStorage.writeAdditionalFile(id, fileId, buffer);
          const updatedData = { ...(version.additionalFilesData as any) };
          delete updatedData[fileId];
          await storage.updateMaterialVersion(id, { additionalFilesData: updatedData } as any).catch(() => {});
        }
      }
      if (!buffer) buffer = await recoverAdditionalFile(id, version.materialId, fileId);
      if (!buffer) return res.status(404).json({ error: "Файл не загружен на сервер" });

      const fileInfo = ((version.additionalFiles as any[]) ?? []).find((f: any) => f.id === fileId);
      const fileName = fileInfo?.name || "file";
      const ext = fileName.split(".").pop()?.toLowerCase();
      const mimeType = ext === "pdf" ? "application/pdf"
        : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/octet-stream";
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader("Content-Length", buffer.length.toString());
      res.send(buffer);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.post("/api/material-versions", async (req, res) => {
    try {
      const user = (req as any).auth.user;
      // The author is always the signed-in user, whatever the client sent.
      const data = { ...coerceDates(sanitizeContentPage(req.body)), createdBy: user.id };
      if (typeof data.materialId !== "string" || !data.materialId) {
        return res.status(400).json({ error: "materialId обязателен" });
      }
      const [existing, ctx] = await Promise.all([
        storage.getMaterialVersionsByMaterialId(data.materialId),
        loadAccessContext(),
      ]);
      const decision = canCreateVersion(user, data as VersionRow, existing as VersionRow[], ctx);
      if (!decision.ok) return res.status(403).json({ error: decision.reason });
      const version = await storage.createMaterialVersion(data);
      // A new version of an existing material copies only file metadata from
      // the client; copy the binaries too so preview/download work right away.
      try {
        if (version.contentKind === "file" && !fileStorage.hasContentFile(version.id)) {
          await recoverContentFile(version.id, version.materialId, (version.contentFile as any)?.name);
        }
        for (const af of ((version.additionalFiles as any[]) ?? [])) {
          if (af?.id && !fileStorage.readAdditionalFile(version.id, af.id)) {
            await recoverAdditionalFile(version.id, version.materialId, af.id);
          }
        }
      } catch (error) {
        console.warn(`[file] copying files for new version ${version.id} failed:`, error);
      }
      const { contentFileData: _cfd, additionalFilesData: _afd, ...rest } = version as any;
      res.json(withFileStatus(rest));
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.patch("/api/material-versions/:id", async (req, res) => {
    try {
      const before = await storage.getMaterialVersion(req.params.id);
      if (!before) return res.status(404).json({ error: "Material version not found" });
      const [all, ctx] = await Promise.all([
        storage.getMaterialVersionsByMaterialId(before.materialId),
        loadAccessContext(),
      ]);
      const decision = canUpdateVersion((req as any).auth.user, before as VersionRow, req.body ?? {}, all as VersionRow[], ctx);
      if (!decision.ok) return res.status(403).json({ error: decision.reason });
      const version = await storage.updateMaterialVersion(req.params.id, coerceDates(sanitizeContentPage(req.body)));
      if (!version) return res.status(404).json({ error: "Material version not found" });
      const { contentFileData: _cfd, additionalFilesData: _afd, ...rest } = version as any;
      res.json(withFileStatus(rest));
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.delete("/api/materials/:materialId", async (req, res) => {
    try {
      // Collect version IDs first so we can clean up their files
      const versions = await storage.getMaterialVersionsByMaterialId(req.params.materialId);
      const deleted = await storage.deleteMaterialByMaterialId(req.params.materialId);
      if (!deleted) return res.status(404).json({ error: "Material not found" });
      // Delete all files on disk after successful DB deletion
      for (const v of versions) {
        fileStorage.deleteVersionFiles(v.id);
      }
      res.json({ ok: true });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/admin/file-storage", async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      const stats = fileStorage.getStorageStats();
      const envOverride = !!process.env.FILE_STORAGE_PATH;
      res.json({ path: fileStorage.getStorageDir(), totalFiles: stats.totalFiles, totalSizeMb: stats.totalBytes / 1024 / 1024, envOverride });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.put("/api/admin/file-storage", async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      if (!isAdmin(session.user)) return res.status(403).json({ error: "Доступ только для администраторов" });
      if (process.env.FILE_STORAGE_PATH) {
        return res.status(400).json({ error: "Путь задан переменной окружения FILE_STORAGE_PATH и не может быть изменён через интерфейс." });
      }
      const { path: newPath } = req.body as { path?: string };
      if (!newPath || !newPath.trim()) return res.status(400).json({ error: "Путь не может быть пустым" });
      fileStorage.setStorageDir(newPath.trim());
      const existing = await storage.getAiSettings();
      await storage.upsertAiSettings({ ...(existing ?? {}), fileStoragePath: newPath.trim(), updatedAt: new Date() } as any);
      const stats = fileStorage.getStorageStats();
      res.json({ path: fileStorage.getStorageDir(), totalFiles: stats.totalFiles, totalSizeMb: stats.totalBytes / 1024 / 1024, envOverride: false });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // MATERIALS SUB-ROUTES
  app.get("/api/materials/:materialId/versions", async (req, res) => {
    try {
      const [versions, ctx] = await Promise.all([
        storage.getMaterialVersionsByMaterialId(req.params.materialId),
        loadAccessContext(),
      ]);
      const user = (req as any).auth.user;
      res.json(
        versions
          .filter((v) => canViewVersion(user, v as VersionRow, ctx))
          .map(({ contentFileData: _cfd, additionalFilesData: _afd, ...rest }: any) => withFileStatus(rest)),
      );
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/materials/:materialId/subscribers", async (req, res) => {
    try {
      if (!(await canViewMaterialId(req, req.params.materialId))) return res.status(404).json({ error: "Material not found" });
      const subs = await storage.getSubscribers(req.params.materialId);
      res.json(subs);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.post("/api/materials/:materialId/subscribers", async (req, res) => {
    try {
      const me = (req as any).auth.user;
      if (req.body.userId !== me.id && !hasAdminRole(me)) return res.status(403).json({ error: "Можно подписать только себя" });
      if (!(await canViewMaterialId(req, req.params.materialId))) return res.status(404).json({ error: "Material not found" });
      const sub = await storage.addSubscriber({ materialId: req.params.materialId, userId: req.body.userId });
      res.json(sub);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.delete("/api/materials/:materialId/subscribers/:userId", async (req, res) => {
    try {
      const me = (req as any).auth.user;
      // Owners drop subscribers who lose access when visibility changes.
      if (req.params.userId !== me.id && !(await canManageMaterialId(me, req.params.materialId))) {
        return res.status(403).json({ error: "Можно отписать только себя" });
      }
      const removed = await storage.removeSubscriber(req.params.materialId, req.params.userId);
      if (!removed) return res.status(404).json({ error: "Subscriber not found" });
      res.json({ success: true });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/materials/:materialId/audit-views", async (req, res) => {
    try {
      if (!(await canViewMaterialId(req, req.params.materialId))) return res.status(404).json({ error: "Material not found" });
      const views = await storage.getAuditViews(req.params.materialId);
      res.json(views);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/materials/:materialId/rfcs", async (req, res) => {
    try {
      if (!(await canViewMaterialId(req, req.params.materialId))) return res.status(404).json({ error: "Material not found" });
      const rfcs = await storage.getRfcsByMaterialId(req.params.materialId);
      res.json(rfcs);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/materials/:materialId/ratings", async (req, res) => {
    try {
      if (!(await canViewMaterialId(req, req.params.materialId))) return res.status(404).json({ error: "Material not found" });
      const ratings = await storage.getRatingsByMaterial(req.params.materialId);
      res.json(ratings);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // AUDIT VIEWS
  app.post("/api/audit-views", async (req, res) => {
    try {
      // Records are always attributed to the signed-in user.
      const view = await storage.createAuditView({ ...coerceDates(req.body), userId: (req as any).auth.user.id });
      res.json(view);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // VIEW LOG
  app.post("/api/view-log", async (req, res) => {
    try {
      const userId = (req as any).auth.user.id as string;
      const materialId = req.body?.materialId;
      if (typeof materialId !== "string" || !(await canViewMaterialId(req, materialId))) {
        return res.status(404).json({ error: "Material not found" });
      }
      // One counted view per user and material per VIEW_DEDUP_MINUTES; the
      // counter is incremented here, never set by the client.
      const recent = await storage.getRecentViewLog(materialId, userId, VIEW_DEDUP_MINUTES);
      if (recent.length > 0) return res.json(recent[0]);
      const log = await storage.createViewLog({ materialId, userId });
      const current = await storage.getCurrentMaterialVersion(materialId);
      if (current) await storage.incrementVersionCounter(current.id, "views");
      res.json(log);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/view-log/check", async (req, res) => {
    try {
      const { materialId, userId, minutes } = req.query;
      if (!materialId || !userId || !minutes) {
        return res.status(400).json({ error: "materialId, userId, and minutes query params are required" });
      }
      if (!isSelfOrAdmin(req, userId)) return res.status(403).json({ error: "Недостаточно прав" });
      const logs = await storage.getRecentViewLog(
        materialId as string,
        userId as string,
        Number(minutes)
      );
      res.json(logs);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // RFCS
  app.get("/api/rfcs", async (req, res) => {
    try {
      const [rfcs, visible] = await Promise.all([storage.getRfcs(), visibleMaterialIds((req as any).auth.user)]);
      res.json(rfcs.filter((r) => visible.has(r.materialId)));
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/rfcs/:id", async (req, res) => {
    try {
      const rfc = await storage.getRfc(req.params.id);
      if (!rfc || !(await canViewMaterialId(req, rfc.materialId))) return res.status(404).json({ error: "RFC not found" });
      res.json(rfc);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.post("/api/rfcs", async (req, res) => {
    try {
      if (!(await canViewMaterialId(req, req.body?.materialId))) return res.status(404).json({ error: "Material not found" });
      const rfc = await storage.createRfc({ ...coerceDates(req.body), createdBy: (req as any).auth.user.id });
      res.json(rfc);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.patch("/api/rfcs/:id", async (req, res) => {
    try {
      const me = (req as any).auth.user;
      const existing = await storage.getRfc(req.params.id);
      if (!existing || !(await canViewMaterialId(req, existing.materialId))) return res.status(404).json({ error: "RFC not found" });
      const involved = existing.createdBy === me.id || existing.assignedTo === me.id;
      if (!involved && !(await canManageMaterialId(me, existing.materialId))) {
        return res.status(403).json({ error: "Недостаточно прав" });
      }
      const { materialId: _m, createdBy: _c, ...changes } = req.body ?? {};
      const rfc = await storage.updateRfc(req.params.id, coerceDates(changes));
      if (!rfc) return res.status(404).json({ error: "RFC not found" });
      res.json(rfc);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // RFC COMMENTS
  app.get("/api/rfcs/:rfcId/comments", async (req, res) => {
    try {
      const rfc = await storage.getRfc(req.params.rfcId);
      if (!rfc || !(await canViewMaterialId(req, rfc.materialId))) return res.status(404).json({ error: "RFC not found" });
      const comments = await storage.getRfcComments(req.params.rfcId);
      res.json(comments);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.post("/api/rfcs/:rfcId/comments", async (req, res) => {
    try {
      const parent = await storage.getRfc(req.params.rfcId);
      if (!parent || !(await canViewMaterialId(req, parent.materialId))) return res.status(404).json({ error: "RFC not found" });
      const comment = await storage.createRfcComment({ ...req.body, rfcId: req.params.rfcId, createdBy: (req as any).auth.user.id });
      res.json(comment);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // NOTIFICATIONS
  app.get("/api/notifications", async (req, res) => {
    try {
      const me = (req as any).auth.user;
      const notifications = await storage.getNotifications();
      // Admins see the whole mail log; everyone else only their own mail.
      const myEmail = String(me.email || "").toLowerCase();
      res.json(hasAdminRole(me) ? notifications : notifications.filter((n) => myEmail && n.toAddress.toLowerCase() === myEmail));
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      // Статусом управляет сервер: новое уведомление всегда встаёт в очередь на отправку.
      const { status: _status, attempts: _a, nextAttemptAt: _n, lastError: _e, sentAt: _s, ...data } = coerceDates(req.body);
      // Notifications are composed in the browser; only portal users may be
      // recipients, otherwise the queue would mail any address on request.
      const users = await storage.getUsers();
      const known = new Set(users.map((u) => (u.email || "").toLowerCase()).filter(Boolean));
      if (typeof data.toAddress !== "string" || !known.has(data.toAddress.toLowerCase())) {
        return res.status(400).json({ error: "Получатель не найден среди пользователей портала" });
      }
      if (typeof data.subject !== "string" || data.subject.length > 300) {
        return res.status(400).json({ error: "Недопустимая тема письма" });
      }
      // A notification about a material may only come from someone who sees it.
      if (data.relatedMaterialId && !(await canViewMaterialId(req, data.relatedMaterialId))) {
        return res.status(404).json({ error: "Material not found" });
      }
      const notification = await storage.createNotification({ ...data, status: "LOGGED" });
      kickEmailQueue();
      res.json(notification);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // HELPFUL RATINGS
  app.get("/api/ratings", async (req, res) => {
    try {
      const [ratings, visible] = await Promise.all([storage.getRatings(), visibleMaterialIds((req as any).auth.user)]);
      res.json(ratings.filter((r) => visible.has(r.materialId)));
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/ratings/check", async (req, res) => {
    try {
      const { userId, materialId, date } = req.query;
      if (!userId || !materialId || !date) {
        return res.status(400).json({ error: "userId, materialId, and date query params are required" });
      }
      if (!isSelfOrAdmin(req, userId)) return res.status(403).json({ error: "Недостаточно прав" });
      const rating = await storage.getRating(
        userId as string,
        materialId as string,
        date as string
      );
      if (!rating) return res.status(404).json({ error: "Rating not found" });
      res.json(rating);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.post("/api/ratings", async (req, res) => {
    try {
      const userId = (req as any).auth.user.id as string;
      const { materialId, value } = req.body ?? {};
      if (value !== "helpful" && value !== "not_helpful") return res.status(400).json({ error: "Недопустимая оценка" });
      if (typeof materialId !== "string" || !(await canViewMaterialId(req, materialId))) {
        return res.status(404).json({ error: "Material not found" });
      }
      // The date is the server's Moscow date: one rating per user, material and day.
      const date = moscowDateString();
      if (await storage.getRating(userId, materialId, date)) {
        return res.status(409).json({ error: "Вы уже оценили этот материал сегодня" });
      }
      const rating = await storage.createRating({ userId, materialId, date, value });
      const current = await storage.getCurrentMaterialVersion(materialId);
      if (current) await storage.incrementVersionCounter(current.id, value === "helpful" ? "helpfulYes" : "helpfulNo");
      res.json(rating);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // EMAIL CONFIG
  app.get("/api/email-config", async (req, res) => {
    try {
      const config = await storage.getEmailConfig();
      res.json(config ? { ...config, smtpPassword: maskSecret(config.smtpPassword) } : null);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.put("/api/email-config", async (req, res) => {
    try {
      const { smtpPassword, ...rest } = req.body ?? {};
      // The UI sends back the masked value; keep the stored secret then.
      const data = isMaskedOrEmpty(smtpPassword) ? rest : { ...rest, smtpPassword };
      const config = await storage.upsertEmailConfig(data);
      res.json({ ...config, smtpPassword: maskSecret(config.smtpPassword) });
    } catch (e) {
      sendServerError(req, res, e);
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
      const transporter = await createMailTransport(config);
      await transporter.sendMail({
        from: formatFrom(config),
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
  app.get("/api/email-templates", async (req, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      res.json(templates);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.patch("/api/email-templates/:id", async (req, res) => {
    try {
      const template = await storage.updateEmailTemplate(req.params.id, req.body);
      if (!template) return res.status(404).json({ error: "Email template not found" });
      res.json(template);
    } catch (e) {
      sendServerError(req, res, e);
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
    const owner = allUsers.find((u) => u.id === current.ownerId);
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
    const title = current.title ?? opts.materialId;
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
      const transporter = await createMailTransport(config);

      await transporter.sendMail({ from: formatFrom(config), to: recipientEmails.join(", "), subject, text: body });
      return { emailSent: true };
    } catch (smtpErr: any) {
      console.error("[email] Feedback send failed:", smtpErr?.message);
      return { emailSent: false, reason: "smtp_error" };
    }
  }

  app.post("/api/materials/:materialId/report-error", async (req, res) => {
    try {
      const userId = (req as any).auth.user.id as string;
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
      const userId = (req as any).auth.user.id as string;
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
  app.get("/api/policy/review-periods", async (req, res) => {
    try {
      const periods = await storage.getPolicyReviewPeriods();
      res.json(periods);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.patch("/api/policy/review-periods/:id", async (req, res) => {
    try {
      const period = await storage.updatePolicyReviewPeriod(req.params.id, req.body);
      if (!period) return res.status(404).json({ error: "Policy review period not found" });
      res.json(period);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // POLICY RBAC DEFAULTS
  app.get("/api/policy/rbac-defaults", async (req, res) => {
    try {
      const defaults = await storage.getPolicyRbacDefaults();
      res.json(defaults);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.patch("/api/policy/rbac-defaults/:id", async (req, res) => {
    try {
      const rbac = await storage.updatePolicyRbacDefault(req.params.id, req.body);
      if (!rbac) return res.status(404).json({ error: "Policy RBAC default not found" });
      res.json(rbac);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // AD INTEGRATION CONFIG
  app.get("/api/ad-config", async (req, res) => {
    try {
      const config = await storage.getAdIntegrationConfig();
      res.json(config ? { ...config, bindPassword: maskSecret(config.bindPassword) } : null);
    } catch (e) {
      sendServerError(req, res, e);
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
      // The UI sends back the masked value; keep the stored secret then.
      if (!isMaskedOrEmpty(body.bindPassword)) dbData.bindPassword = body.bindPassword;
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
      res.json({ ...config, bindPassword: maskSecret(config.bindPassword) });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // AD SYNC LOG
  app.get("/api/ad-sync-log", async (req, res) => {
    try {
      const logs = await storage.getAdSyncLogs();
      res.json(logs);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.post("/api/ad-sync-log", async (req, res) => {
    try {
      const log = await storage.createAdSyncLog(coerceDates(req.body));
      res.json(log);
    } catch (e) {
      sendServerError(req, res, e);
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
  app.get("/api/effective-vis-groups", async (req, res) => {
    try {
      const map = await storage.getEffectiveVisGroupMap();
      res.json(map);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.put("/api/effective-vis-groups/:materialId", async (req, res) => {
    try {
      if (!(await canManageMaterialId((req as any).auth.user, req.params.materialId))) {
        return res.status(403).json({ error: "Недостаточно прав" });
      }
      const result = await storage.upsertEffectiveVisGroupMap(req.params.materialId, req.body.visibilityGroupIds);
      res.json(result);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.delete("/api/effective-vis-groups/:materialId", async (req, res) => {
    try {
      if (!(await canManageMaterialId((req as any).auth.user, req.params.materialId))) {
        return res.status(403).json({ error: "Недостаточно прав" });
      }
      const deleted = await storage.deleteEffectiveVisGroupMap(req.params.materialId);
      if (!deleted) return res.status(404).json({ error: "Effective vis group map not found" });
      res.json({ success: true });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // NEW HIRES CONFIG
  app.get("/api/new-hires/config", async (req, res) => {
    try {
      const config = await storage.getNewHiresConfig();
      res.json(config || { enabled: false });
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.put("/api/new-hires/config", async (req, res) => {
    try {
      const config = await storage.upsertNewHiresConfig(req.body);
      res.json(config);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // NEW HIRE PROFILES
  app.get("/api/new-hires/profiles", async (req, res) => {
    try {
      const me = (req as any).auth.user;
      const profiles = await storage.getNewHireProfiles();
      res.json(hasAdminRole(me) ? profiles : profiles.filter((p) => p.userId === me.id));
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.post("/api/new-hires/profiles", async (req, res) => {
    try {
      const profile = await storage.createNewHireProfile(coerceDates(req.body));
      res.json(profile);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.patch("/api/new-hires/profiles/:id", async (req, res) => {
    try {
      const me = (req as any).auth.user;
      if (!hasAdminRole(me)) {
        // A new hire may only mark their own onboarding as completed.
        const existing = await storage.getNewHireProfile(req.params.id);
        const keys = Object.keys(req.body ?? {});
        const ownCompletion = existing?.userId === me.id && keys.length === 1 && req.body.status === "Завершено";
        if (!ownCompletion) return res.status(403).json({ error: "Недостаточно прав" });
      }
      const profile = await storage.updateNewHireProfile(req.params.id, coerceDates(req.body));
      if (!profile) return res.status(404).json({ error: "New hire profile not found" });
      res.json(profile);
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  // NEW HIRE ASSIGNMENTS
  app.get("/api/new-hires/assignments", async (req, res) => {
    try {
      const me = (req as any).auth.user;
      const assignments = await storage.getNewHireAssignments();
      res.json(hasAdminRole(me) ? assignments : assignments.filter((a) => a.userId === me.id));
    } catch (e) {
      sendServerError(req, res, e);
    }
  });

  app.get("/api/new-hires/assignments/user/:userId", async (req, res) => {
    try {
      if (!isSelfOrAdmin(req, req.params.userId)) return res.status(403).json({ error: "Недостаточно прав" });
      const assignments = await storage.getNewHireAssignmentsByUser(req.params.userId);
      res.json(assignments);
    } catch (e) {
      sendServerError(req, res, e);
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
      sendServerError(req, res, e);
    }
  });

  app.patch("/api/new-hires/assignments/:id/acknowledge", async (req, res) => {
    try {
      const me = (req as any).auth.user;
      const existing = await storage.getNewHireAssignment(req.params.id);
      if (!existing) return res.status(404).json({ error: "Assignment not found" });
      if (existing.userId !== me.id && !hasAdminRole(me)) return res.status(403).json({ error: "Недостаточно прав" });
      const assignment = await storage.updateNewHireAssignment(req.params.id, {
        acknowledgedAt: new Date(),
        acknowledgedVersionId: req.body.acknowledgedVersionId,
      });
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      res.json(assignment);
    } catch (e) {
      sendServerError(req, res, e);
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

  async function verifySession(req: any): Promise<{ user: NonNullable<Awaited<ReturnType<typeof storage.getUser>>>; token: string } | null> {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (token) {
      const user = await storage.getSessionUser(token);
      if (user) return { user, token };
    }
    // Cookie only for reads (downloads, images): state-changing requests must
    // carry the Bearer token, which a cross-site page cannot attach.
    const method = String(req.method || "GET").toUpperCase();
    if (method === "GET" || method === "HEAD") {
      const cookieToken = readCookie(req, SESSION_COOKIE);
      if (cookieToken) {
        const user = await storage.getSessionUser(cookieToken);
        if (user) return { user, token: cookieToken };
      }
    }
    return null;
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
      sendServerError(req, res, e);
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
      sendServerError(req, res, e);
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
      sendServerError(req, res, e);
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

  // DATABASE DUMP
  app.get("/api/admin/db-dump", async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      if (!isAdmin(session.user)) return res.status(403).json({ error: "Доступ только для администраторов" });

      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) return res.status(500).json({ error: "DATABASE_URL не настроен" });

      // Moscow time = UTC+3
      const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const hh = String(now.getUTCHours()).padStart(2, "0");
      const mm = String(now.getUTCMinutes()).padStart(2, "0");
      const dd = String(now.getUTCDate()).padStart(2, "0");
      const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
      const yy = String(now.getUTCFullYear()).slice(-2);
      const filename = `AppDB_${hh}${mm}_${dd}${mo}${yy}.dump`;

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const pg_dump = spawn("pg_dump", ["-Fc", "--no-password", dbUrl]);

      pg_dump.stdout.pipe(res);

      pg_dump.stderr.on("data", (chunk) => {
        console.error("[db-dump] stderr:", chunk.toString());
      });

      pg_dump.on("error", (err) => {
        console.error("[db-dump] spawn error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Ошибка запуска pg_dump: " + err.message });
        } else {
          res.end();
        }
      });

      pg_dump.on("close", (code) => {
        if (code !== 0 && !res.writableEnded) res.end();
      });
    } catch (e: any) {
      if (!res.headersSent) res.status(500).json({ error: e?.message || "Внутренняя ошибка" });
    }
  });

  // PORTAL SETTINGS BACKUP (encrypted)
  app.post("/api/admin/settings-backup", async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      if (!isAdmin(session.user)) return res.status(403).json({ error: "Доступ только для администраторов" });

      const { password } = req.body;
      if (!password || String(password).length < 4)
        return res.status(400).json({ error: "Пароль должен быть не менее 4 символов" });

      const [emailConfig, emailTemplates, adConfig, aiSettings] = await Promise.all([
        storage.getEmailConfig(),
        storage.getEmailTemplates(),
        storage.getAdIntegrationConfig(),
        storage.getAiSettings(),
      ]);

      const payload = JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        emailConfig: emailConfig ?? null,
        emailTemplates: emailTemplates ?? [],
        adConfig: adConfig ?? null,
        aiSettings: aiSettings ?? null,
      });

      const encrypted = encryptPortalSettings(payload, String(password));

      const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const dd = String(now.getUTCDate()).padStart(2, "0");
      const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
      const yy = String(now.getUTCFullYear()).slice(-2);
      const hh = String(now.getUTCHours()).padStart(2, "0");
      const mm = String(now.getUTCMinutes()).padStart(2, "0");
      const filename = `PortalSettings_${hh}${mm}_${dd}${mo}${yy}.kbbackup`;

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(encrypted);
    } catch (e: any) {
      if (!res.headersSent) res.status(500).json({ error: e?.message || "Внутренняя ошибка" });
    }
  });

  // PORTAL SETTINGS RESTORE (encrypted)
  app.post("/api/admin/settings-restore", async (req, res) => {
    try {
      const session = await verifySession(req);
      if (!session) return res.status(401).json({ error: "Требуется авторизация" });
      if (!isAdmin(session.user)) return res.status(403).json({ error: "Доступ только для администраторов" });

      const { password, data } = req.body;
      if (!password) return res.status(400).json({ error: "Пароль обязателен" });
      if (!data) return res.status(400).json({ error: "Файл не передан" });

      let payload: any;
      try {
        const buf = Buffer.from(String(data), "base64");
        const json = decryptPortalSettings(buf, String(password));
        payload = JSON.parse(json);
      } catch {
        return res.status(400).json({ error: "Неверный пароль или повреждённый файл" });
      }

      if (payload.version !== 1) return res.status(400).json({ error: "Неподдерживаемая версия бекапа" });

      if (payload.emailConfig) {
        const { id, ...emailData } = payload.emailConfig;
        await storage.upsertEmailConfig(coerceDates(emailData));
      }
      for (const tmpl of payload.emailTemplates ?? []) {
        const { id, ...tmplData } = tmpl;
        const coerced = coerceDates(tmplData);
        const existing = await storage.getEmailTemplateByKey(coerced.key);
        if (existing) await storage.updateEmailTemplate(existing.id, coerced);
        else await storage.createEmailTemplate(coerced);
      }
      if (payload.adConfig) {
        const { id, ...adData } = payload.adConfig;
        await storage.upsertAdIntegrationConfig(coerceDates(adData));
      }
      if (payload.aiSettings) {
        const { id, ...aiData } = payload.aiSettings;
        await storage.upsertAiSettings(coerceDates(aiData));
      }

      res.json({ ok: true, message: "Настройки успешно восстановлены" });
    } catch (e: any) {
      if (!res.headersSent) res.status(500).json({ error: e?.message || "Внутренняя ошибка" });
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
        fileType?: "pdf" | "doc" | "docx";
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
        if (fileType === "doc" || fileType === "docx" || fileType === "pdf") {
          sourceText = await extractDocumentText(buffer, fileType);
          if (fileType === "pdf" && sourceText.trim().length < 30) {
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

      const systemPrompt = (aiConfig.htmlGeneratorSystemPrompt || "").trim() || HTML_GENERATOR_DEFAULT_PROMPT;

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
            max_tokens: 16384,
            // Disable extended reasoning/thinking for reasoning models (Kimi, DeepSeek-R1, etc.)
            // so they don't spend all tokens on internal thoughts before producing output.
            enable_thinking: false,
            thinking: { type: "disabled" },
            reasoning_effort: "none",
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
        const choice = data.choices?.[0];
        const finishReason = choice?.finish_reason;
        const rawContent = choice?.message?.content;
        const reasoningContent = choice?.message?.reasoning_content;
        console.log("[generate-html] finish_reason:", finishReason,
          "| content length:", typeof rawContent === "string" ? rawContent.length : String(rawContent),
          "| reasoning length:", typeof reasoningContent === "string" ? reasoningContent.length : String(reasoningContent),
          "| usage:", JSON.stringify(data.usage));
        if (typeof rawContent === "string" && rawContent.trim()) {
          html = rawContent;
        } else if (typeof reasoningContent === "string" && reasoningContent.trim()) {
          // Some reasoning models emit HTML inside reasoning_content when they
          // run out of tokens before the final answer — try to salvage it.
          const htmlMatch = reasoningContent.match(/<(?:html|body|div|h[1-6]|p|ol|ul|table|section|header|main)[^>]*>[\s\S]+/i);
          html = htmlMatch ? htmlMatch[0] : "";
          if (html) console.log("[generate-html] extracted HTML from reasoning_content, length:", html.length);
        } else if (rawContent && typeof rawContent === "object") {
          // Array of content blocks (some API variants)
          html = (Array.isArray(rawContent) ? rawContent : [rawContent])
            .map((b: any) => (typeof b === "string" ? b : b?.text || ""))
            .join("");
        }
        if (!html) {
          console.log("[generate-html] empty content — raw response shape:", JSON.stringify(data).slice(0, 800));
        }
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

      let activeSessionId = typeof incomingSessionId === "string" && incomingSessionId
        ? incomingSessionId
        : undefined;
      if (activeSessionId) {
        const existing = await storage.getAiChatSession(activeSessionId);
        if (!existing || existing.userId !== userId) activeSessionId = undefined;
      }
      if (!activeSessionId) {
        const newSession = await storage.createAiChatSession(userId, message.slice(0, 120));
        activeSessionId = newSession.id;
      } else {
        await storage.touchAiChatSession(activeSessionId);
      }

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
          // searchText is the canonical server-side index for every material
          // type. The structured content fields are only a compatibility
          // fallback for records created before indexing was introduced.
          let text = typeof v.searchText === "string" ? v.searchText : "";
          if (!text && (v.contentKind === "page" || v.contentKind === "html") && v.contentPage) {
            text = ((v.contentPage as any).html || "")
              .replace(/<[^>]*>/g, " ")
              .replace(/&[a-z]+;/gi, " ")
              .replace(/\s+/g, " ")
              .trim();
          } else if (!text && v.contentKind === "file") {
            text = ((v.contentFile as any)?.extractedText || "")
              .replace(/\s+/g, " ")
              .trim();
          }
          const titleText = String(v.title || "").toLowerCase();
          const queryTokens = String(message)
            .toLowerCase()
            .match(/[а-яёa-z0-9]{3,}/g) || [];
          const uniqueQueryTokens = Array.from(new Set(queryTokens));
          const normalizedText = text.toLowerCase();
          const titleHits = uniqueQueryTokens.filter((token) => titleText.includes(token)).length;
          const bodyHits = uniqueQueryTokens.filter((token) => normalizedText.includes(token)).length;
          const exactPhraseBonus = normalizedText.includes(String(message).toLowerCase().trim()) ? 2 : 0;
          // PostgreSQL FTS is the first signal. Token overlap makes PDF/file
          // materials competitive even when their extracted text has unusual
          // line breaks or spelling forms.
          const lexicalScore = uniqueQueryTokens.length
            ? (titleHits * 4 + bodyHits) / uniqueQueryTokens.length
            : 0;
          const retrievalScore = ((v as any).rank ?? 0) + lexicalScore + exactPhraseBonus;
          return {
            materialId: v.materialId,
            title: v.title,
            text,
            rank: (v as any).rank ?? 0,
            retrievalScore,
            relatedLinks: v.relatedLinks ?? [],
          };
        })
        .filter((m: any) => m.text.length > 50);

      // Combine FTS with lexical evidence and keep the strongest candidates.
      // This prevents a generic instruction from replacing an exact PDF match.
      const sorted = [...materialsWithText].sort((a: any, b: any) => {
        if (b.retrievalScore !== a.retrievalScore) return b.retrievalScore - a.retrievalScore;
        return b.rank - a.rank;
      });
      const contextMaterials = sorted.slice(0, 8);

      if (contextMaterials.length === 0) {
        const answer = "К сожалению, в базе знаний не найдено материалов, доступных вам и релевантных вашему вопросу.";
        await Promise.all([
          storage.createAiChatMessage({ sessionId: activeSessionId, role: "user", content: message, sources: null }),
          storage.createAiChatMessage({ sessionId: activeSessionId, role: "assistant", content: answer, sources: [] }),
        ]);
        if (aiConfig.loggingEnabled !== false) {
          storage.createAiQueryLog({
            userId,
            question: message,
            sourcesUsed: [],
            tokensUsed: null,
          }).catch(() => {});
        }
        return res.json({
          answer,
          sources: [],
          sessionId: activeSessionId,
        });
      }

      const MAX_CHARS = 6000;
      const contextBlocks = contextMaterials
        .map(
          (m: any) =>
            `[ID: ${m.materialId}] Материал: "${m.title}"\n${contextExcerpt(m.text, message, MAX_CHARS)}`,
        )
        .join("\n\n---\n\n");

      const systemPrompt = `Ты — AI-помощник внутреннего портала знаний «Центр знаний ЦОС». Отвечай на вопросы сотрудников полно и развёрнуто, опираясь СТРОГО на предоставленные фрагменты из базы знаний. Если ответа нет в предоставленных материалах — честно сообщи об этом. Не придумывай информацию. Отвечай на русском языке. Не перечисляй источники в конце ответа — они будут добавлены автоматически.\n\nПравила выбора источника:\n- В первую очередь используй материал, который точнее всего отвечает на вопрос, а не просто содержит отдельные похожие слова.\n- Если один источник содержит конкретную процедуру, название, номер шага или формулировку из вопроса, считай его основным источником.\n- Не подменяй точный источник общим материалом. Если источники противоречат друг другу, укажи это.\n- В конце ответа добавь служебные маркеры только тех материалов, по которым ты действительно составил ответ, в формате [SOURCE:точный_ID_материала].\n- ID можно брать только из предоставленного контекста. Не придумывай ID и не указывай материалы, которые не использовал.\n- Если ответа в материалах нет, напиши об этом и не добавляй SOURCE-маркеры.\n\nДоступные материалы из базы знаний:\n---\n${contextBlocks}\n---`;

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

      // Accept source IDs only when the model explicitly cites IDs that were
      // present in the retrieved context. This prevents a generic top result
      // from being shown as the source for an answer based on another document.
      const citedIds = Array.from(new Set(
        Array.from(answer.matchAll(/\[SOURCE:([^\]\s]+)\]/gi), (match) => match[1])
          .filter((id) => contextMaterials.some((m: any) => m.materialId === id)),
      ));
      answer = answer.replace(/\s*\[SOURCE:[^\]]+\]/gi, "").trim();

      const citedMaterials = contextMaterials.filter((m: any) => citedIds.includes(m.materialId));

      // Fallback only when the model omitted the marker: retain materials with
      // meaningful answer overlap, but never force the first retrieved result.
      // Tokenise answer into significant lowercase words (≥4 chars, Cyrillic/Latin).
      const tokenize = (text: string): Set<string> => {
        const words = text.toLowerCase().match(/[а-яёa-z]{4,}/g) || [];
        return new Set(words);
      };
      const answerTokens = tokenize(answer);
      const STOP = new Set(["этот","этого","этому","этим","этих","что","как","для","при","или","все","они","его","её","или","над","под","без","про","через","после","перед","между","которые","который","которая","которого"]);
      answerTokens.forEach((w) => { if (STOP.has(w)) answerTokens.delete(w); });

      const scoredMaterials = contextMaterials.map((m: any) => {
        const matTokens = tokenize(m.text);
        let hits = 0;
        answerTokens.forEach((w) => { if (matTokens.has(w)) hits++; });
        const answerOverlap = answerTokens.size > 0 ? hits / answerTokens.size : 0;
        return { ...m, score: answerOverlap };
      });

      const answerRelevant = scoredMaterials
        .filter((m: any) => m.score >= 0.12)
        .sort((a: any, b: any) => b.score - a.score || b.retrievalScore - a.retrievalScore);
      const usedMaterials = citedMaterials.length > 0
        ? citedMaterials
        : answerRelevant.slice(0, 4);

      const sources = usedMaterials.map((m: any) => ({
        materialId: m.materialId,
        title: m.title,
        relatedLinks: m.relatedLinks,
      }));

      if (aiConfig.loggingEnabled !== false) {
        storage.createAiQueryLog({
          userId,
          question: message,
          sourcesUsed: sources.map((s: any) => s.materialId),
          tokensUsed: null,
        }).catch(() => {});
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

  // WebSocket file upload — bypasses per-request proxy overhead
  const uploadWss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: any, socket: any, head: Buffer) => {
    const pathname = (() => { try { return new URL(req.url ?? "/", "http://x").pathname; } catch { return "/"; } })();
    if (pathname === "/ws/upload") {
      uploadWss.handleUpgrade(req, socket, head, (ws) => uploadWss.emit("connection", ws, req));
    }
  });

  uploadWss.on("connection", (ws) => {
    type Meta = { versionId: string; fileName: string; fileType: string; totalSize: number; kind: "content" | "additional"; additionalFileId?: string };
    let meta: Meta | null = null;
    const chunks: Buffer[] = [];
    let received = 0;

    ws.on("message", async (data: any, isBinary: boolean) => {
      const buf: Buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

      if (!meta) {
        try {
          const msg = JSON.parse(buf.toString("utf8"));
          const session = await verifySession({ headers: { authorization: `Bearer ${msg.auth ?? ""}` } });
          if (!session) { ws.send(JSON.stringify({ type: "error", message: "Unauthorized" })); ws.close(1008, "Unauthorized"); return; }
          // The ids end up in file paths: validate them and the version first.
          const idsOk = fileStorage.isSafeStorageId(msg.versionId)
            && (msg.kind !== "additional" || fileStorage.isSafeStorageId(msg.additionalFileId));
          if (!idsOk || !(await storage.getMaterialVersion(msg.versionId))) {
            ws.send(JSON.stringify({ type: "error", message: "Версия или файл не найдены" }));
            ws.close();
            return;
          }
          if (!(await canManageVersionFiles(session.user, msg.versionId))) {
            ws.send(JSON.stringify({ type: "error", message: "Недостаточно прав для загрузки файла" }));
            ws.close();
            return;
          }
          const totalSize = Number(msg.totalSize);
          if (!Number.isFinite(totalSize) || totalSize < 0 || totalSize > MAX_UPLOAD_BYTES) {
            ws.send(JSON.stringify({ type: "error", message: "Файл слишком большой" }));
            ws.close();
            return;
          }
          meta = { versionId: msg.versionId, fileName: msg.fileName, fileType: msg.fileType, totalSize, kind: msg.kind, additionalFileId: msg.additionalFileId };
          ws.send(JSON.stringify({ type: "ready" }));
          if (meta.totalSize === 0) {
            if (meta.kind === "additional" && meta.additionalFileId) {
              fileStorage.writeAdditionalFile(meta.versionId, meta.additionalFileId, Buffer.alloc(0));
            } else {
              fileStorage.writeContentFile(meta.versionId, Buffer.alloc(0));
            }
            ws.send(JSON.stringify({ type: "done" }));
            ws.close();
          }
        } catch (e) { ws.send(JSON.stringify({ type: "error", message: String(e) })); ws.close(); }
        return;
      }

      chunks.push(buf);
      received += buf.length;

      if (received >= meta.totalSize) {
        const full = Buffer.concat(chunks);
        try {
          if (meta.kind === "additional" && meta.additionalFileId) {
            fileStorage.writeAdditionalFile(meta.versionId, meta.additionalFileId, full);
            const version = await storage.getMaterialVersion(meta.versionId);
            if (version) {
              const files = (version.additionalFiles as any[]) ?? [];
              const updated = [...files.filter((f: any) => f.id !== meta!.additionalFileId), { id: meta!.additionalFileId, name: meta!.fileName, type: meta!.fileType, size: full.length }];
              await storage.updateMaterialVersion(meta.versionId, { additionalFiles: updated } as any);
            }
          } else {
            fileStorage.writeContentFile(meta.versionId, full);
            const version = await storage.getMaterialVersion(meta.versionId);
            const existingFile = (version?.contentFile as any) || {};
            const updatedFile = {
              ...existingFile,
              ...(meta.fileName ? { name: meta.fileName } : {}),
              ...(meta.fileType ? { type: meta.fileType } : {}),
            };
            try {
              const extractedText = await extractDocumentText(full, meta.fileType, meta.fileName);
              if (extractedText) updatedFile.extractedText = extractedText;
            } catch (error) {
              console.warn(`[ws-upload] ${meta.fileType || "document"} text extraction failed:`, error);
            }
            if (version) {
              await storage.updateMaterialVersion(meta.versionId, { contentFile: updatedFile } as any);
            }
          }
          ws.send(JSON.stringify({ type: "done" }));
        } catch (e) { ws.send(JSON.stringify({ type: "error", message: String(e) })); }
        ws.close();
      }
    });

    ws.on("error", (err) => console.error("[ws-upload]", err));
  });

  return httpServer;
}
