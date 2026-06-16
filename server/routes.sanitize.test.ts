// Integration tests that prove instruction HTML is sanitized on the actual
// save/create API routes for material versions — not just by the sanitizer in
// isolation. These guard against a future change forgetting to call
// sanitizeHtml on a write path, which would silently expose readers to unsafe
// markup while the sanitize unit tests still pass.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";

// Hoisted spies so we can capture exactly what the route hands to storage.
const { createMaterialVersion, updateMaterialVersion } = vi.hoisted(() => ({
  createMaterialVersion: vi.fn(),
  updateMaterialVersion: vi.fn(),
}));

// Mock the storage layer so the routes never touch a real database. The routes
// still run their real sanitization logic before calling storage.
vi.mock("./storage", () => ({
  storage: {
    createMaterialVersion,
    updateMaterialVersion,
  },
}));

let server: Server;
let baseUrl: string;

const MALICIOUS_HTML =
  '<h1>Инструкция</h1>' +
  '<p>ok</p>' +
  '<script>alert("xss")</script>' +
  '<a href="javascript:alert(1)">bad link</a>' +
  '<img src="x" onerror="steal()">';

beforeAll(async () => {
  const { registerRoutes } = await import("./routes");
  const app: Express = express();
  app.use(express.json({ limit: "100mb" }));
  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  server = httpServer;
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  createMaterialVersion.mockReset();
  updateMaterialVersion.mockReset();
  createMaterialVersion.mockImplementation(async (data: any) => ({ id: "v1", ...data }));
  updateMaterialVersion.mockImplementation(async (_id: string, data: any) => ({ id: _id, ...data }));
});

function assertSanitized(html: string) {
  const lower = html.toLowerCase();
  expect(lower).not.toContain("<script");
  expect(html).not.toContain("alert");
  expect(html).not.toContain("steal");
  expect(lower).not.toContain("javascript:");
  expect(lower).not.toContain("onerror");
  // Legitimate content survives.
  expect(html).toContain("<h1>Инструкция</h1>");
  expect(html).toContain("<p>ok</p>");
}

describe("POST /api/material-versions — sanitizes stored HTML", () => {
  it("strips <script>, javascript: links and event handlers before storage", async () => {
    const res = await fetch(`${baseUrl}/api/material-versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        materialId: "m1",
        contentKind: "page",
        contentPage: { html: MALICIOUS_HTML },
      }),
    });
    expect(res.status).toBe(200);
    expect(createMaterialVersion).toHaveBeenCalledTimes(1);

    const storedArg = createMaterialVersion.mock.calls[0][0];
    const storedHtml = storedArg.contentPage.html as string;
    assertSanitized(storedHtml);

    // The value returned to the client is sanitized too.
    const body = await res.json();
    assertSanitized(body.contentPage.html);
  });
});

describe("PATCH /api/material-versions/:id — sanitizes stored HTML", () => {
  it("strips <script>, javascript: links and event handlers before storage", async () => {
    const res = await fetch(`${baseUrl}/api/material-versions/v1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentKind: "page",
        contentPage: { html: MALICIOUS_HTML },
      }),
    });
    expect(res.status).toBe(200);
    expect(updateMaterialVersion).toHaveBeenCalledTimes(1);

    const storedArg = updateMaterialVersion.mock.calls[0][1];
    const storedHtml = storedArg.contentPage.html as string;
    assertSanitized(storedHtml);

    const body = await res.json();
    assertSanitized(body.contentPage.html);
  });
});
