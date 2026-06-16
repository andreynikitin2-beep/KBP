// @vitest-environment jsdom
// Proves the page content viewer (the read/display path) outputs sanitized
// HTML. Even if unsafe markup somehow ends up stored, the viewer must never
// render <script>, javascript: links or inline event handlers. This guards
// against a future change dropping the defense-in-depth sanitize call in
// PageViewer.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageViewer } from "./PageViewer";

const MALICIOUS_HTML =
  '<h1>Инструкция</h1>' +
  '<p>visible text</p>' +
  '<script>alert("xss")</script>' +
  '<a href="javascript:alert(1)">bad link</a>' +
  '<img src="x" onerror="steal()">';

describe("PageViewer — renders sanitized HTML", () => {
  it("does not output <script>, javascript: links or event handlers", () => {
    const markup = renderToStaticMarkup(
      <PageViewer html={MALICIOUS_HTML} materialId="m1" />
    );
    const lower = markup.toLowerCase();
    expect(lower).not.toContain("<script");
    expect(markup).not.toContain('alert("xss")');
    expect(markup).not.toContain("steal");
    expect(lower).not.toContain("javascript:");
    expect(lower).not.toContain("onerror");
  });

  it("still renders the legitimate instruction content", () => {
    const markup = renderToStaticMarkup(
      <PageViewer html={MALICIOUS_HTML} materialId="m1" />
    );
    expect(markup).toContain("Инструкция");
    expect(markup).toContain("visible text");
  });
});
