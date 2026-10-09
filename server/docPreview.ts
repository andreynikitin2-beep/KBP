// PDF previews of office documents.
//
// Word/Excel/PowerPoint files are rendered to PDF by LibreOffice running in a
// separate Gotenberg container (DOC_CONVERTER_URL) — effectively "print to
// PDF" on the server. The PDF keeps the document's layout and a real text
// layer, so text can be selected and copied in the browser's PDF viewer. The
// result is cached next to the file and dropped when the file is replaced.
import * as fileStorage from "./fileStorage";

/** Formats LibreOffice converts; PDF is served as it is. */
export const CONVERTIBLE_EXT = new Set(["doc", "docx", "rtf", "odt", "xls", "xlsx", "ods", "ppt", "pptx", "odp"]);

const MAX_CONVERT_BYTES = 50 * 1024 * 1024;
const CONVERT_TIMEOUT_MS = 90_000;

export class UnsupportedFormatError extends Error {}
export class ConverterUnavailableError extends Error {}
export class ConversionFailedError extends Error {}

export function fileExtension(name: string | undefined | null): string {
  const n = String(name || "");
  return n.includes(".") ? n.split(".").pop()!.toLowerCase() : "";
}

export function isPreviewable(name: string | undefined | null): boolean {
  const ext = fileExtension(name);
  return ext === "pdf" || CONVERTIBLE_EXT.has(ext);
}

type PreviewRequest = {
  versionId: string;
  /** omitted for the main file */
  fileId?: string;
  fileName: string;
  original: Buffer;
};

const inFlight = new Map<string, Promise<Buffer>>();

/** PDF bytes for previewing a file: the file itself if it is a PDF, else a cached or fresh conversion. */
export async function getPreviewPdf(req: PreviewRequest): Promise<Buffer> {
  const ext = fileExtension(req.fileName);
  if (ext === "pdf") return req.original;
  if (!CONVERTIBLE_EXT.has(ext)) throw new UnsupportedFormatError(`Предпросмотр недоступен для формата .${ext || "?"}`);

  const cached = fileStorage.readPreview(req.versionId, req.fileId);
  if (cached) return cached;

  // Concurrent requests for the same file share one conversion.
  const key = `${req.versionId}:${req.fileId ?? "content"}`;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const job = convertToPdf(req.original, req.fileName)
    .then((pdf) => {
      // Cache only if the file was not replaced while converting.
      const current = req.fileId === undefined
        ? fileStorage.readContentFile(req.versionId)
        : fileStorage.readAdditionalFile(req.versionId, req.fileId);
      if (current && current.equals(req.original)) fileStorage.writePreview(req.versionId, req.fileId, pdf);
      return pdf;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

/** Convert in the background right after an upload so the first preview opens fast. */
export function warmPreview(req: PreviewRequest): void {
  if (!process.env.DOC_CONVERTER_URL || !CONVERTIBLE_EXT.has(fileExtension(req.fileName))) return;
  getPreviewPdf(req).catch((e) => console.warn(`[preview] ${req.fileName}: ${e?.message || e}`));
}

async function convertToPdf(original: Buffer, fileName: string): Promise<Buffer> {
  const base = process.env.DOC_CONVERTER_URL;
  if (!base) throw new ConverterUnavailableError("Конвертер документов не настроен (DOC_CONVERTER_URL)");
  if (original.length > MAX_CONVERT_BYTES) throw new UnsupportedFormatError("Файл слишком большой для предпросмотра");

  const form = new FormData();
  // LibreOffice picks the import filter by extension; keep the real one.
  const safeName = `document.${fileExtension(fileName)}`;
  form.append("files", new Blob([original]), safeName);
  // The PDF viewer shows the document title instead of the tab's blob id.
  const title = String(fileName || "").replace(/\.[^.]+$/, "").slice(0, 200);
  if (title) form.append("metadata", JSON.stringify({ Title: title }));

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}/forms/libreoffice/convert`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(CONVERT_TIMEOUT_MS),
    });
  } catch (e: any) {
    throw new ConverterUnavailableError(`Конвертер документов недоступен: ${e?.message || e}`);
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    // The converter is overloaded or restarting: treat as unavailable.
    throw new ConverterUnavailableError(`Конвертер документов недоступен (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new ConversionFailedError(`Не удалось преобразовать документ (HTTP ${res.status}) ${detail}`.trim());
  }
  const pdf = Buffer.from(await res.arrayBuffer());
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new ConversionFailedError("Конвертер вернул не PDF");
  return pdf;
}
