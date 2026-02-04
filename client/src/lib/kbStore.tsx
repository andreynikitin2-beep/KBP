import React, { createContext, useContext, useMemo, useState } from "react";
import {
  notificationLogSeed,
  demoUsers,
  materials as seedMaterials,
  rfcs as seedRfcs,
  policySeed,
} from "./mockData";
import type { MaterialVersion, NotificationLog, RFC, User } from "./mockData";
import { canConfirmActuality, isOverdue, seedEmail, validatePassport } from "./kbLogic";

type Store = {
  me: User;
  setMeId: (id: string) => void;

  materials: MaterialVersion[];
  setMaterials: React.Dispatch<React.SetStateAction<MaterialVersion[]>>;

  rfcs: RFC[];
  setRfcs: React.Dispatch<React.SetStateAction<RFC[]>>;

  notifications: NotificationLog[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationLog[]>>;

  policy: typeof policySeed;

  confirmActuality: (versionId: string) => { ok: boolean; message?: string };
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
    return {
      me,
      setMeId,
      materials,
      setMaterials,
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
