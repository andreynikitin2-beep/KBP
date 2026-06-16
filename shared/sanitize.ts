import DOMPurify from "isomorphic-dompurify";

// Allowlist of tags/attributes for stored instruction HTML.
// Covers everything the AI generator and the Tiptap editor can legitimately
// produce: headings, paragraphs, lists (incl. task lists), tables, images
// (base64 data URIs), links, blockquotes and inline formatting. Anything
// outside this list (e.g. <script>, <style>, event handlers, javascript: URLs)
// is stripped.
const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr", "div", "span",
  "strong", "b", "em", "i", "u", "s", "strike", "del", "ins", "mark",
  "sub", "sup", "small", "code", "pre", "blockquote", "abbr",
  "ul", "ol", "li",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th",
  "caption", "colgroup", "col",
];

const ALLOWED_ATTR = [
  "href", "target", "rel",
  "src", "alt", "title", "width", "height",
  "colspan", "rowspan", "scope",
  "start", "type", "reversed",
  "class", "id", "align", "style",
];

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Keep data-* attributes used by the editor/generator
    // (data-unrecognized-step, data-placeholder, data-checked, data-type, ...).
    ALLOW_DATA_ATTR: true,
    // Allow base64 image data URIs (the editor stores images inline).
    ADD_DATA_URI_TAGS: ["img"],
    // Drop unknown/unsafe protocols but keep http(s), mailto, tel and data:image.
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}
