import React, { createContext, useContext, useMemo, useState } from "react";
import {
  notificationLogSeed,
  demoUsers,
  materials as seedMaterials,
  rfcs as seedRfcs,
  policySeed,
  visibilityGroups as seedGroups,
  catalog as seedCatalog,
} from "./mockData";
import type { CatalogNode, Criticality, MaterialVersion, NotificationLog, RFC, Role, User, UserSource, VisibilityGroup } from "./mockData";
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

  syncADUsers: () => { ok: boolean; deactivated: string[]; message: string };
  createLocalUser: (data: { displayName: string; email: string; department: string; legalEntity: string; roles: User["roles"] }) => { ok: boolean; user?: User; message?: string };
  deactivateUser: (userId: string) => { ok: boolean; message?: string };
  reactivateUser: (userId: string) => { ok: boolean; message?: string };

  catalogNodes: CatalogNode[];
  setSectionOwners: (sectionId: string, ownerIds: string[]) => { ok: boolean; message?: string };
  addSubsection: (parentId: string, title: string) => { ok: boolean; node?: CatalogNode; message?: string };
  renameSubsection: (nodeId: string, title: string) => { ok: boolean; message?: string };
  deleteSubsection: (nodeId: string) => { ok: boolean; message?: string };
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

  const me = useMemo(() => users.find((u) => u.id === meId)!, [users, meId]);

  const store = useMemo<Store>(() => {
    const visibleMaterials = materials.filter((m) => canViewMaterial(me, m, seedGroups));

    return {
      me,
      setMeId,
      users,
      materials,
      visibleMaterials,
      setMaterials,
      visibilityGroups: seedGroups,
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
          prev.map((m) =>
            m.id === versionId
              ? {
                  ...m,
                  status: "Опубликовано" as MaterialVersion["status"],
                  passport: { ...m.passport, lastReviewedAt, nextReviewAt: next, reviewPeriodDays: periodDays },
                }
              : m,
          ),
        );

        const email = seedEmail(notifications, {
          to: me.email,
          subject: `Опубликовано напрямую: ${version.passport.title}`,
          template: "new_version",
          related: { materialId: version.materialId, versionId: version.id },
        });
        setNotifications((p) => [email, ...p]);

        return { ok: true };
      },

      approveAndPublish: (versionId: string) => {
        const version = materials.find((m) => m.id === versionId);
        if (!version) return { ok: false, message: "Версия не найдена" };
        if (!canApproveAndPublish(me, version)) return { ok: false, message: "Недостаточно прав для согласования" };

        const lastReviewedAt = new Date().toISOString();
        const { next, periodDays } = computeNextReview(version.passport.criticality, lastReviewedAt, policySeed);

        setMaterials((prev) =>
          prev.map((m) =>
            m.id === versionId
              ? {
                  ...m,
                  status: "Опубликовано" as MaterialVersion["status"],
                  changelog: (m.changelog ? m.changelog + "\n" : "") + `[APPROVED BY ${me.displayName}]`,
                  passport: { ...m.passport, lastReviewedAt, nextReviewAt: next, reviewPeriodDays: periodDays },
                }
              : m,
          ),
        );

        const authorEmail = users.find((u) => u.id === version.createdBy)?.email || "unknown@demo.local";
        const email = seedEmail(notifications, {
          to: authorEmail,
          subject: `Согласовано и опубликовано: ${version.passport.title}`,
          template: "new_version",
          related: { materialId: version.materialId, versionId: version.id },
        });
        setNotifications((p) => [email, ...p]);

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
    };
  }, [catalogNodes, materials, me, notifications, policy, rfcs, users]);

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
