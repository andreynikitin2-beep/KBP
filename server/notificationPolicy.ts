// Notifications are still triggered by the browser (workflow actions), but
// their text is not trusted: the subject is rebuilt on the server from a known
// prefix and the material's real title, so the mail queue cannot be used to
// send arbitrary text to colleagues.

export const ALLOWED_TEMPLATES = new Set(["new_version", "auto_transition", "overdue"]);

/** Subject prefixes the UI uses for material notifications (text before ": "). */
export const MATERIAL_SUBJECT_PREFIXES = new Set([
  "Новая версия",
  "Актуальность подтверждена",
  "Запрос на согласование",
  "Опубликовано напрямую",
  "Требуется ваше согласование",
  "Согласовано и опубликовано",
  "Публикация отклонена",
  "Принудительно опубликовано",
]);

const MAX_SUBJECT = 300;

export type SubjectDecision = { ok: true; subject: string } | { ok: false; reason: string };

/**
 * Rebuild the subject of a notification about a material.
 * `title`/`version` come from the database, not from the request.
 */
export function buildMaterialSubject(requested: unknown, title: string, version?: string | null): SubjectDecision {
  if (typeof requested !== "string") return { ok: false, reason: "Недопустимая тема письма" };
  const sep = requested.indexOf(": ");
  const prefix = sep > 0 ? requested.slice(0, sep) : "";
  if (!MATERIAL_SUBJECT_PREFIXES.has(prefix)) return { ok: false, reason: "Недопустимая тема письма" };
  const suffix = prefix === "Новая версия" && version ? ` (${version})` : "";
  return { ok: true, subject: `${prefix}: ${title}${suffix}`.slice(0, MAX_SUBJECT) };
}

/** Admin-only system notices (AD sync, deactivation) keep their text, length-capped. */
export function sanitizeSystemSubject(requested: unknown): SubjectDecision {
  if (typeof requested !== "string" || !requested.trim()) return { ok: false, reason: "Недопустимая тема письма" };
  return { ok: true, subject: requested.replace(/[\r\n]+/g, " ").slice(0, MAX_SUBJECT) };
}
