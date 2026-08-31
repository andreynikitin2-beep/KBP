function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, 200000);
}

export function extractHtmlText(html: string): string {
  return normalizeText(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'"),
  );
}

function getExtension(fileType?: string, fileName?: string): string {
  const type = String(fileType || "").toLowerCase().trim();
  if (type.includes("pdf")) return "pdf";
  if (type.includes("wordprocessingml") || type.includes("docx")) return "docx";
  if (type === "doc" || type.includes("msword")) return "doc";
  if (type && !type.includes("/")) return type.replace(/^\./, "");

  const name = String(fileName || "").toLowerCase();
  return name.includes(".") ? name.split(".").pop() || "" : "";
}

/**
 * Extract text from uploaded office documents.
 * PDF parsing reads the document's text layer; OCR is intentionally not
 * attempted for image-only scans because it requires a separate OCR service.
 */
export async function extractDocumentText(
  buffer: Buffer,
  fileType?: string,
  fileName?: string,
): Promise<string> {
  const extension = getExtension(fileType, fileName);

  if (extension === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return normalizeText(result.text || "");
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  if (extension === "docx") {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer });
    return normalizeText(result.value || "");
  }

  if (extension === "doc") {
    const moduleName = "word-extractor";
    const wordExtractorModule: any = await import(moduleName);
    const WordExtractor = wordExtractorModule.default ?? wordExtractorModule;
    const document = await new WordExtractor().extract(buffer);
    return normalizeText(document.getBody?.() || "");
  }

  // Allow text-like uploads to be useful even when they are added as files.
  if (["txt", "md", "csv", "log"].includes(extension)) {
    return normalizeText(buffer.toString("utf8"));
  }

  return "";
}