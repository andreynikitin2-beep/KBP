import React, { createContext, useContext, useMemo, useState } from "react";
import {
  notificationLogSeed,
  demoUsers,
  materials as seedMaterials,
  rfcs as seedRfcs,
  policySeed,
  visibilityGroups as seedGroups,
  catalog as seedCatalog,
  emailTemplatesSeed,
  emailConfigSeed,
} from "./mockData";
import type { CatalogNode, Criticality, EmailConfig, EmailTemplate, MaterialVersion, NotificationLog, RFC, Role, User, UserSource, VisibilityGroup } from "./mockData";
import { canApproveAndPublish, canConfirmActuality, canPublishDirectly, canReturnForRevision, canSubmitForApproval, canViewMaterial, isOverdue, seedEmail, validatePassport } from "./kbLogic";

type ADSyncLogEntry = {
  at: string;
  status: "success" | "error";
  usersTotal: number;
  usersUpdated: number;
  usersDeactivated: number;
  message: string;
};

export type ReviewPeriod = {
  criticality: Criticality;
  days: number;
  remindBeforeDays: number[];
  escalationAfterDays: number[];
};

export type RbacDefaults = {
  canPublish: string[];
  canApprove: string[];
  canEditDraft: string[];
  canManagePolicies: string[];
  canViewAudit: string[];
};

export type PolicyConfig = {
  reviewPeriods: ReviewPeriod[];
  rbacDefaults: RbacDefaults;
  adIntegration: typeof policySeed.adIntegration;
};

