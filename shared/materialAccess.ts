// Material access rules enforced by the server.
//
// They mirror the client checks in client/src/lib/kbLogic.ts (canViewMaterial,
// canViewVersion, canSubmitForApproval, canApproveAndPublish, …) but work on
// database rows, so the API no longer trusts the browser. Visibility is the
// union of the client's two checks, so nothing visible in the UI today
// disappears; status changes follow the workflow transitions the UI performs.

export const ADMIN_ROLE = "Администратор";
const CONTENT_ROLES = ["Автор", "Владелец", "Заместитель владельца", ADMIN_ROLE];

export const STATUS = {
  draft: "Черновик",
  review: "На согласовании",
  published: "Опубликовано",
  revision: "На пересмотре",
  archived: "Архив",
} as const;

export type AccessUser = { id: string; roles?: unknown };

export type VersionRow = {
  id: string;
  materialId: string;
  createdBy: string;
  ownerId?: string | null;
  deputyId?: string | null;
  sectionId: string;
  visibilityGroupIds?: string[] | null;
  status: string;
  approvalStep?: string | null;
  nextReviewAt?: Date | string | null;
};

export type GroupRow = { id: string; isSystem: boolean; memberIds?: string[] | null };
export type NodeRow = { id: string; type: string; parentId?: string | null; ownerIds?: string[] | null };

export type AccessContext = {
  groups: GroupRow[];
  nodes: NodeRow[];
  /** materialId → visibility groups of the published version */
  effectiveGroupIds: Record<string, string[] | undefined>;
};

function roles(user: AccessUser): string[] {
  return Array.isArray(user.roles) ? (user.roles as string[]) : [];
}

export function isAdmin(user: AccessUser): boolean {
  return roles(user).includes(ADMIN_ROLE);
}

/** Same lookup as getSectionOwnerIds on the client. */
export function sectionOwnerIds(version: Pick<VersionRow, "sectionId">, nodes: NodeRow[]): string[] {
  const node = nodes.find((n) => n.id === version.sectionId);
  if (!node) return [];
  if (node.ownerIds && node.ownerIds.length > 0) return node.ownerIds;
  if (node.type === "subsection" && node.parentId) {
    return nodes.find((n) => n.id === node.parentId)?.ownerIds || [];
  }
  return [];
}

function isOwnerOrDeputy(user: AccessUser, v: VersionRow): boolean {
  return (!!v.ownerId && v.ownerId === user.id) || (!!v.deputyId && v.deputyId === user.id);
}

function isSectionOwner(user: AccessUser, v: VersionRow, nodes: NodeRow[]): boolean {
  return sectionOwnerIds(v, nodes).includes(user.id);
}

/** Empty group list means "everyone", a system group means "everyone". */
function groupsAllow(user: AccessUser, groupIds: string[] | null | undefined, groups: GroupRow[]): boolean {
  if (!groupIds || groupIds.length === 0) return true;
  for (const gId of groupIds) {
    const group = groups.find((g) => g.id === gId);
    if (!group) continue;
    if (group.isSystem) return true;
    if ((group.memberIds || []).includes(user.id)) return true;
  }
  return false;
}

export function canViewVersion(user: AccessUser, v: VersionRow, ctx: AccessContext): boolean {
  if (isAdmin(user)) return true;
  if (v.createdBy === user.id || isOwnerOrDeputy(user, v)) return true;
  // Section owners approve materials of their section and must see them.
  if (isSectionOwner(user, v, ctx.nodes)) return true;
  if (groupsAllow(user, v.visibilityGroupIds, ctx.groups)) return true;
  const effective = ctx.effectiveGroupIds[v.materialId];
  return effective !== undefined && groupsAllow(user, effective, ctx.groups);
}

/** Anyone who may change a material: admin, owner/deputy, section owner or an author of any of its versions. */
export function isMaterialManager(user: AccessUser, v: VersionRow, allVersions: VersionRow[], ctx: AccessContext): boolean {
  if (isAdmin(user)) return true;
  if (isOwnerOrDeputy(user, v) || isSectionOwner(user, v, ctx.nodes)) return true;
  return allVersions.some((x) => x.materialId === v.materialId && x.createdBy === user.id);
}

