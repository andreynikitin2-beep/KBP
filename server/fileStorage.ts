import fs from "fs";
import path from "path";

const RAW_PATH = process.env.FILE_STORAGE_PATH;
let _storageDir: string = RAW_PATH
  ? path.resolve(RAW_PATH)
  : path.resolve("uploads");

try {
  fs.mkdirSync(_storageDir, { recursive: true });
} catch {
  // will surface on first write
}

/** The current active storage directory (absolute path). */
export function getStorageDir(): string {
  return _storageDir;
}

/**
 * Override the storage directory at runtime (used by admin settings).
 * Ignored when FILE_STORAGE_PATH env var is set — env always wins.
 */
export function setStorageDir(newPath: string): void {
  if (process.env.FILE_STORAGE_PATH) return; // env var takes priority
  if (!newPath || !newPath.trim()) return;
  const resolved = path.resolve(newPath.trim());
  fs.mkdirSync(resolved, { recursive: true });
  _storageDir = resolved;
}

/** @deprecated use getStorageDir() */
export const STORAGE_DIR: string = _storageDir; // kept for compat — reflects initial value only

function versionDir(versionId: string): string {
  return path.join(_storageDir, versionId);
}

function contentFilePath(versionId: string): string {
  return path.join(versionDir(versionId), "content");
}

function addFilePath(versionId: string, fileId: string): string {
  return path.join(versionDir(versionId), `add_${fileId}`);
}

export function writeContentFile(versionId: string, buf: Buffer): void {
  fs.mkdirSync(versionDir(versionId), { recursive: true });
  fs.writeFileSync(contentFilePath(versionId), buf);
}

export function readContentFile(versionId: string): Buffer | null {
  const p = contentFilePath(versionId);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

export function deleteContentFile(versionId: string): void {
  const p = contentFilePath(versionId);
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
}

export function writeAdditionalFile(versionId: string, fileId: string, buf: Buffer): void {
  fs.mkdirSync(versionDir(versionId), { recursive: true });
  fs.writeFileSync(addFilePath(versionId, fileId), buf);
}

export function readAdditionalFile(versionId: string, fileId: string): Buffer | null {
  const p = addFilePath(versionId, fileId);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

export function deleteAdditionalFile(versionId: string, fileId: string): void {
  const p = addFilePath(versionId, fileId);
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
}

export function deleteVersionFiles(versionId: string): void {
  const dir = versionDir(versionId);
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

export function getStorageStats(): { totalFiles: number; totalBytes: number } {
  let totalFiles = 0;
  let totalBytes = 0;
  try {
    const storageDir = _storageDir;
    const versionDirs = fs.existsSync(storageDir) ? fs.readdirSync(storageDir) : [];
    for (const vd of versionDirs) {
      const vdPath = path.join(storageDir, vd);
      try {
        const stat = fs.statSync(vdPath);
        if (!stat.isDirectory()) continue;
        const files = fs.readdirSync(vdPath);
        for (const f of files) {
          try {
            const fStat = fs.statSync(path.join(vdPath, f));
            if (fStat.isFile()) {
              totalFiles++;
              totalBytes += fStat.size;
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return { totalFiles, totalBytes };
}