type Store = {
  me: User;
  setMeId: (id: string) => void;

  users: User[];
  materials: MaterialVersion[];
  visibleMaterials: MaterialVersion[];
  setMaterials: React.Dispatch<React.SetStateAction<MaterialVersion[]>>;

  visibilityGroups: VisibilityGroup[];

  rfcs: RFC[];
  setRfcs: React.Dispatch<React.SetStateAction<RFC[]>>;

  notifications: NotificationLog[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationLog[]>>;

  policy: PolicyConfig;
  updateReviewPeriod: (criticality: Criticality, data: Partial<Omit<ReviewPeriod, "criticality">>) => { ok: boolean; message?: string };
  updateRbacDefaults: (key: keyof RbacDefaults, roles: string[]) => { ok: boolean; message?: string };

  confirmActuality: (versionId: string) => { ok: boolean; message?: string };
  submitForApproval: (versionId: string) => { ok: boolean; message?: string };
  publishDirect: (versionId: string) => { ok: boolean; message?: string };
  approveAndPublish: (versionId: string) => { ok: boolean; message?: string };
  returnForRevision: (versionId: string, comment: string) => { ok: boolean; message?: string };
  autoDailyCheck: () => { transitioned: string[]; emails: NotificationLog[] };

  updateAdConfig: (data: Partial<PolicyConfig["adIntegration"]>) => { ok: boolean; message?: string };
  syncADUsers: () => { ok: boolean; deactivated: string[]; message: string };
  createLocalUser: (data: { displayName: string; email: string; department: string; legalEntity: string; roles: User["roles"] }) => { ok: boolean; user?: User; message?: string };
  updateUser: (userId: string, data: { displayName?: string; email?: string; department?: string; legalEntity?: string; roles?: User["roles"] }) => { ok: boolean; message?: string };
  deactivateUser: (userId: string) => { ok: boolean; message?: string };
  reactivateUser: (userId: string) => { ok: boolean; message?: string };

  createGroup: (data: { title: string; memberIds: string[] }) => { ok: boolean; group?: VisibilityGroup; message?: string };
  updateGroup: (groupId: string, data: { title?: string; memberIds?: string[] }) => { ok: boolean; message?: string };
  deleteGroup: (groupId: string) => { ok: boolean; message?: string };

  subscriptions: string[];
  toggleSubscription: (materialId: string) => void;
  isSubscribed: (materialId: string) => boolean;

  createNewVersion: (materialId: string, majorBump?: boolean) => { ok: boolean; version?: MaterialVersion; message?: string };
  getAllVersions: (materialId: string) => MaterialVersion[];
  viewOldVersion: (versionId: string) => MaterialVersion | undefined;

  emailConfig: EmailConfig;
  emailTemplates: EmailTemplate[];
  updateEmailConfig: (data: Partial<EmailConfig>) => { ok: boolean; message?: string };
  updateEmailTemplate: (key: string, data: { subject?: string; body?: string }) => { ok: boolean; message?: string };

  catalogNodes: CatalogNode[];
  setSectionOwners: (sectionId: string, ownerIds: string[]) => { ok: boolean; message?: string };
  addSubsection: (parentId: string, title: string) => { ok: boolean; node?: CatalogNode; message?: string };
  renameSubsection: (nodeId: string, title: string) => { ok: boolean; message?: string };
  deleteSubsection: (nodeId: string) => { ok: boolean; message?: string };
  updateCatalogNode: (nodeId: string, updates: Partial<CatalogNode>) => { ok: boolean };
};

const Ctx = createContext<Store | null>(null);

function computeNextReview(
  criticality: MaterialVersion["passport"]["criticality"],
  lastReviewedAtIso: string,
  policy: typeof policySeed,
) {
  const row = policy.reviewPeriods.find((r) => r.criticality === criticality);
  const days = row?.days ?? 180;
  const d = new Date(lastReviewedAtIso);
  d.setDate(d.getDate() + days);
  return { next: d.toISOString(), periodDays: days };
}

export function KBStoreProvider({ children }: { children: React.ReactNode }) {
  const [meId, setMeId] = useState(demoUsers[0].id);
  const [users, setUsers] = useState<User[]>(demoUsers);
  const [materials, setMaterials] = useState<MaterialVersion[]>(seedMaterials);
  const [rfcs, setRfcs] = useState<RFC[]>(seedRfcs);
  const [notifications, setNotifications] = useState<NotificationLog[]>(notificationLogSeed);
  const [catalogNodes, setCatalogNodes] = useState<CatalogNode[]>(seedCatalog);
  const [policy, setPolicy] = useState<PolicyConfig>(() => policySeed as PolicyConfig);
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(emailConfigSeed);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(emailTemplatesSeed);
  const [groups, setGroups] = useState<VisibilityGroup[]>(seedGroups);
  const [subscriptionMap, setSubscriptionMap] = useState<Record<string, string[]>>({});

  const [effectiveVisGroupMap, setEffectiveVisGroupMap] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const m of seedMaterials) {
      if (m.status === "Опубликовано" || m.status === "На пересмотре") {
        map[m.materialId] = m.passport.visibilityGroupIds;
      }
    }
    return map;
  });

  const me = useMemo(() => users.find((u) => u.id === meId)!, [users, meId]);
  const mySubscriptions = useMemo(() => subscriptionMap[meId] || [], [subscriptionMap, meId]);

  const cleanupSubscriptionsOnGroupChange = (materialId: string, newGroupIds: string[]) => {
    const relevantGroups = newGroupIds.map(gId => groups.find((g) => g.id === gId)).filter(Boolean);
    if (relevantGroups.some(g => g!.isSystem)) return;

    setSubscriptionMap((prev) => {
      const next = { ...prev };
      for (const [userId, subs] of Object.entries(next)) {
        if (!subs.includes(materialId)) continue;
        const user = users.find((u) => u.id === userId);
        if (!user) continue;
        if (user.roles.includes("Администратор")) continue;
        const hasAccess = relevantGroups.some(g => g!.memberIds.includes(userId));
        if (!hasAccess) {
          next[userId] = subs.filter((id) => id !== materialId);
        }
      }
      return next;
    });
  };

  const notifySubscribers = (version: MaterialVersion, newGroupIds: string[]) => {
    const relevantGroups = newGroupIds.map(gId => groups.find((g) => g.id === gId)).filter(Boolean);
    const anySystem = relevantGroups.some(g => g!.isSystem);
    const allSubs = Object.entries(subscriptionMap);
    for (const [userId, subs] of allSubs) {
      if (!subs.includes(version.materialId)) continue;
      const user = users.find((u) => u.id === userId);
      if (!user) continue;
      const hasAccess = anySystem || user.roles.includes("Администратор") || relevantGroups.some(g => g!.memberIds.includes(userId));
      if (hasAccess) {
        const email = seedEmail(notifications, {
          to: user.email,
          subject: `Новая версия: ${version.passport.title} (${version.version})`,
          template: "new_version",
          related: { materialId: version.materialId, versionId: version.id },
        });
        setNotifications((p) => [email, ...p]);
      }
    }
  };

  const store = useMemo<Store>(() => {
    const latestByMaterial = new Map<string, MaterialVersion>();
    for (const m of materials) {
      const existing = latestByMaterial.get(m.materialId);
      if (!existing) {
        latestByMaterial.set(m.materialId, m);
      } else {
        const existingIsArchived = existing.status === "Архив";
        const mIsArchived = m.status === "Архив";
        if (existingIsArchived && !mIsArchived) {
          latestByMaterial.set(m.materialId, m);
        } else if (existingIsArchived === mIsArchived && new Date(m.createdAt) > new Date(existing.createdAt)) {
          latestByMaterial.set(m.materialId, m);
        }
      }
    }
    const visibleMaterials = Array.from(latestByMaterial.values()).filter((m) =>
      canViewMaterial(me, m, groups, effectiveVisGroupMap[m.materialId]),
    );

    return {
      me,
      setMeId,
      users,
      materials,
      visibleMaterials,
      setMaterials,
      visibilityGroups: groups,
      rfcs,
      setRfcs,
      notifications,
      setNotifications,
      policy,
      catalogNodes,

      updateReviewPeriod: (criticality: Criticality, data: Partial<Omit<ReviewPeriod, "criticality">>) => {
        setPolicy((prev) => ({
          ...prev,
          reviewPeriods: prev.reviewPeriods.map((p) =>
            p.criticality === criticality ? { ...p, ...data } : p,
          ),
        }));
        return { ok: true };
      },

      updateRbacDefaults: (key: keyof RbacDefaults, roles: string[]) => {
        if (roles.length === 0) return { ok: false, message: "Нужно выбрать хотя бы одну роль" };
        setPolicy((prev) => ({
          ...prev,
          rbacDefaults: { ...prev.rbacDefaults, [key]: roles },
        }));
        return { ok: true };
      },

      confirmActuality: (versionId: string) => {
        const version = materials.find((m) => m.id === versionId);
        if (!version) return { ok: false, message: "Версия не найдена" };
        if (!canConfirmActuality(me, version)) return { ok: false, message: "Недостаточно прав" };

        const lastReviewedAt = new Date().toISOString();
        const { next, periodDays } = computeNextReview(version.passport.criticality, lastReviewedAt, policySeed);

        setMaterials((prev) =>
          prev.map((m) =>
            m.id === versionId
              ? {
                  ...m,
                  status:
                    m.status === "На пересмотре" ? ("Опубликовано" as MaterialVersion["status"]) : m.status,
                  passport: {
                    ...m.passport,
                    lastReviewedAt,
                    nextReviewAt: next,
                    reviewPeriodDays: periodDays,
                  },
                }
              : m,
          ),
        );

        const email = seedEmail(notifications, {
          to: me.email,
          subject: `Актуальность подтверждена: ${version.passport.title}`,
          template: "auto_transition",
          related: { materialId: version.materialId, versionId: version.id },
        });
        setNotifications((p) => [email, ...p]);

        return { ok: true };
      },

      submitForApproval: (versionId: string) => {
        const version = materials.find((m) => m.id === versionId);
        if (!version) return { ok: false, message: "Версия не найдена" };
        if (!canSubmitForApproval(me, version)) return { ok: false, message: "Недостаточно прав для отправки на согласование" };

        setMaterials((prev) =>
          prev.map((m) =>
            m.id === versionId ? { ...m, status: "На согласовании" as MaterialVersion["status"] } : m,
          ),
        );

        const ownerEmail = users.find((u) => u.id === version.passport.ownerId)?.email || "unknown@demo.local";
        const email = seedEmail(notifications, {
          to: ownerEmail,
          subject: `Запрос на согласование: ${version.passport.title}`,
          template: "new_version",
          related: { materialId: version.materialId, versionId: version.id },
        });
        setNotifications((p) => [email, ...p]);

        return { ok: true };
      },

      publishDirect: (versionId: string) => {
        const version = materials.find((m) => m.id === versionId);
        if (!version) return { ok: false, message: "Версия не найдена" };
        if (!canPublishDirectly(me, version)) return { ok: false, message: "Только владелец/заместитель может публиковать без согласования" };

        const lastReviewedAt = new Date().toISOString();
        const { next, periodDays } = computeNextReview(version.passport.criticality, lastReviewedAt, policySeed);

        setMaterials((prev) =>
          prev.map((m) => {
            if (m.id === versionId) {
              return {
                ...m,
                status: "Опубликовано" as MaterialVersion["status"],
                passport: { ...m.passport, lastReviewedAt, nextReviewAt: next, reviewPeriodDays: periodDays },
              };
            }
            if (m.materialId === version.materialId && m.id !== versionId && (m.status === "Опубликовано" || m.status === "На пересмотре")) {
              return { ...m, status: "Архив" as MaterialVersion["status"] };
            }
            return m;
          }),
        );

        setEffectiveVisGroupMap((prev) => ({ ...prev, [version.materialId]: version.passport.visibilityGroupIds }));
        cleanupSubscriptionsOnGroupChange(version.materialId, version.passport.visibilityGroupIds);

        const email = seedEmail(notifications, {
          to: me.email,
          subject: `Опубликовано напрямую: ${version.passport.title}`,
          template: "new_version",
          related: { materialId: version.materialId, versionId: version.id },
        });
        setNotifications((p) => [email, ...p]);

        notifySubscribers(version, version.passport.visibilityGroupIds);

        return { ok: true };
      },

      approveAndPublish: (versionId: string) => {
        const version = materials.find((m) => m.id === versionId);
        if (!version) return { ok: false, message: "Версия не найдена" };
        if (!canApproveAndPublish(me, version)) return { ok: false, message: "Недостаточно прав для согласования" };

        const lastReviewedAt = new Date().toISOString();
        const { next, periodDays } = computeNextReview(version.passport.criticality, lastReviewedAt, policySeed);

        setMaterials((prev) =>
          prev.map((m) => {
            if (m.id === versionId) {
              return {
                ...m,
                status: "Опубликовано" as MaterialVersion["status"],
                changelog: (m.changelog ? m.changelog + "\n" : "") + `[APPROVED BY ${me.displayName}]`,
                passport: { ...m.passport, lastReviewedAt, nextReviewAt: next, reviewPeriodDays: periodDays },
              };
            }
            if (m.materialId === version.materialId && m.id !== versionId && (m.status === "Опубликовано" || m.status === "На пересмотре")) {
              return { ...m, status: "Архив" as MaterialVersion["status"] };
            }
            return m;
          }),
        );

        setEffectiveVisGroupMap((prev) => ({ ...prev, [version.materialId]: version.passport.visibilityGroupIds }));
        cleanupSubscriptionsOnGroupChange(version.materialId, version.passport.visibilityGroupIds);

        const authorEmail = users.find((u) => u.id === version.createdBy)?.email || "unknown@demo.local";
        const email = seedEmail(notifications, {
          to: authorEmail,
          subject: `Согласовано и опубликовано: ${version.passport.title}`,
          template: "new_version",
          related: { materialId: version.materialId, versionId: version.id },
        });
        setNotifications((p) => [email, ...p]);

        notifySubscribers(version, version.passport.visibilityGroupIds);

        return { ok: true };
      },

      returnForRevision: (versionId: string, comment: string) => {
        const version = materials.find((m) => m.id === versionId);
        if (!version) return { ok: false, message: "Версия не найдена" };
        if (!canReturnForRevision(me, version)) return { ok: false, message: "Недостаточно прав" };
        if (!comment.trim()) return { ok: false, message: "Комментарий обязателен при возврате на доработку" };

        setMaterials((prev) =>
          prev.map((m) =>
            m.id === versionId
              ? {
                  ...m,
                  status: "Черновик" as MaterialVersion["status"],
                  changelog: (m.changelog ? m.changelog + "\n" : "") + `[RETURNED] ${me.displayName}: ${comment}`,
                }
              : m,
          ),
        );

        const authorEmail = users.find((u) => u.id === version.createdBy)?.email || "unknown@demo.local";
        const email = seedEmail(notifications, {
          to: authorEmail,
          subject: `Возвращено на доработку: ${version.passport.title}`,
          template: "auto_transition",
          related: { materialId: version.materialId, versionId: version.id },
        });
        setNotifications((p) => [email, ...p]);

        return { ok: true };
      },

      autoDailyCheck: () => {
        const transitioned: string[] = [];
        const emails: NotificationLog[] = [];

        const nextMaterials: MaterialVersion[] = materials.map((m) => {
          const overdue = isOverdue(m);
          if (!overdue) return m;
          if (m.status === "Опубликовано") {
            transitioned.push(m.id);
            emails.push(
              seedEmail(notifications, {
                to:
                  users.find((u) => u.id === (m.passport.ownerId || ""))?.email ||
                  "unknown@demo.local",
                subject: `Просрочка пересмотра: ${m.passport.title}`,
                template: "overdue",
                related: { materialId: m.materialId, versionId: m.id },
              }),
            );
            return { ...m, status: "На пересмотре" };
          }
          return m;
        });

        if (transitioned.length) setMaterials(nextMaterials);
        if (emails.length) setNotifications((p) => [...emails, ...p]);

        return { transitioned, emails };
      },

      updateAdConfig: (data) => {
        setPolicy((prev) => ({
          ...prev,
          adIntegration: { ...prev.adIntegration, ...data },
        }));
        return { ok: true };
      },

      syncADUsers: () => {
        const now = new Date().toISOString();
        const deactivated: string[] = [];
        const affectedMaterials: string[] = [];

        setUsers((prev) => prev.map((u) => {
          if (u.source !== "ad") return u;
          if (u.deactivatedAt) return u;
          return { ...u, lastSyncAt: now };
        }));

        const deactivatedUsers = users.filter((u) => u.source === "ad" && u.deactivatedAt);
        for (const du of deactivatedUsers) {
          deactivated.push(du.displayName);
          const owned = materials.filter(
            (m) =>
              (m.passport.ownerId === du.id || m.passport.deputyId === du.id) &&
              m.status === "Опубликовано",
          );
          for (const m of owned) {
            affectedMaterials.push(m.id);
          }
        }

        if (affectedMaterials.length) {
          setMaterials((prev) =>
            prev.map((m) =>
              affectedMaterials.includes(m.id)
                ? { ...m, status: "На пересмотре" as MaterialVersion["status"] }
                : m,
            ),
          );

          const adminEmail = users.find((u) => u.roles.includes("Администратор"))?.email || "admin@demo.local";
          const email = seedEmail(notifications, {
            to: adminEmail,
            subject: `AD-синхронизация: ${deactivated.length} пользователь(ей) деактивировано, ${affectedMaterials.length} материал(ов) на пересмотре`,
            template: "auto_transition",
            related: {},
          });
          setNotifications((p) => [email, ...p]);
        }

        return {
          ok: true,
          deactivated,
          message: deactivated.length
            ? `Синхронизация завершена. Деактивировано: ${deactivated.join(", ")}. Материалов на пересмотре: ${affectedMaterials.length}`
            : "Синхронизация завершена успешно. Изменений нет.",
        };
      },

      createLocalUser: (data) => {
        const id = `u-local-${Date.now()}`;
        const newUser: User = {
          id,
          displayName: data.displayName,
          email: data.email,
          roles: data.roles,
          legalEntity: data.legalEntity,
          department: data.department,
          isAvailable: true,
          source: "local",
        };
        setUsers((prev) => [...prev, newUser]);
        return { ok: true, user: newUser };
      },

      deactivateUser: (userId: string) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return { ok: false, message: "Пользователь не найден" };
        if (user.deactivatedAt) return { ok: false, message: "Уже деактивирован" };

        const now = new Date().toISOString();
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, deactivatedAt: now, isAvailable: false } : u,
          ),
        );

        const owned = materials.filter(
          (m) =>
            (m.passport.ownerId === userId || m.passport.deputyId === userId) &&
            m.status === "Опубликовано",
        );
        if (owned.length) {
          setMaterials((prev) =>
            prev.map((m) =>
              owned.some((o) => o.id === m.id)
                ? { ...m, status: "На пересмотре" as MaterialVersion["status"] }
                : m,
            ),
          );

          const adminEmail = users.find((u) => u.roles.includes("Администратор"))?.email || "admin@demo.local";
          const email = seedEmail(notifications, {
            to: adminEmail,
            subject: `Деактивация ${user.displayName}: ${owned.length} материал(ов) переведено на пересмотр`,
            template: "auto_transition",
            related: {},
          });
          setNotifications((p) => [email, ...p]);
        }

        return { ok: true };
      },

      reactivateUser: (userId: string) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return { ok: false, message: "Пользователь не найден" };
        if (!user.deactivatedAt) return { ok: false, message: "Не деактивирован" };

        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, deactivatedAt: undefined, isAvailable: true } : u,
          ),
        );

        return { ok: true };
      },

      updateUser: (userId: string, data: { displayName?: string; email?: string; department?: string; legalEntity?: string; roles?: User["roles"] }) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return { ok: false, message: "Пользователь не найден" };

        setUsers((prev) =>
          prev.map((u) => {
            if (u.id !== userId) return u;
            const updated = { ...u };
            if (data.displayName !== undefined) updated.displayName = data.displayName;
            if (data.email !== undefined) updated.email = data.email;
            if (data.department !== undefined) updated.department = data.department;
            if (data.legalEntity !== undefined) updated.legalEntity = data.legalEntity;
            if (data.roles !== undefined) {
              const roles = data.roles.length > 0 ? data.roles : ["Читатель" as const];
              updated.roles = roles.includes("Читатель") ? roles : ["Читатель" as const, ...roles];
            }
            return updated;
          }),
        );
        return { ok: true };
      },

      createGroup: (data: { title: string; memberIds: string[] }) => {
        if (!data.title.trim()) return { ok: false, message: "Название не может быть пустым" };
        const id = `g-${Date.now()}`;
        const group: VisibilityGroup = { id, title: data.title.trim(), isSystem: false, memberIds: data.memberIds };
        setGroups((prev) => [...prev, group]);
        return { ok: true, group };
      },

      updateGroup: (groupId: string, data: { title?: string; memberIds?: string[] }) => {
        const group = groups.find((g) => g.id === groupId);
        if (!group) return { ok: false, message: "Группа не найдена" };
        if (group.isSystem) return { ok: false, message: "Системную группу нельзя изменить" };

        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== groupId) return g;
            return {
              ...g,
              title: data.title !== undefined ? data.title.trim() : g.title,
              memberIds: data.memberIds !== undefined ? data.memberIds : g.memberIds,
            };
          }),
        );
        return { ok: true };
      },

      deleteGroup: (groupId: string) => {
        const group = groups.find((g) => g.id === groupId);
        if (!group) return { ok: false, message: "Группа не найдена" };
        if (group.isSystem) return { ok: false, message: "Системную группу нельзя удалить" };

        setGroups((prev) => prev.filter((g) => g.id !== groupId));
        return { ok: true };
      },

      subscriptions: mySubscriptions,
      toggleSubscription: (materialId: string) => {
        setSubscriptionMap((prev) => {
          const current = prev[meId] || [];
          const next = current.includes(materialId)
            ? current.filter((id) => id !== materialId)
            : [...current, materialId];
          return { ...prev, [meId]: next };
        });
      },
      isSubscribed: (materialId: string) => mySubscriptions.includes(materialId),

      createNewVersion: (materialId: string, majorBump?: boolean) => {
        const allVersions = materials
          .filter((m) => m.materialId === materialId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const current = allVersions[0];
        if (!current) return { ok: false, message: "Материал не найден" };

        const hasDraft = allVersions.some((v) => v.status === "Черновик" || v.status === "На согласовании");
        if (hasDraft) return { ok: false, message: "Уже существует черновик или версия на согласовании. Завершите её перед созданием новой." };

        const parts = current.version.split(".");
        const major = parseInt(parts[0], 10) || 1;
        const minor = parseInt(parts[1], 10) || 0;
        const newVersionStr = majorBump ? `${major + 1}.0` : `${major}.${minor + 1}`;
        const newId = `v-${materialId.replace("m-", "")}-${Date.now()}`;

        const newVersion: MaterialVersion = {
          ...current,
          id: newId,
          version: newVersionStr,
          createdAt: new Date().toISOString(),
          createdBy: meId,
          changelog: "",
          status: "Черновик" as MaterialVersion["status"],
          stats: { views: 0, helpfulYes: 0, helpfulNo: 0 },
          auditViews: [],
        };

        setMaterials((prev) => {
          const updated = prev.map((m) =>
            m.id === current.id && m.status !== "Архив"
              ? { ...m, status: "Архив" as MaterialVersion["status"] }
              : m,
          );
          return [...updated, newVersion];
        });

        return { ok: true, version: newVersion };
      },

      getAllVersions: (materialId: string) => {
        return materials
          .filter((m) => m.materialId === materialId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },

      viewOldVersion: (versionId: string) => {
        return materials.find((m) => m.id === versionId);
      },

      setSectionOwners: (sectionId: string, ownerIds: string[]) => {
        const node = catalogNodes.find((n) => n.id === sectionId);
        if (!node) return { ok: false, message: "Раздел не найден" };
        if (node.type !== "section") return { ok: false, message: "Владельцев можно назначать только разделам" };

        setCatalogNodes((prev) =>
          prev.map((n) => (n.id === sectionId ? { ...n, ownerIds } : n)),
        );
        return { ok: true };
      },

      addSubsection: (parentId: string, title: string) => {
        const parent = catalogNodes.find((n) => n.id === parentId && n.type === "section");
        if (!parent) return { ok: false, message: "Родительский раздел не найден" };
        if (!title.trim()) return { ok: false, message: "Название не может быть пустым" };

        const id = `sub-${Date.now()}`;
        const node: CatalogNode = { id, title: title.trim(), type: "subsection", parentId };
        setCatalogNodes((prev) => [...prev, node]);
        return { ok: true, node };
      },

      renameSubsection: (nodeId: string, title: string) => {
        const node = catalogNodes.find((n) => n.id === nodeId);
        if (!node) return { ok: false, message: "Подраздел не найден" };
        if (!title.trim()) return { ok: false, message: "Название не может быть пустым" };

        setCatalogNodes((prev) =>
          prev.map((n) => (n.id === nodeId ? { ...n, title: title.trim() } : n)),
        );
        return { ok: true };
      },

      deleteSubsection: (nodeId: string) => {
        const node = catalogNodes.find((n) => n.id === nodeId);
        if (!node) return { ok: false, message: "Подраздел не найден" };
        if (node.type !== "subsection") return { ok: false, message: "Можно удалить только подраздел" };

        const hasMaterials = materials.some((m) => m.passport.sectionId === nodeId);
        if (hasMaterials) return { ok: false, message: "Нельзя удалить подраздел с материалами" };

        setCatalogNodes((prev) => prev.filter((n) => n.id !== nodeId));
        return { ok: true };
      },

      emailConfig,
      emailTemplates,

      updateEmailConfig: (data: Partial<EmailConfig>) => {
        setEmailConfig((prev) => ({ ...prev, ...data }));
        return { ok: true };
      },

      updateEmailTemplate: (key: string, data: { subject?: string; body?: string }) => {
        const tpl = emailTemplates.find((t) => t.key === key);
        if (!tpl) return { ok: false, message: "Шаблон не найден" };
        setEmailTemplates((prev) =>
          prev.map((t) => (t.key === key ? { ...t, ...data } : t)),
        );
        return { ok: true };
      },

      updateCatalogNode: (nodeId: string, updates: Partial<CatalogNode>) => {
        setCatalogNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
        return { ok: true };
      },
    };
  }, [catalogNodes, effectiveVisGroupMap, emailConfig, emailTemplates, groups, materials, me, meId, mySubscriptions, notifications, policy, rfcs, users]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useKB() {
  const v = useContext(Ctx);
  if (!v) throw new Error("KBStoreProvider missing");
  return v;
}

export function usePassportValidation(passport: MaterialVersion["passport"]) {
  return useMemo(() => validatePassport(passport), [passport]);
}
