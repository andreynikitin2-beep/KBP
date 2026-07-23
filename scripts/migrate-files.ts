import { eq, isNotNull, or } from "drizzle-orm";
import { db, pool } from "../server/db";
import * as schema from "../shared/schema";
import * as fileStorage from "../server/fileStorage";

async function main() {
  console.log(`Хранилище: ${fileStorage.STORAGE_DIR}\n`);

  const versions = await db
    .select()
    .from(schema.materialVersions)
    .where(
      or(
        isNotNull(schema.materialVersions.contentFileData),
        isNotNull(schema.materialVersions.additionalFilesData)
      )
    );

  console.log(`Найдено версий с файлами в БД: ${versions.length}`);
  if (!versions.length) {
    console.log("Нечего мигрировать.");
    await pool.end();
    return;
  }

  let contentMigrated = 0;
  let addlMigrated = 0;
  let errors = 0;

  for (const v of versions) {
    const updates: Record<string, unknown> = {};

    // --- Основной файл (PDF/DOCX) ---
    if ((v as any).contentFileData) {
      try {
        const buf = Buffer.from((v as any).contentFileData as string, "base64");
        fileStorage.writeContentFile(v.id, buf);
        updates.contentFileData = null;
        contentMigrated++;
        const sizekb = (buf.length / 1024).toFixed(1);
        console.log(`  [OK] ${v.id} contentFile → ${sizekb} КБ`);
      } catch (e) {
        errors++;
        console.error(`  [ERR] ${v.id} contentFile: ${e}`);
      }
    }

    // --- Дополнительные файлы ---
    const addlData = (v as any).additionalFilesData as Record<string, string> | null;
    if (addlData && typeof addlData === "object") {
      const clearedData: Record<string, string> = { ...addlData };
      for (const [fileId, b64] of Object.entries(addlData)) {
        try {
          const buf = Buffer.from(b64, "base64");
          fileStorage.writeAdditionalFile(v.id, fileId, buf);
          delete clearedData[fileId];
          addlMigrated++;
          const sizekb = (buf.length / 1024).toFixed(1);
          console.log(`  [OK] ${v.id} add:${fileId} → ${sizekb} КБ`);
        } catch (e) {
          errors++;
          console.error(`  [ERR] ${v.id} add:${fileId}: ${e}`);
        }
      }
      updates.additionalFilesData = Object.keys(clearedData).length ? clearedData : null;
    }

    if (Object.keys(updates).length) {
      await db
        .update(schema.materialVersions)
        .set(updates as any)
        .where(eq(schema.materialVersions.id, v.id));
    }
  }

  console.log(`\n=== Готово ===`);
  console.log(`Основных файлов перенесено:       ${contentMigrated}`);
  console.log(`Дополнительных файлов перенесено: ${addlMigrated}`);
  if (errors) console.warn(`Ошибок: ${errors}`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
