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

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function placeholderPage(fileName: string, preparing: boolean): string {
  // The file name is user-controlled and this tab shares the portal's origin: escape it.
  const name = escapeHtml(fileName);
  const title = preparing ? "Подготовка документа" : "Загрузка документа";
  const hint = preparing
    ? "Документ преобразуется для просмотра — это может занять до минуты."
    : "Пожалуйста, подождите…";
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${title} — ${name}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333}.card{background:#fff;border-radius:16px;padding:40px 48px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:420px;width:90%;text-align:center}.icon{font-size:48px;margin-bottom:20px}.title{font-size:18px;font-weight:600;margin-bottom:6px}.name{font-size:13px;color:#666;margin-bottom:28px;word-break:break-all}.bar-wrap{width:100%;height:8px;background:#e9ecef;border-radius:99px;overflow:hidden;margin-bottom:12px}.bar{height:100%;background:linear-gradient(90deg,#6366f1,#818cf8);border-radius:99px;transition:width .3s ease;width:0%}.pct{font-size:14px;color:#6366f1;font-weight:600}.hint{margin-top:16px;font-size:12px;color:#aaa}</style></head><body><div class="card"><div class="icon">📄</div><div class="title">${title}</div><div class="name">${name}</div><div class="bar-wrap"><div class="bar" id="bar"></div></div><div class="pct" id="pct">${preparing ? "" : "0%"}</div><div class="hint">${hint}</div></div></body></html>`;
}

export type OpenPdfOptions = {
  url: string;
  fileName: string;
  /** true while the server converts the document (no progress until it is ready) */
  preparing?: boolean;
  onProgress?: (pct: number | null) => void;
};

/**
 * Open a PDF in a new tab with a loading page. The tab is opened right away
 * (inside the click) so popup blockers allow it. If popups are blocked the
 * PDF is downloaded instead. Throws FileFetchError for HTTP errors (the tab
 * is closed then).
 */
export async function openPdfPreview(opts: OpenPdfOptions): Promise<"tab" | "downloaded"> {
  const newTab = window.open("about:blank", "_blank");
  if (newTab) {
    newTab.document.write(placeholderPage(opts.fileName, !!opts.preparing));
    newTab.document.close();
  }
  opts.onProgress?.(0);

  let blobUrl: string;
  try {
    blobUrl = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", opts.url);
      xhr.responseType = "blob";
      xhr.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        opts.onProgress?.(pct);
        try {
          if (newTab && !newTab.closed) {
            const bar = newTab.document.getElementById("bar");
            const pctEl = newTab.document.getElementById("pct");
            if (bar) bar.style.width = pct + "%";
            if (pctEl) pctEl.textContent = pct + "%";
          }
        } catch { /* tab navigated away */ }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(URL.createObjectURL(xhr.response));
        else reject(new FileFetchError(xhr.status));
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send();
    });
  } catch (err) {
    newTab?.close();
    throw err;
  } finally {
    opts.onProgress?.(null);
  }

  if (newTab) {
    newTab.location.href = blobUrl;
    return "tab";
  }
  // Popups blocked: download the PDF instead.
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = opts.fileName.replace(/\.[^.]+$/, "") + ".pdf";
  a.click();
  URL.revokeObjectURL(blobUrl);
  return "downloaded";
}
