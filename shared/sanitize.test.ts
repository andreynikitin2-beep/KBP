import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml — strips unsafe content", () => {
  it("removes <script> tags and their contents", () => {
    const out = sanitizeHtml('<p>ok</p><script>alert("xss")</script>');
    expect(out).toContain("<p>ok</p>");
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out).not.toContain("alert");
  });

  it("removes <style> tags", () => {
    const out = sanitizeHtml('<p>ok</p><style>body{display:none}</style>');
    expect(out).toContain("<p>ok</p>");
    expect(out.toLowerCase()).not.toContain("<style");
    expect(out).not.toContain("display:none");
  });

  it("removes <iframe> tags", () => {
    const out = sanitizeHtml('<p>ok</p><iframe src="https://evil.example"></iframe>');
    expect(out).toContain("<p>ok</p>");
    expect(out.toLowerCase()).not.toContain("<iframe");
  });

  it("removes inline onclick handlers", () => {
    const out = sanitizeHtml('<p onclick="steal()">click me</p>');
    expect(out).toContain("click me");
    expect(out.toLowerCase()).not.toContain("onclick");
    expect(out).not.toContain("steal");
  });

  it("removes inline onerror handlers on images", () => {
    const out = sanitizeHtml('<img src="x" onerror="steal()">');
    expect(out.toLowerCase()).not.toContain("onerror");
    expect(out).not.toContain("steal");
  });

  it("removes javascript: URLs from links", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">bad link</a>');
    expect(out).toContain("bad link");
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("removes other dangerous tags (object, embed, form, input, button)", () => {
    const out = sanitizeHtml(
      '<object data="x"></object><embed src="x"><form><input><button>x</button></form>'
    );
    const lower = out.toLowerCase();
    expect(lower).not.toContain("<object");
    expect(lower).not.toContain("<embed");
    expect(lower).not.toContain("<form");
    expect(lower).not.toContain("<input");
    expect(lower).not.toContain("<button");
  });
});

describe("sanitizeHtml — preserves legitimate formatting", () => {
  it("keeps headings", () => {
    const out = sanitizeHtml("<h1>Title</h1><h2>Sub</h2><h3>Sub3</h3>");
    expect(out).toContain("<h1>Title</h1>");
    expect(out).toContain("<h2>Sub</h2>");
    expect(out).toContain("<h3>Sub3</h3>");
  });

  it("keeps paragraphs", () => {
    const out = sanitizeHtml("<p>A paragraph</p>");
    expect(out).toContain("<p>A paragraph</p>");
  });

  it("keeps ordered and unordered lists", () => {
    const ul = sanitizeHtml("<ul><li>one</li><li>two</li></ul>");
    expect(ul).toContain("<ul>");
    expect(ul).toContain("<li>one</li>");

    const ol = sanitizeHtml("<ol><li>first</li></ol>");
    expect(ol).toContain("<ol>");
    expect(ol).toContain("<li>first</li>");
  });

  it("keeps task lists (Tiptap data attributes)", () => {
    const html =
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">done</li></ul>';
    const out = sanitizeHtml(html);
    expect(out).toContain('data-type="taskList"');
    expect(out).toContain('data-type="taskItem"');
    expect(out).toContain('data-checked="true"');
    expect(out).toContain("done");
  });

  it("keeps tables", () => {
    const html =
      "<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>C</td></tr></tbody></table>";
    const out = sanitizeHtml(html);
    expect(out).toContain("<table>");
    expect(out).toContain("<th>H</th>");
    expect(out).toContain("<td>C</td>");
  });

  it("keeps safe links with attributes", () => {
    const out = sanitizeHtml(
      '<a href="https://example.com" target="_blank" rel="noopener">link</a>'
    );
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain("link");
  });

  it("keeps blockquotes", () => {
    const out = sanitizeHtml("<blockquote>quoted</blockquote>");
    expect(out).toContain("<blockquote>quoted</blockquote>");
  });
});

describe("sanitizeHtml — preserves images and generator markers", () => {
  it("keeps base64 image data URIs", () => {
    const dataUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const out = sanitizeHtml(`<img src="${dataUri}" alt="dot">`);
    expect(out).toContain(dataUri);
    expect(out).toContain('alt="dot"');
  });

  it("keeps data-unrecognized-step markers", () => {
    const out = sanitizeHtml('<div data-unrecognized-step="true">step</div>');
    expect(out).toContain("data-unrecognized-step");
    expect(out).toContain("step");
  });

  it("keeps data-placeholder markers", () => {
    const out = sanitizeHtml('<span data-placeholder="screenshot">placeholder</span>');
    expect(out).toContain("data-placeholder");
    expect(out).toContain("placeholder");
  });

  it("keeps the screenshot-placeholder class", () => {
    const out = sanitizeHtml('<div class="screenshot-placeholder">img here</div>');
    expect(out).toContain("screenshot-placeholder");
    expect(out).toContain("img here");
  });
});

describe("sanitizeHtml — edge cases", () => {
  it("returns empty string for null, undefined and empty input", () => {
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
    expect(sanitizeHtml("")).toBe("");
  });
});