function isApprover(user: AccessUser, v: VersionRow, ctx: AccessContext): boolean {
  if (isAdmin(user)) return true;
  const step = v.approvalStep || "material_owner";
  if (step === "material_owner") return isOwnerOrDeputy(user, v);
  if (step === "section_owner") return isSectionOwner(user, v, ctx.nodes);
  return false;
}

const COUNTER_FIELDS = new Set(["views", "helpfulYes", "helpfulNo"]);
const IMMUTABLE_FIELDS = new Set(["id", "materialId", "createdBy"]);

export type Decision = { ok: true } | { ok: false; reason: string };
const allow: Decision = { ok: true };
const deny = (reason: string): Decision => ({ ok: false, reason });

/** May `user` create this version (a new material, or a new version of an existing one)? */
export function canCreateVersion(user: AccessUser, version: VersionRow, existing: VersionRow[], ctx: AccessContext): Decision {
  if (isAdmin(user)) return allow;
  if (existing.length === 0) {
    return roles(user).some((r) => CONTENT_ROLES.includes(r))
      ? allow
      : deny("Создавать материалы могут авторы, владельцы и администраторы");
  }
  if (!existing.some((v) => isMaterialManager(user, v, existing, ctx))) return deny("Недостаточно прав для создания новой версии");
  if (version.status !== STATUS.draft) return deny("Новая версия создаётся только как черновик");
  return allow;
}

/**
 * May `user` apply `patch` to `before`? `allVersions` are the versions of the
 * same material. Mirrors the workflow actions of the UI.
 */
export function canUpdateVersion(
  user: AccessUser,
  before: VersionRow,
  patch: Record<string, unknown>,
  allVersions: VersionRow[],
  ctx: AccessContext,
): Decision {
  const keys = Object.keys(patch);
  if (!canViewVersion(user, before, ctx)) return deny("Материал недоступен");

  if (keys.some((k) => IMMUTABLE_FIELDS.has(k) && patch[k] !== (before as any)[k])) {
    return deny("Нельзя менять материал, автора или идентификатор версии");
  }

  if (isAdmin(user)) return allow;

  // Counters are maintained by the server (view log, ratings).
  if (keys.some((k) => COUNTER_FIELDS.has(k))) return deny("Счётчики просмотров и оценок меняет только сервер");

  const nextStatus = typeof patch.status === "string" ? patch.status : before.status;
  const statusChanges = nextStatus !== before.status;

  if (!isMaterialManager(user, before, allVersions, ctx)) return deny("Недостаточно прав для изменения материала");

  if (!statusChanges) {
    // Approval step 1 of 2 moves the version to the section owner.
    if ("approvalStep" in patch && patch.approvalStep !== before.approvalStep && before.status === STATUS.review) {
      return isApprover(user, before, ctx) ? allow : deny("Недостаточно прав для согласования");
    }
    return allow;
  }

  const from = before.status;
  switch (nextStatus) {
    case STATUS.review:
      // Submit for approval: the author of the draft.
      return from === STATUS.draft && before.createdBy === user.id ? allow : deny("Отправить на согласование может только автор черновика");
    case STATUS.published:
      if (from === STATUS.review) return isApprover(user, before, ctx) ? allow : deny("Недостаточно прав для согласования");
      if (from === STATUS.revision) return isOwnerOrDeputy(user, before) ? allow : deny("Подтвердить актуальность может владелец или заместитель");
      if (from === STATUS.archived) {
        return isOwnerOrDeputy(user, before) || isSectionOwner(user, before, ctx.nodes) ? allow : deny("Недостаточно прав для восстановления");
      }
      return deny("Публикация черновика без согласования доступна только администратору");
    case STATUS.draft:
      // Return for revision.
      return from === STATUS.review && isApprover(user, before, ctx) ? allow : deny("Недостаточно прав для возврата на доработку");
    case STATUS.archived:
    case STATUS.revision:
      return allow;
    default:
      return deny("Недопустимый статус");
  }
}
