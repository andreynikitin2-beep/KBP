import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { backfillSearchText, ensureFeedbackTemplates, migrateSecrets, storage } from "./storage";
import { setStorageDir } from "./fileStorage";
import { startEmailQueue } from "./mailer";
import { startOverdueCheck } from "./reviewScheduler";
import { assertSecretsKey } from "./secrets";

// Stored SMTP/LDAP passwords and the AI key are encrypted with SECRETS_KEY:
// refuse to start without it rather than fail on the first secret read.
assertSecretsKey();

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Large JSON bodies only where content needs them (pages with images, image
// uploads, AI generation, settings restore); everything else stays small so
// a single request cannot exhaust memory.
const LARGE_BODY_ROUTES = /^\/api\/(material-versions|images|ai\/|admin\/settings-restore)/;
const jsonVerify = (req: any, _res: any, buf: Buffer) => {
  req.rawBody = buf;
};
const largeJson = express.json({ limit: "50mb", verify: jsonVerify });
const smallJson = express.json({ limit: "2mb", verify: jsonVerify });
app.use((req, res, next) => (LARGE_BODY_ROUTES.test(req.path) ? largeJson : smallJson)(req, res, next));

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  // Response bodies are never logged: they contain session tokens, user data
  // and configuration secrets.
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  ensureFeedbackTemplates().catch((e) => console.error("[email] feedback templates error:", e));

  // Restore file storage path saved via admin UI (skipped when FILE_STORAGE_PATH env var is set)
  if (!process.env.FILE_STORAGE_PATH) {
    await storage.getAiSettings().then((s) => {
      if (s?.fileStoragePath) setStorageDir(s.fileStoragePath);
    }).catch(() => {});
  }

  await migrateSecrets().catch((e) => console.error("[secrets] migration error:", e));
  await backfillSearchText().catch((e) => console.error("[search] backfill error:", e));

  await registerRoutes(httpServer, app);
  startEmailQueue();
  startOverdueCheck();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
