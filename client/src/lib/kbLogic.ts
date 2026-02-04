import type { CatalogNode, MaterialVersion, NotificationLog, RFC, Role, User } from "./mockData";

export function hasAnyRole(user: User, required?: Role[]) {
  if (!required || required.length === 0) return true;
  return required.some((r) => user.roles.includes(r));
}

export function withinScope(user: User, node: CatalogNode) {
  const leOk = !node.allowedLegalEntities || node.allowedLegalEntities.includes(user.legalEntity);
  const brOk = !node.allowedBranches || node.allowedBranches.includes(user.branch);
  const rlOk = hasAnyRole(user, node.allowedRoles);
  return leOk && brOk && rlOk;
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
  const moderatorOk = user.roles.includes("Модератор");
  return ownerOk || deputyOk || moderatorOk;
}

export function canViewAudit(user: User) {
  return user.roles.includes("Аудитор") || user.roles.includes("Модератор") || user.roles.includes("Админ безопасности");
}

export function canEditPublished(user: User) {
  return user.roles.includes("Модератор") || user.roles.includes("Владелец") || user.roles.includes("Заместитель");
}

export function validatePassport(passport: MaterialVersion["passport"]) {
  const missing: string[] = [];
  if (!passport.title?.trim()) missing.push("Название");
  if (!passport.sectionId) missing.push("Раздел/подраздел");
  if (!passport.criticality) missing.push("Критичность");
  if (!passport.legalEntity) missing.push("Юр.лицо");
  if (!passport.branch) missing.push("Филиал");
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
      m.content.kind === "page" ? (m.content.page?.blocks.map((b) => b.text).join(" ") || "") : "",
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
