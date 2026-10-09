// Восстановление бинарника версии из предыдущих версий того же материала.
// Тест работает во временном каталоге и не трогает базу.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import * as fileStorage from "./fileStorage";

let tmpDir: string;
const savedEnv = process.env.FILE_STORAGE_PATH;

beforeAll(() => {
  delete process.env.FILE_STORAGE_PATH;
});

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kbp-files-"));
  fileStorage.setStorageDir(tmpDir);
});

afterAll(() => {
  if (savedEnv !== undefined) process.env.FILE_STORAGE_PATH = savedEnv;
});

describe("recoverContentFileFrom", () => {
  it("копирует файл из самой новой предыдущей версии с тем же именем", () => {
    fileStorage.writeContentFile("v-old", Buffer.from("old"));
    fileStorage.writeContentFile("v-mid", Buffer.from("mid"));

    const result = fileStorage.recoverContentFileFrom("v-new", "doc.pdf", [
      { id: "v-mid", contentFile: { name: "doc.pdf" } },
      { id: "v-old", contentFile: { name: "doc.pdf" } },
    ]);

    expect(result?.sourceVersionId).toBe("v-mid");
    expect(fileStorage.readContentFile("v-new")?.toString()).toBe("mid");
    expect(fileStorage.hasContentFile("v-new")).toBe(true);
  });

  it("пропускает версии без файла на диске", () => {
    fileStorage.writeContentFile("v-old", Buffer.from("old"));

    const result = fileStorage.recoverContentFileFrom("v-new", "doc.pdf", [
      { id: "v-mid", contentFile: { name: "doc.pdf" } },
      { id: "v-old", contentFile: { name: "doc.pdf" } },
    ]);

    expect(result?.sourceVersionId).toBe("v-old");
  });

  it("не берёт файл с другим именем", () => {
    fileStorage.writeContentFile("v-old", Buffer.from("other"));

    const result = fileStorage.recoverContentFileFrom("v-new", "doc.pdf", [
      { id: "v-old", contentFile: { name: "other.pdf" } },
    ]);

    expect(result).toBeNull();
    expect(fileStorage.hasContentFile("v-new")).toBe(false);
  });

  it("возвращает null, если источника нет или имя неизвестно", () => {
    expect(fileStorage.recoverContentFileFrom("v-new", "doc.pdf", [])).toBeNull();
    expect(fileStorage.recoverContentFileFrom("v-new", undefined, [{ id: "v-old", contentFile: {} }])).toBeNull();
  });
});

describe("recoverAdditionalFileFrom", () => {
  it("копирует доп. файл с тем же id из предыдущей версии", () => {
    fileStorage.writeAdditionalFile("v-old", "f1", Buffer.from("extra"));

    const buffer = fileStorage.recoverAdditionalFileFrom("v-new", "f1", ["v-mid", "v-old"]);

    expect(buffer?.toString()).toBe("extra");
    expect(fileStorage.readAdditionalFile("v-new", "f1")?.toString()).toBe("extra");
  });

  it("возвращает null, если доп. файла нигде нет", () => {
    expect(fileStorage.recoverAdditionalFileFrom("v-new", "f1", ["v-old"])).toBeNull();
  });
});

describe("защита путей", () => {
  it("отклоняет id с ../, слешами и пустые", () => {
    for (const bad of ["../x", "a/b", "..", "", "a\\b", "/etc/passwd", "x".repeat(200)]) {
      expect(fileStorage.isSafeStorageId(bad)).toBe(false);
    }
    expect(fileStorage.isSafeStorageId("v-6f1c2c1e-1111-4222-8333-944455556666-1")).toBe(true);
  });

  it("не пишет за пределы хранилища", () => {
    expect(() => fileStorage.writeContentFile("../escape", Buffer.from("x"))).toThrow();
    expect(() => fileStorage.writeAdditionalFile("v-1", "/../../escape", Buffer.from("x"))).toThrow();
    expect(fs.existsSync(path.join(tmpDir, "..", "escape"))).toBe(false);
  });

  it("чтение с недопустимым id возвращает «нет файла», а не ошибку", () => {
    expect(fileStorage.readContentFile("../x")).toBeNull();
    expect(fileStorage.hasContentFile("../x")).toBe(false);
    expect(fileStorage.readAdditionalFile("v-1", "../x")).toBeNull();
  });
});
