// Opening documents for preview in the browser's PDF viewer (new tab).
// PDFs are shown as they are; Word/Excel/PowerPoint are rendered to PDF on
// the server (/preview endpoints) so the layout and a selectable text layer
// are preserved.

/** Formats the server converts to PDF for preview (keep in sync with server/docPreview.ts). */
const CONVERTIBLE_EXT = new Set(["doc", "docx", "rtf", "odt", "xls", "xlsx", "ods", "ppt", "pptx", "odp"]);

export class FileFetchError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

export function fileExtension(name: string | undefined | null): string {
  const n = String(name || "");
  return n.includes(".") ? n.split(".").pop()!.toLowerCase() : "";
}

export function isPdfName(name: string | undefined | null): boolean {
  return fileExtension(name) === "pdf";
}

export function isPreviewable(name: string | undefined | null): boolean {
  const ext = fileExtension(name);
  return ext === "pdf" || CONVERTIBLE_EXT.has(ext);
}

/**
 * "Name.pdf", URL-encoded, for the end of a preview URL: browsers' PDF viewers
 * show the last URL segment as the title and use it as the "save as" name.
 */
export function pdfUrlName(fileName: string | undefined | null): string {
  const base = String(fileName || "document").replace(/\.[^.]+$/, "").replace(/[\\/]/g, "_") || "document";
  return encodeURIComponent(base + ".pdf");
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function placeholderPage(fileName: string, preparing: boolean): string {
  // The file name is user-controlled and this tab shares the portal's origin: escape it.
  const name = escapeHtml(fileName);
  const title = preparing ? "Подготовка документа" : "Открытие документа";
  const hint = preparing
    ? "Документ преобразуется для просмотра — обычно это занимает несколько секунд."
    : "Пожалуйста, подождите…";
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${title} — ${name}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333}.card{background:#fff;border-radius:16px;padding:40px 48px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:420px;width:90%;text-align:center}.spin{width:40px;height:40px;margin:0 auto 20px;border:4px solid #e9ecef;border-top-color:#6366f1;border-radius:50%;animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}.title{font-size:18px;font-weight:600;margin-bottom:6px}.name{font-size:13px;color:#666;word-break:break-all}.hint{margin-top:16px;font-size:12px;color:#aaa}</style></head><body><div class="card"><div class="spin"></div><div class="title">${title}</div><div class="name">${name}</div><div class="hint">${hint}</div></div></body></html>`;
}

export type OpenPdfOptions = {
  url: string;
  fileName: string;
  /** true while the server converts the document */
  preparing?: boolean;
  /** called with 0 when work starts and null when it ends (for button state) */
  onProgress?: (pct: number | null) => void;
};

/**
 * Open a PDF in a new tab.
 *
 * The tab is opened right away (inside the click, so popup blockers allow it)
 * with a waiting page. The server is then asked whether the PDF is ready
 * (`check=1`, no body; for office files this also runs the conversion). Only
 * then is the tab sent to the PDF's real URL — a plain same-origin link that
 * every browser shows in its own PDF viewer (Chrome, Yandex Browser, Safari,
 * Firefox). Navigating tabs to blob: URLs is not reliable: Firefox and Safari
 * download or ignore them, Yandex Browser depends on its settings.
 *
 * Throws FileFetchError for HTTP errors (the waiting tab is closed then).
 */
export async function openPdfPreview(opts: OpenPdfOptions): Promise<"tab" | "downloaded"> {
  const newTab = window.open("about:blank", "_blank");
  if (newTab) {
    newTab.document.write(placeholderPage(opts.fileName, !!opts.preparing));
    newTab.document.close();
  }
  opts.onProgress?.(0);
  const target = new URL(opts.url, window.location.href);
  try {
    const check = new URL(target.href);
    check.searchParams.set("check", "1");
    let res: Response;
    try {
      res = await fetch(check.href, { credentials: "same-origin" });
    } catch {
      throw new FileFetchError(0);
    }
    if (!res.ok) throw new FileFetchError(res.status);
  } catch (err) {
    newTab?.close();
    throw err;
  } finally {
    opts.onProgress?.(null);
  }

  if (newTab && !newTab.closed) {
    newTab.location.replace(target.href);
    return "tab";
  }
  // Popups blocked: download the file instead (the server names it).
  const a = document.createElement("a");
  a.href = target.href;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return "downloaded";
}
