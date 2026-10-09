// Предпросмотр офисных документов в PDF: конвертация, кэш, ошибки конвертера.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import * as fileStorage from "./fileStorage";
import {
  ConversionFailedError,
  ConverterUnavailableError,
  UnsupportedFormatError,
  getPreviewPdf,
  isPreviewable,
} from "./docPreview";

const savedStorage = process.env.FILE_STORAGE_PATH;
const savedUrl = process.env.DOC_CONVERTER_URL;
const PDF = Buffer.from("%PDF-1.7 converted");
const fetchMock = vi.fn();

beforeAll(() => {
  delete process.env.FILE_STORAGE_PATH;
  vi.stubGlobal("fetch", fetchMock);
});

beforeEach(() => {
  fileStorage.setStorageDir(fs.mkdtempSync(path.join(os.tmpdir(), "kbp-preview-")));
  process.env.DOC_CONVERTER_URL = "http://converter:3000";
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(PDF, { status: 200 }));
});

afterAll(() => {
  vi.unstubAllGlobals();
  if (savedStorage !== undefined) process.env.FILE_STORAGE_PATH = savedStorage;
  if (savedUrl === undefined) delete process.env.DOC_CONVERTER_URL;
  else process.env.DOC_CONVERTER_URL = savedUrl;
});

function docx(versionId: string, content = "docx-bytes", fileId?: string) {
  const original = Buffer.from(content);
  if (fileId) fileStorage.writeAdditionalFile(versionId, fileId, original);
  else fileStorage.writeContentFile(versionId, original);
  return { versionId, fileId, fileName: "Инструкция.docx", original };
}

describe("isPreviewable", () => {
  it("PDF и офисные форматы — да, остальное — нет", () => {
    for (const n of ["a.pdf", "a.DOCX", "a.doc", "a.rtf", "a.odt", "a.xlsx", "a.xls", "a.pptx", "a.odp"]) expect(isPreviewable(n)).toBe(true);
    for (const n of ["a.png", "a.zip", "a.txt", "noext", ""]) expect(isPreviewable(n)).toBe(false);
  });
});

describe("getPreviewPdf", () => {
  it("PDF отдаётся как есть, без конвертера", async () => {
    const original = Buffer.from("%PDF-1.4 original");
    expect(await getPreviewPdf({ versionId: "v-1", fileName: "a.pdf", original })).toBe(original);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("DOCX конвертируется один раз и дальше берётся из кэша", async () => {
    const req = docx("v-1");
    expect((await getPreviewPdf(req)).toString()).toBe(PDF.toString());
    expect((await getPreviewPdf(req)).toString()).toBe(PDF.toString());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://converter:3000/forms/libreoffice/convert");
    const sent = (init.body as FormData).get("files") as File;
    expect(sent.name).toBe("document.docx");
    expect(JSON.parse(String((init.body as FormData).get("metadata")))).toEqual({ Title: "Инструкция" });
  });

  it("одновременные запросы — одна конвертация", async () => {
    const req = docx("v-1");
    await Promise.all([getPreviewPdf(req), getPreviewPdf(req), getPreviewPdf(req)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("новый файл сбрасывает кэш", async () => {
    await getPreviewPdf(docx("v-1", "old"));
    await getPreviewPdf(docx("v-1", "new"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("кэш доп. файлов отдельный и сбрасывается при удалении файла", async () => {
    await getPreviewPdf(docx("v-1", "a", "f1"));
    expect(fileStorage.readPreview("v-1", "f1")).not.toBeNull();
    expect(fileStorage.readPreview("v-1")).toBeNull();
    fileStorage.deleteAdditionalFile("v-1", "f1");
    expect(fileStorage.readPreview("v-1", "f1")).toBeNull();
  });

  it("не кэширует результат, если файл заменили во время конвертации", async () => {
    const req = docx("v-1", "old");
    fetchMock.mockImplementation(async () => {
      fileStorage.writeContentFile("v-1", Buffer.from("replaced"));
      return new Response(PDF, { status: 200 });
    });
    await getPreviewPdf(req);
    expect(fileStorage.readPreview("v-1")).toBeNull();
  });

  it("неподдерживаемый формат", async () => {
    await expect(getPreviewPdf({ versionId: "v-1", fileName: "a.png", original: Buffer.from("x") }))
      .rejects.toBeInstanceOf(UnsupportedFormatError);
  });

  it("конвертер не настроен или недоступен", async () => {
    delete process.env.DOC_CONVERTER_URL;
    await expect(getPreviewPdf(docx("v-1"))).rejects.toBeInstanceOf(ConverterUnavailableError);
    process.env.DOC_CONVERTER_URL = "http://converter:3000";
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(getPreviewPdf(docx("v-2"))).rejects.toBeInstanceOf(ConverterUnavailableError);
    fetchMock.mockResolvedValueOnce(new Response("busy", { status: 503 }));
    await expect(getPreviewPdf(docx("v-3"))).rejects.toBeInstanceOf(ConverterUnavailableError);
  });

  it("ошибка конвертации и ответ не-PDF", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad document", { status: 400 }));
    await expect(getPreviewPdf(docx("v-1"))).rejects.toBeInstanceOf(ConversionFailedError);
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    await expect(getPreviewPdf(docx("v-2"))).rejects.toBeInstanceOf(ConversionFailedError);
    expect(fileStorage.readPreview("v-2")).toBeNull();
  });
});
