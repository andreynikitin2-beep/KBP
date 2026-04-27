import type { CatalogNode, MaterialVersion, NotificationLog, RFC, Role, User, VisibilityGroup } from "./mockData";

export const PORTAL_TZ = "Europe/Moscow";

export function getMoscowDate(date?: Date): Date {
  const d = date || new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 3 * 3600000);
}

export function getMoscowDateString(date?: Date): string {
  const m = getMoscowDate(date);
  const y = m.getFullYear();
  const mo = String(m.getMonth() + 1).padStart(2, "0");
  const da = String(m.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export const POPULARITY_WEIGHTS = { w1: 0.7, w2: 0.3, w3: 0 };
export const HELPFULNESS_SMOOTHING = 20;
export const MIN_RATINGS_FOR_HELPFUL = 5;
export const POPULARITY_VIEW_DAYS = 30;

export function computeHelpfulnessScore(
  helpful: number,
  total: number,
  avgHelpfulness: number,
  m: number = HELPFULNESS_SMOOTHING,
): number {
  return (helpful + m * avgHelpfulness) / (total + m);
}

export function computePopularityScore(
  views30d: number,
  helpfulnessScore: number,
): number {
  return POPULARITY_WEIGHTS.w1 * Math.log(views30d + 1) + POPULARITY_WEIGHTS.w2 * helpfulnessScore;
}

export function hasAnyRole(user: User, required?: Role[]) {
  if (!required || required.length === 0) return true;
  return required.some((r) => user.roles.includes(r));
}

export function withinScope(user: User, node: CatalogNode) {
  return hasAnyRole(user, node.allowedRoles);
}

export function findNode(nodes: CatalogNode[], id: string) {
  return nodes.find((n) => n.id === id);
}

export function getSectionPath(nodes: CatalogNode[], id: string) {
  const node = findNode(nodes, id);
  if (!node) return [] as CatalogNode[];
  if (!node.parentId) return [node];
  const parent = findNode(nodes, node.parentId);
  return parent ? [parent, node] : [node];
}

export function isOverdue(version: MaterialVersion) {
  const next = version.passport.nextReviewAt;
  if (!next) return false;
  return new Date(next).getTime() < Date.now() && version.status !== "Архив";
}

export function daysToNextReview(version: MaterialVersion) {
  const next = version.passport.nextReviewAt;
  if (!next) return null;
  const ms = new Date(next).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function canConfirmActuality(user: User, version: MaterialVersion) {
  const ownerOk = version.passport.ownerId === user.id;
  const deputyOk = version.passport.deputyId === user.id;
  const adminOk = user.roles.includes("Администратор");
  return ownerOk || deputyOk || adminOk;
}

export function canViewMaterial(
  user: User,
  material: MaterialVersion,
  groups: VisibilityGroup[],
  effectiveGroupIds?: string[],
) {
  if (user.roles.includes("Администратор")) return true;

  const isDraftOrReview = material.status === "Черновик" || material.status === "На согласовании";
  if (isDraftOrReview) {
    const isAuthor = material.createdBy === user.id;
    const isOwner = material.passport.ownerId === user.id;
    const isDeputy = material.passport.deputyId === user.id;
    if (isAuthor || isOwner || isDeputy) return true;
  }

  const gIds = effectiveGroupIds ?? material.passport.visibilityGroupIds;
  if (!gIds || gIds.length === 0) return true;

  for (const gId of gIds) {
    const group = groups.find((g) => g.id === gId);
    if (!group) continue;
    if (group.isSystem) return true;
    if (group.memberIds.includes(user.id)) return true;
  }
  return false;
}

export function canViewVersion(
  user: User,
  version: MaterialVersion,
  groups: VisibilityGroup[],
) {
  if (user.roles.includes("Администратор")) return true;

  const isAuthor = version.createdBy === user.id;
  const isOwner = version.passport.ownerId === user.id;
  const isDeputy = version.passport.deputyId === user.id;
  if (isAuthor || isOwner || isDeputy) return true;

  const gIds = version.passport.visibilityGroupIds;
  if (!gIds || gIds.length === 0) return true;

  for (const gId of gIds) {
    const group = groups.find((g) => g.id === gId);
    if (!group) continue;
    if (group.isSystem) return true;
    if (group.memberIds.includes(user.id)) return true;
  }
  return false;
}

export function canViewAudit(user: User) {
  return user.roles.includes("Администратор");
}

export function canEditPublished(user: User) {
  return user.roles.includes("Администратор") || user.roles.includes("Владелец") || user.roles.includes("Заместитель владельца");
}

export function canForcePublish(user: User) {
  return user.roles.includes("Администратор");
}

export function isCreatorOwnerOrDeputy(user: User, version: MaterialVersion) {
  return version.passport.ownerId === user.id || version.passport.deputyId === user.id;
}

export function getSectionOwnerIds(version: MaterialVersion, catalogNodes: CatalogNode[]): string[] {
  const node = catalogNodes.find(n => n.id === version.passport.sectionId);
  if (!node) return [];
  if (node.ownerIds && node.ownerIds.length > 0) return node.ownerIds;
  if (node.type === "subsection" && node.parentId) {
    const parent = catalogNodes.find(n => n.id === node.parentId);
    return parent?.ownerIds || [];
  }
  return [];
}

export function isSectionOwner(user: User, version: MaterialVersion, catalogNodes: CatalogNode[]): boolean {
  return getSectionOwnerIds(version, catalogNodes).includes(user.id);
}

export function getApprovalStep(version: MaterialVersion): "material_owner" | "section_owner" {
  return (version.approvalStep as "material_owner" | "section_owner") || "material_owner";
}

export function canPublishDirectly(_user: User, _version: MaterialVersion) {
  return false;
}

export function canSubmitForApproval(user: User, version: MaterialVersion) {
  if (version.status !== "Черновик") return false;
  if (version.rejectedAt) return false;
  const isCreator = version.createdBy === user.id;
  const isAdmin = user.roles.includes("Администратор");
  return isCreator || isAdmin;
}

export function canApproveAndPublish(user: User, version: MaterialVersion, catalogNodes: CatalogNode[]) {
  if (version.status !== "На согласовании") return false;
  const isAdmin = user.roles.includes("Администратор");
  if (isAdmin) return true;
  const step = getApprovalStep(version);
  if (step === "material_owner") {
    return version.passport.ownerId === user.id || version.passport.deputyId === user.id;
  }
  if (step === "section_owner") {
    return isSectionOwner(user, version, catalogNodes);
  }
  return false;
}

export function canReturnForRevision(user: User, version: MaterialVersion, catalogNodes: CatalogNode[]) {
  if (version.status !== "На согласовании") return false;
  const isAdmin = user.roles.includes("Администратор");
  if (isAdmin) return true;
  const step = getApprovalStep(version);
  if (step === "material_owner") {
    return version.passport.ownerId === user.id || version.passport.deputyId === user.id;
  }
  if (step === "section_owner") {
    return isSectionOwner(user, version, catalogNodes);
  }
  return false;
}

export function validatePassport(passport: MaterialVersion["passport"]) {
  const missing: string[] = [];
  if (!passport.title?.trim()) missing.push("Название");
  if (!passport.sectionId) missing.push("Раздел/подраздел");
  if (!passport.criticality) missing.push("Критичность");
  if (!passport.legalEntity) missing.push("Юридическое лицо");
  if (!passport.ownerId) missing.push("Владелец");
  if (!passport.nextReviewAt) missing.push("Следующий пересмотр");
  if (!passport.tags || passport.tags.length === 0) missing.push("Теги");
  return missing;
}

export function computeKpis(materials: MaterialVersion[], users: User[]) {
  const active = materials.filter((m) => m.status !== "Архив");
  const overdue = active.filter(isOverdue);
  const withoutOwner = active.filter((m) => !m.passport.ownerId);
  const withoutDeputy = active.filter((m) => !m.passport.deputyId);

  const byCriticality = active.reduce<Record<string, number>>((acc, m) => {
    acc[m.passport.criticality] = (acc[m.passport.criticality] || 0) + 1;
    return acc;
  }, {});

  const reviewLoad = active.reduce<Record<string, number>>((acc, m) => {
    const owner = m.passport.ownerId || "—";
    acc[owner] = (acc[owner] || 0) + 1;
    return acc;
  }, {});

  const owners = Object.entries(reviewLoad)
    .map(([ownerId, count]) => ({
      ownerId,
      ownerName: users.find((u) => u.id === ownerId)?.displayName || "—",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalActive: active.length,
    overdueCount: overdue.length,
    overdueShare: active.length ? overdue.length / active.length : 0,
    withoutOwnerCount: withoutOwner.length,
    withoutDeputyCount: withoutDeputy.length,
    byCriticality,
    owners,
  };
}

export function searchMaterials(
  materials: MaterialVersion[],
  q: string,
) {
  const query = q.trim().toLowerCase();
  if (!query) return materials;
  return materials.filter((m) => {
    const p = m.passport;
    const hay = [
      p.title,
      p.purpose || "",
      p.tags.join(" "),
      p.tagGroups.map((g) => g.group + " " + g.tags.join(" ")).join(" "),
      m.content.kind === "file" ? (m.content.file?.extractedText || "") : "",
      m.content.kind === "page" ? (m.content.page?.html?.replace(/<[^>]*>/g, " ") || "") : "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  });
}

export function seedEmail(
  logs: NotificationLog[],
  payload: Omit<NotificationLog, "id" | "at" | "status">,
): NotificationLog {
  const id = `n-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    at: new Date().toISOString(),
    status: "LOGGED",
    ...payload,
  };
}

export function createRfc(
  rfcs: RFC[],
  input: { materialId: string; createdBy: string; type: RFC["type"]; title: string; description: string; assignedTo: string },
): RFC {
  return {
    id: `rfc-${rfcs.length + 1}`,
    materialId: input.materialId,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    type: input.type,
    title: input.title,
    description: input.description,
    status: "Новый",
    assignedTo: input.assignedTo,
    sla: {},
    comments: [],
  };
}
