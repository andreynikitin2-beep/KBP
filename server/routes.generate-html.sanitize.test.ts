// Integration test that proves AI-generated instruction HTML is sanitized on
// the actual generate-html API route — not just by the sanitizer in isolation.
// The LLM HTTP call is stubbed to return hostile markup (e.g. a prompt-injection
// or compromised model pushing <script>/javascript: into the editor). This guards
// against a future change forgetting to call sanitizeHtml on this path, which
// would let unsafe markup flow straight into stored, published instructions.
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";

// Hoisted spies for the storage methods the route touches.
const { getSessionUser, getAiSettings } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getAiSettings: vi.fn(),
}));

// Mock the storage layer so the route never touches a real database. The route
// still runs its real sanitization logic on the model output.
vi.mock("./storage", () => ({
  storage: {
    getSessionUser,
    getAiSettings,
  },
}));

let server: Server;
let baseUrl: string;
let fetchSpy: ReturnType<typeof vi.spyOn>;

// What the stubbed LLM "returns". Mixes legitimate instruction markup with a
// <script> tag, a javascript: link and an inline event handler.
const MALICIOUS_LLM_HTML =
  "```html\n" +
  '<h1>Инструкция</h1>' +
  '<p>ok</p>' +
  '<script>alert("xss")</script>' +
  '<a href="javascript:alert(1)">bad link</a>' +
  '<img src="x" onerror="steal()">' +
  "\n```";

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
  getSessionUser.mockReset();
  getAiSettings.mockReset();
  getSessionUser.mockResolvedValue({ id: "u1", roles: ["Автор"] });
  getAiSettings.mockResolvedValue({
    enabled: true,
    htmlGeneratorEnabled: true,
    apiKey: "sk-test",
    provider: "openai",
    model: "gpt-4o",
    baseUrl: null,
    htmlGeneratorSystemPrompt: "",
  });

  // Stub only the outbound LLM HTTP call. The route runs in this same process
  // and uses the global fetch, but so does the test when it calls the route
  // itself — so pass through any request that isn't aimed at the LLM provider.
  // Each provider has a different response shape: OpenAI nests the text under
  // `choices[0].message.content`, Anthropic under `content[0].text`.
  const realFetch = globalThis.fetch;
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    if (url.includes("anthropic.com")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ content: [{ text: MALICIOUS_LLM_HTML }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (url.includes("openai.com")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ choices: [{ message: { content: MALICIOUS_LLM_HTML } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return realFetch(input, init);
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe("POST /api/ai/generate-html — sanitizes LLM output", () => {
  it("strips <script>, javascript: links and event handlers from the model HTML", async () => {
    const res = await fetch(`${baseUrl}/api/ai/generate-html`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ text: "Текст исходной инструкции для преобразования." }),
    });

    expect(res.status).toBe(200);
    // The route reached out to the (stubbed) LLM provider.
    expect(
      fetchSpy.mock.calls.some(([input]) =>
        String(typeof input === "string" ? input : (input as any)?.url ?? input).includes("openai.com"),
      ),
    ).toBe(true);

    const body = await res.json();
    assertSanitized(body.html as string);
  });

  it("sanitizes output from the Anthropic provider branch (content[0].text shape)", async () => {
    getAiSettings.mockResolvedValue({
      enabled: true,
      htmlGeneratorEnabled: true,
      apiKey: "sk-ant-test",
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      baseUrl: null,
      htmlGeneratorSystemPrompt: "",
    });

    const res = await fetch(`${baseUrl}/api/ai/generate-html`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ text: "Текст исходной инструкции для преобразования." }),
    });

    expect(res.status).toBe(200);
    // The route reached out to the (stubbed) Anthropic provider, not OpenAI.
    expect(
      fetchSpy.mock.calls.some(([input]) =>
        String(typeof input === "string" ? input : (input as any)?.url ?? input).includes("anthropic.com"),
      ),
    ).toBe(true);

    const body = await res.json();
    assertSanitized(body.html as string);
  });

  it("sanitizes output in refine mode (currentHtml + instruction)", async () => {
    const res = await fetch(`${baseUrl}/api/ai/generate-html`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        currentHtml: "<h1>Старая инструкция</h1><p>текст</p>",
        instruction: "Добавь раздел про технику безопасности.",
      }),
    });

    expect(res.status).toBe(200);
    // Refine mode still calls the LLM provider.
    expect(
      fetchSpy.mock.calls.some(([input]) =>
        String(typeof input === "string" ? input : (input as any)?.url ?? input).includes("openai.com"),
      ),
    ).toBe(true);

    const body = await res.json();
    assertSanitized(body.html as string);
  });
});
