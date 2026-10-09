import { storage } from "./storage";
import { kickEmailQueue } from "./mailer";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Overdue review check: published materials whose next review date has passed
 * go to "На пересмотре" and their owner gets an email. Runs on the server so
 * it happens even when nobody opens the portal, and readers' browsers no
 * longer need rights to change material status.
 */
export async function runOverdueCheck(now: Date = new Date()): Promise<number> {
  const moved = await storage.transitionOverdueVersions(now);
  if (moved.length === 0) return 0;

  const users = await storage.getUsers();
  for (const v of moved) {
    const owner = users.find((u) => u.id === v.ownerId);
    if (!owner?.email) continue;
    await storage.createNotification({
      toAddress: owner.email,
      subject: `Просрочка пересмотра: ${v.title}`,
      template: "overdue",
      relatedMaterialId: v.materialId,
      relatedVersionId: v.id,
      status: "LOGGED",
    });
  }
  kickEmailQueue();
  console.log(`[review] ${moved.length} material version(s) moved to "На пересмотре"`);
  return moved.length;
}

export function startOverdueCheck(): void {
  const run = () => runOverdueCheck().catch((e) => console.error("[review] overdue check failed:", e));
  run();
  setInterval(run, CHECK_INTERVAL_MS).unref();
}
