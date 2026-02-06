import React, { createContext, useContext, useMemo, useState } from "react";
import {
  notificationLogSeed,
  demoUsers,
  materials as seedMaterials,
  rfcs as seedRfcs,
  policySeed,
  visibilityGroups as seedGroups,
} from "./mockData";
import type { MaterialVersion, NotificationLog, RFC, User, VisibilityGroup } from "./mockData";
import { canApproveAndPublish, canConfirmActuality, canPublishDirectly, canReturnForRevision, canSubmitForApproval, canViewMaterial, isOverdue, seedEmail, validatePassport } from "./kbLogic";

type Store = {
  me: User;
  setMeId: (id: string) => void;

  materials: MaterialVersion[];
  visibleMaterials: MaterialVersion[];
  setMaterials: React.Dispatch<React.SetStateAction<MaterialVersion[]>>;

  visibilityGroups: VisibilityGroup[];

  rfcs: RFC[];
  setRfcs: React.Dispatch<React.SetStateAction<RFC[]>>;

  notifications: NotificationLog[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationLog[]>>;

  policy: typeof policySeed;

  confirmActuality: (versionId: string) => { ok: boolean; message?: string };
  submitForApproval: (versionId: string) => { ok: boolean; message?: string };
  publishDirect: (versionId: string) => { ok: boolean; message?: string };
  approveAndPublish: (versionId: string) => { ok: boolean; message?: string };
  returnForRevision: (versionId: string, comment: string) => { ok: boolean; message?: string };
  autoDailyCheck: () => { transitioned: string[]; emails: NotificationLog[] };
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
  const [materials, setMaterials] = useState<MaterialVersion[]>(seedMaterials);
  const [rfcs, setRfcs] = useState<RFC[]>(seedRfcs);
  const [notifications, setNotifications] = useState<NotificationLog[]>(notificationLogSeed);

  const me = useMemo(() => demoUsers.find((u) => u.id === meId)!, [meId]);

  const store = useMemo<Store>(() => {
    const visibleMaterials = materials.filter((m) => canViewMaterial(me, m, seedGroups));

    return {
      me,
      setMeId,
      materials,
      visibleMaterials,
      setMaterials,
      visibilityGroups: seedGroups,
      rfcs,
      setRfcs,
      notifications,
      setNotifications,
      policy: policySeed,

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

        const ownerEmail = demoUsers.find((u) => u.id === version.passport.ownerId)?.email || "unknown@demo.local";
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

        const authorEmail = demoUsers.find((u) => u.id === version.createdBy)?.email || "unknown@demo.local";
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

        const authorEmail = demoUsers.find((u) => u.id === version.createdBy)?.email || "unknown@demo.local";
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
                  demoUsers.find((u) => u.id === (m.passport.ownerId || ""))?.email ||
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
    };
  }, [materials, me, notifications, rfcs]);

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
