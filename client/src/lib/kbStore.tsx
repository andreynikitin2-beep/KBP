import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CatalogNode, Criticality, EmailConfig, EmailTemplate, HelpfulRating, MaterialVersion, NewHireAssignment, NewHireProfile, NewHireStatus, NotificationLog, RFC, Role, User, UserSource, VisibilityGroup } from "./mockData";
import { canApproveAndPublish, canConfirmActuality, canCreateNewVersion, canPublishDirectly, canReturnForRevision, canSubmitForApproval, canViewMaterial, getApprovalStep, getSectionOwnerIds, getMoscowDateString, isOverdue, seedEmail, validatePassport } from "./kbLogic";
import { api } from "./api";

const VIEW_DEDUP_MINUTES = 30;

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

export type ADIntegration = {
  enabled: boolean;
  mode: "demo" | "SAML" | "OIDC" | "LDAP";
  ssoUrl: string;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
  syncFrequencyMinutes: number;
  lastSyncAt: string | null;
  syncStatus: "success" | "error" | "in_progress" | "never";
  syncedUsersCount: number;
  deactivatedCount: number;
  mapping: {
    roles: string | null;
    department: string;
    legalEntity: string;
    displayName: string;
    email: string;
  };
  syncLog: ADSyncLogEntry[];
  _id?: string;
};

export type PolicyConfig = {
  reviewPeriods: (ReviewPeriod & { _id?: string })[];
  rbacDefaults: RbacDefaults & { [key: `_id_${string}`]: string };
  adIntegration: ADIntegration;
};

type Store = {
  me: User;
  isAuthenticated: boolean;
  setMeId: (id: string) => void;
  logout: () => void;

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
  adminForcePublish: (versionId: string, comment: string) => { ok: boolean; message?: string };
  autoDailyCheck: () => { transitioned: string[]; emails: NotificationLog[] };

  updateAdConfig: (data: Partial<PolicyConfig["adIntegration"]>) => { ok: boolean; message?: string };
  syncADUsers: () => { ok: boolean; deactivated: string[]; message: string };
  createLocalUser: (data: { displayName: string; email: string; department: string; legalEntity: string; roles: User["roles"]; password?: string }) => { ok: boolean; user?: User; message?: string };
  updateUser: (userId: string, data: { displayName?: string; email?: string; department?: string; legalEntity?: string; roles?: User["roles"] }) => { ok: boolean; message?: string };
  deactivateUser: (userId: string) => { ok: boolean; message?: string };
  reactivateUser: (userId: string) => { ok: boolean; message?: string };

  createGroup: (data: { title: string; memberIds: string[] }) => { ok: boolean; group?: VisibilityGroup; message?: string };
  updateGroup: (groupId: string, data: { title?: string; memberIds?: string[] }) => { ok: boolean; message?: string };
  deleteGroup: (groupId: string) => { ok: boolean; message?: string };

  ratings: HelpfulRating[];
  rateMaterial: (materialId: string, value: "helpful" | "not_helpful") => { ok: boolean; message?: string };
  canRateToday: (materialId: string) => boolean;
  getMaterialRatings: (materialId: string) => { helpful: number; notHelpful: number; total: number };

  recordView: (materialId: string) => void;
  recordDownload: (materialId: string) => void;
  recordPreview: (materialId: string) => void;
  viewDedupMinutes: number;

  subscriptions: string[];
  toggleSubscription: (materialId: string) => void;
  isSubscribed: (materialId: string) => boolean;

  createNewVersion: (materialId: string, majorBump?: boolean) => { ok: boolean; version?: MaterialVersion; message?: string };
  getAllVersions: (materialId: string) => MaterialVersion[];
  viewOldVersion: (versionId: string) => MaterialVersion | undefined;
  archiveMaterial: (materialId: string) => { ok: boolean; message?: string };
  restoreMaterial: (materialId: string) => { ok: boolean; message?: string };

  emailConfig: EmailConfig;
  emailTemplates: EmailTemplate[];
  updateEmailConfig: (data: Partial<EmailConfig>) => { ok: boolean; message?: string };
  updateEmailTemplate: (key: string, data: { subject?: string; body?: string }) => { ok: boolean; message?: string };

  catalogNodes: CatalogNode[];
  setSectionOwners: (sectionId: string, ownerIds: string[]) => { ok: boolean; message?: string };
  addSection: (title: string, sortOrder?: number) => { ok: boolean; node?: CatalogNode; message?: string };
  renameSection: (nodeId: string, title: string, sortOrder?: number) => { ok: boolean; message?: string };
  deleteSection: (nodeId: string) => { ok: boolean; message?: string };
  addSubsection: (parentId: string, title: string) => { ok: boolean; node?: CatalogNode; message?: string };
  renameSubsection: (nodeId: string, title: string) => { ok: boolean; message?: string };
  deleteSubsection: (nodeId: string) => { ok: boolean; message?: string };
  updateCatalogNode: (nodeId: string, updates: Partial<CatalogNode>) => { ok: boolean };

  newHiresEnabled: boolean;
  setNewHiresEnabled: (enabled: boolean) => void;
  newHireProfiles: NewHireProfile[];
  newHireAssignments: NewHireAssignment[];
  detectNewHires: () => Promise<{ added: number }>;
  assignMaterialsToNewHire: (userId: string) => Promise<{ assigned: number }>;
  assignMaterialsToAllNewHires: () => Promise<{ assigned: number }>;
  updateNewHireStatus: (profileId: string, status: NewHireStatus) => void;
  acknowledgeAssignment: (assignmentId: string, versionId: string) => void;
  getMyAssignments: () => NewHireAssignment[];
};

const Ctx = createContext<Store | null>(null);

const defaultEmailConfig: EmailConfig = {
  senderAddress: '', senderName: '', smtpHost: '', smtpPort: 587,
  smtpUser: '', smtpPassword: '', smtpUseTls: true, enabled: false,
};

const defaultAdIntegration: ADIntegration = {
  enabled: false,
  mode: "demo",
  ssoUrl: "",
  bindDn: "",
  bindPassword: "",
  baseDn: "",
  syncFrequencyMinutes: 60,
  lastSyncAt: null,
  syncStatus: "never",
  syncedUsersCount: 0,
  deactivatedCount: 0,
  mapping: {
    roles: null,
    department: "department",
    legalEntity: "company",
    displayName: "displayName",
    email: "mail",
  },
  syncLog: [],
};

function parseVersionNum(v: string): [number, number] {
  const parts = v.split(".");
  return [parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0];
}

function compareVersionDesc(a: string, b: string): number {
  const [am, an] = parseVersionNum(a);
  const [bm, bn] = parseVersionNum(b);
  if (bm !== am) return bm - am;
  return bn - an;
}

function computeNextReview(
  criticality: MaterialVersion["passport"]["criticality"],
  lastReviewedAtIso: string,
  policyData: PolicyConfig,
) {
  const row = policyData.reviewPeriods.find((r) => r.criticality === criticality);
  const days = row?.days ?? 180;
  const d = new Date(lastReviewedAtIso);
  d.setDate(d.getDate() + days);
  return { next: d.toISOString(), periodDays: days };
}

function persistNotification(notif: NotificationLog) {
  api.createNotification({
    to: notif.to,
    subject: notif.subject,
    template: notif.template,
    related: notif.related,
    status: notif.status,
  }).catch(console.error);
}

export function KBStoreProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [meId, setMeIdRaw] = useState(() => localStorage.getItem('kb_auth_user') || '');
  const [users, setUsers] = useState<User[]>([]);
  const [materials, setMaterials] = useState<MaterialVersion[]>([]);
  const [rfcs, setRfcs] = useState<RFC[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [catalogNodes, setCatalogNodes] = useState<CatalogNode[]>([]);
  const [policy, setPolicy] = useState<PolicyConfig>({
    reviewPeriods: [],
    rbacDefaults: {
      canPublish: [],
      canApprove: [],
      canEditDraft: [],
      canManagePolicies: [],
      canViewAudit: [],
    } as any,
    adIntegration: defaultAdIntegration,
  });
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(defaultEmailConfig);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [groups, setGroups] = useState<VisibilityGroup[]>([]);
  const [subscriptionMap, setSubscriptionMap] = useState<Record<string, string[]>>({});
  const [ratings, setRatings] = useState<HelpfulRating[]>([]);
  const [viewLog, setViewLog] = useState<Array<{ userId: string; materialId: string; at: number }>>([]);
  const [effectiveVisGroupMap, setEffectiveVisGroupMap] = useState<Record<string, string[]>>({});
  const [newHiresEnabled, setNewHiresEnabledRaw] = useState(false);
  const [newHireProfiles, setNewHireProfiles] = useState<NewHireProfile[]>([]);
  const [newHireAssignments, setNewHireAssignments] = useState<NewHireAssignment[]>([]);

  const setMeId = (id: string) => {
    setMeIdRaw(id);
    if (id) {
      localStorage.setItem('kb_auth_user', id);
      const now = new Date().toISOString();
      setUsers(prev => prev.map(u => u.id === id ? { ...u, lastLogin: now } : u));
      api.getUserSubscriptions(id).then(subs => {
        setSubscriptionMap(prev => ({ ...prev, [id]: subs }));
      }).catch(console.error);
    } else {
      localStorage.removeItem('kb_auth_user');
    }
  };

  const logout = () => {
    setMeIdRaw('');
    localStorage.removeItem('kb_auth_user');
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [
          usersData, materialsData, rfcsData, notificationsData,
          catalogData, groupsData, ratingsData,
          emailConfigData, emailTemplatesData,
          reviewPeriodsData, rbacDefaultsData,
          adConfigData, adSyncLogData,
          effectiveVisGroupsData,
          newHiresConfigData,
          newHireProfilesData,
          newHireAssignmentsData,
        ] = await Promise.all([
          api.getUsers(),
          api.getMaterialVersions(),
          api.getRfcs(),
          api.getNotifications(),
          api.getCatalogNodes(),
          api.getVisibilityGroups(),
          api.getRatings(),
          api.getEmailConfig(),
          api.getEmailTemplates(),
          api.getReviewPeriods(),
          api.getRbacDefaults(),
          api.getAdConfig(),
          api.getAdSyncLog(),
          api.getEffectiveVisGroups(),
          api.getNewHiresConfig().catch(() => ({ enabled: false })),
          api.getNewHireProfiles().catch(() => []),
          api.getNewHireAssignments().catch(() => []),
        ]);

        setUsers(usersData);
        setMaterials(materialsData);
        setRfcs(rfcsData);
        setNotifications(notificationsData);
        setCatalogNodes(catalogData);
        setGroups(groupsData);
        setRatings(ratingsData);
        if (emailConfigData) setEmailConfig(emailConfigData);
        setEmailTemplates(emailTemplatesData);

        const reviewPeriods = reviewPeriodsData.map((rp: any) => ({
          criticality: rp.criticality,
          days: rp.days,
          remindBeforeDays: rp.remindBeforeDays,
          escalationAfterDays: rp.escalationAfterDays,
          _id: rp.id,
        }));
        const rbacDefaults: any = {};
        for (const rd of rbacDefaultsData) {
          rbacDefaults[rd.key] = rd.roles;
          rbacDefaults[`_id_${rd.key}`] = rd.id;
        }

        setPolicy({
          reviewPeriods,
          rbacDefaults,
          adIntegration: adConfigData ? {
            enabled: adConfigData.enabled,
            mode: adConfigData.mode,
            ssoUrl: adConfigData.ssoUrl,
            bindDn: adConfigData.bindDn || "",
            bindPassword: adConfigData.bindPassword || "",
            baseDn: adConfigData.baseDn || "",
            syncFrequencyMinutes: adConfigData.syncFrequencyMinutes,
            lastSyncAt: adConfigData.lastSyncAt,
            syncStatus: adConfigData.syncStatus,
            syncedUsersCount: adConfigData.syncedUsersCount,
            deactivatedCount: adConfigData.deactivatedCount,
            mapping: {
              roles: adConfigData.mappingRoles,
              department: adConfigData.mappingDepartment,
              legalEntity: adConfigData.mappingLegalEntity,
              displayName: adConfigData.mappingDisplayName,
              email: adConfigData.mappingEmail,
            },
            syncLog: adSyncLogData.map((s: any) => ({
              at: s.syncedAt,
              status: s.status,
              usersTotal: s.usersTotal,
              usersUpdated: s.usersUpdated,
              usersDeactivated: s.usersDeactivated,
              message: s.message,
            })),
            _id: adConfigData.id,
          } : defaultAdIntegration,
        });

        setEffectiveVisGroupMap(effectiveVisGroupsData);
        setNewHiresEnabledRaw(newHiresConfigData.enabled);
        setNewHireProfiles(newHireProfilesData as NewHireProfile[]);
        setNewHireAssignments(newHireAssignmentsData as NewHireAssignment[]);

        if (usersData.length > 0) {
          const subs = await api.getUserSubscriptions(usersData[0].id);
          setSubscriptionMap(prev => ({ ...prev, [usersData[0].id]: subs }));
        }
      } catch (err) {
        console.error("Failed to load data from API:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const me = useMemo(() => users.find((u) => u.id === meId) || {
    id: '', displayName: '', email: '', roles: [] as Role[], legalEntity: '', department: '', isAvailable: true, source: 'local' as const
  }, [users, meId]);
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
          api.removeSubscriber(materialId, userId).catch(console.error);
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
        persistNotification(email);
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
      m.status !== "Архив" && canViewMaterial(me, m, groups, effectiveVisGroupMap[m.materialId]),
    );

    return {
      me,
      isAuthenticated: !!meId,
      setMeId,
      logout,
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
        setPolicy((prev) => {
          const updated = {
            ...prev,
            reviewPeriods: prev.reviewPeriods.map((p) =>
              p.criticality === criticality ? { ...p, ...data } : p,
            ),
          };
          const rp = updated.reviewPeriods.find(p => p.criticality === criticality);
          if (rp && rp._id) {
            api.updateReviewPeriod(rp._id, { ...data }).catch(console.error);
          }
          return updated;
        });
        return { ok: true };
      },

      updateRbacDefaults: (key: keyof RbacDefaults, roles: string[]) => {
        if (roles.length === 0) return { ok: false, message: "Нужно выбрать хотя бы одну роль" };
        setPolicy((prev) => {
          const dbId = (prev.rbacDefaults as any)[`_id_${key}`];
          if (dbId) {
            api.updateRbacDefault(dbId, { roles }).catch(console.error);
          }
          return {
            ...prev,
            rbacDefaults: { ...prev.rbacDefaults, [key]: roles },
          };
        });
        return { ok: true };
      },

      confirmActuality: (versionId: string) => {
        const version = materials.find((m) => m.id === versionId);
        if (!version) return { ok: false, message: "Версия не найдена" };
        if (!canConfirmActuality(me, version)) return { ok: false, message: "Недостаточно прав" };

        const lastReviewedAt = new Date().toISOString();
        const { next, periodDays } = computeNextReview(version.passport.criticality, lastReviewedAt, policy);

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
        persistNotification(email);

        setEffectiveVisGroupMap((prev) => ({ ...prev, [version.materialId]: version.passport.visibilityGroupIds }));
        api.upsertEffectiveVisGroup(version.materialId, version.passport.visibilityGroupIds).catch(console.error);

        api.updateMaterialVersionRaw(versionId, {
          status: version.status === "На пересмотре" ? "Опубликовано" : version.status,
          lastReviewedAt,
          nextReviewAt: next,
          reviewPeriodDays: periodDays,
        }).catch(console.error);

        return { ok: true };
      },

      submitForApproval: (versionId: string) => {
        const version = materials.find((m) => m.id === versionId);
        if (!version) return { ok: false, message: "Версия не найдена" };
        if (!canSubmitForApproval(me, version)) return { ok: false, message: version.rejectedAt ? "Публикация отклонена. Создайте новую версию для повторного согласования." : "Недостаточно прав для отправки на согласование" };

        const isAuthorOwnerOrDeputy =
          version.createdBy === version.passport.ownerId ||
          version.createdBy === version.passport.deputyId;
        const step: "material_owner" | "section_owner" = isAuthorOwnerOrDeputy ? "section_owner" : "material_owner";

        setMaterials((prev) =>
          prev.map((m) =>
            m.id === versionId
              ? { ...m, status: "На согласовании" as MaterialVersion["status"], approvalStep: step }
              : m,
          ),
        );

        let notifyEmails: string[] = [];
        if (step === "material_owner") {
          const ownerEmail = users.find((u) => u.id === version.passport.ownerId)?.email;
          if (ownerEmail) notifyEmails = [ownerEmail];
        } else {
          const sectionOwnerIds = getSectionOwnerIds(version, catalogNodes);
          notifyEmails = sectionOwnerIds.map(id => users.find(u => u.id === id)?.email).filter(Boolean) as string[];
        }

        for (const addr of notifyEmails) {
          const email = seedEmail(notifications, {
            to: addr,
            subject: `Запрос на согласование: ${version.passport.title}`,
            template: "new_version",
            related: { materialId: version.materialId, versionId: version.id },
          });
          setNotifications((p) => [email, ...p]);
          persistNotification(email);
        }

        api.updateMaterialVersionRaw(versionId, { status: "На согласовании", approvalStep: step }).catch(console.error);

        return { ok: true };
      },

      publishDirect: (versionId: string) => {
        const version = materials.find((m) => m.id === versionId);
        if (!version) return { ok: false, message: "Версия не найдена" };
        if (!canPublishDirectly(me, version)) return { ok: false, message: "Только владелец/заместитель может публиковать без согласования" };

        const lastReviewedAt = new Date().toISOString();
        const { next, periodDays } = computeNextReview(version.passport.criticality, lastReviewedAt, policy);

        const archivedIds: string[] = [];
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
              archivedIds.push(m.id);
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
        persistNotification(email);

        notifySubscribers(version, version.passport.visibilityGroupIds);

        api.updateMaterialVersionRaw(versionId, {
          status: "Опубликовано",
          lastReviewedAt,
          nextReviewAt: next,
          reviewPeriodDays: periodDays,
        }).catch(console.error);
        for (const aid of archivedIds) {
          api.updateMaterialVersionRaw(aid, { status: "Архив" }).catch(console.error);
        }
        api.upsertEffectiveVisGroup(version.materialId, version.passport.visibilityGroupIds).catch(console.error);

        return { ok: true };
      },

      approveAndPublish: (versionId: string) => {
        const version = materials.find((m) => m.id === versionId);
        if (!version) return { ok: false, message: "Версия не найдена" };
        if (!canApproveAndPublish(me, version, catalogNodes)) return { ok: false, message: "Недостаточно прав для согласования" };

        const step = getApprovalStep(version);
        const newChangelog = (version.changelog ? version.changelog + "\n" : "") + `[APPROVED BY ${me.displayName} (${step === "material_owner" ? "владелец материала" : "владелец раздела"})]`;

        if (step === "material_owner") {
          const nextStep: "section_owner" = "section_owner";
          setMaterials((prev) =>
            prev.map((m) =>
              m.id === versionId
                ? { ...m, approvalStep: nextStep, changelog: newChangelog }
                : m,
            ),
          );

          const sectionOwnerIds = getSectionOwnerIds(version, catalogNodes);
          const notifyEmails = sectionOwnerIds.map(id => users.find(u => u.id === id)?.email).filter(Boolean) as string[];
          for (const addr of notifyEmails) {
            const email = seedEmail(notifications, {
              to: addr,
              subject: `Требуется ваше согласование: ${version.passport.title}`,
              template: "new_version",
              related: { materialId: version.materialId, versionId: version.id },
            });
            setNotifications((p) => [email, ...p]);
            persistNotification(email);
          }

          api.updateMaterialVersionRaw(versionId, { approvalStep: nextStep, changelog: newChangelog }).catch(console.error);
          return { ok: true };
        }

        const lastReviewedAt = new Date().toISOString();
        const { next, periodDays } = computeNextReview(version.passport.criticality, lastReviewedAt, policy);

        const archivedIds: string[] = [];
        setMaterials((prev) =>
          prev.map((m) => {
            if (m.id === versionId) {
              return {
                ...m,
                status: "Опубликовано" as MaterialVersion["status"],
                approvalStep: undefined,
                changelog: newChangelog,
                passport: { ...m.passport, lastReviewedAt, nextReviewAt: next, reviewPeriodDays: periodDays },
              };
            }
            if (m.materialId === version.materialId && m.id !== versionId && (m.status === "Опубликовано" || m.status === "На пересмотре")) {
              archivedIds.push(m.id);
              return { ...m, status: "Архив" as MaterialVersion["status"] };
            }
            return m;
          }),
        );

        setEffectiveVisGroupMap((prev) => ({ ...prev, [version.materialId]: version.passport.visibilityGroupIds }));
        cleanupSubscriptionsOnGroupChange(version.materialId, version.passport.visibilityGroupIds);

        const authorEmail = users.find((u) => u.id === version.createdBy)?.email || "unknown@demo.local";
        const publishEmail = seedEmail(notifications, {
          to: authorEmail,
          subject: `Согласовано и опубликовано: ${version.passport.title}`,
          template: "new_version",
          related: { materialId: version.materialId, versionId: version.id },
        });
        setNotifications((p) => [publishEmail, ...p]);
        persistNotification(publishEmail);

        notifySubscribers(version, version.passport.visibilityGroupIds);

        api.updateMaterialVersionRaw(versionId, {
          status: "Опубликовано",
          approvalStep: null,
          changelog: newChangelog,
          lastReviewedAt,
          nextReviewAt: next,
          reviewPeriodDays: periodDays,
        }).catch(console.error);
        for (const aid of archivedIds) {
          api.updateMaterialVersionRaw(aid, { status: "Архив" }).catch(console.error);
        }
        api.upsertEffectiveVisGroup(version.materialId, version.passport.visibilityGroupIds).catch(console.error);

        return { ok: true };
      },

      returnForRevision: (versionId: string, comment: string) => {
        const version = materials.find((m) => m.id === versionId);
        if (!version) return { ok: false, message: "Версия не найдена" };
        if (!canReturnForRevision(me, version, catalogNodes)) return { ok: false, message: "Недостаточно прав" };
        if (!comment.trim()) return { ok: false, message: "Комментарий обязателен при отклонении" };

        const rejectedAt = new Date().toISOString();
        const newChangelog = (version.changelog ? version.changelog + "\n" : "") + `[REJECTED] ${me.displayName}: ${comment}`;

        setMaterials((prev) =>
          prev.map((m) =>
            m.id === versionId
              ? {
                  ...m,
                  status: "Черновик" as MaterialVersion["status"],
                  changelog: newChangelog,
                  rejectedAt,
                  approvalStep: undefined,
                }
              : m,
          ),
        );

        const authorEmail = users.find((u) => u.id === version.createdBy)?.email || "unknown@demo.local";
        const email = seedEmail(notifications, {
          to: authorEmail,
          subject: `Публикация отклонена: ${version.passport.title}`,
          template: "auto_transition",
          related: { materialId: version.materialId, versionId: version.id },
        });
        setNotifications((p) => [email, ...p]);
        persistNotification(email);

        api.updateMaterialVersionRaw(versionId, {
          status: "Черновик",
          changelog: newChangelog,
          rejectedAt,
          approvalStep: null,
        }).catch(console.error);

        return { ok: true };
      },

      adminForcePublish: (versionId: string, comment: string) => {
        const version = materials.find((m) => m.id === versionId);
        if (!version) return { ok: false, message: "Версия не найдена" };
        if (!me.roles.includes("Администратор")) return { ok: false, message: "Только администратор может принудительно публиковать" };
        if (!comment.trim()) return { ok: false, message: "Комментарий обязателен" };

        const lastReviewedAt = new Date().toISOString();
        const { next, periodDays } = computeNextReview(version.passport.criticality, lastReviewedAt, policy);
        const newChangelog = (version.changelog ? version.changelog + "\n" : "") + `[ADMIN FORCE PUBLISH] ${comment}`;

        const archivedIds: string[] = [];
        setMaterials((prev) =>
          prev.map((m) => {
            if (m.id === versionId) {
              return {
                ...m,
                status: "Опубликовано" as MaterialVersion["status"],
                changelog: newChangelog,
                passport: { ...m.passport, lastReviewedAt, nextReviewAt: next, reviewPeriodDays: periodDays },
              };
            }
            if (m.materialId === version.materialId && m.id !== versionId && (m.status === "Опубликовано" || m.status === "На пересмотре")) {
              archivedIds.push(m.id);
              return { ...m, status: "Архив" as MaterialVersion["status"] };
            }
            return m;
          }),
        );

        setEffectiveVisGroupMap((prev) => ({ ...prev, [version.materialId]: version.passport.visibilityGroupIds }));
        cleanupSubscriptionsOnGroupChange(version.materialId, version.passport.visibilityGroupIds);

        const email = seedEmail(notifications, {
          to: me.email,
          subject: `Принудительно опубликовано: ${version.passport.title}`,
          template: "new_version",
          related: { materialId: version.materialId, versionId: version.id },
        });
        setNotifications((p) => [email, ...p]);
        persistNotification(email);

        notifySubscribers(version, version.passport.visibilityGroupIds);

        api.updateMaterialVersionRaw(versionId, {
          status: "Опубликовано",
          changelog: newChangelog,
          lastReviewedAt,
          nextReviewAt: next,
          reviewPeriodDays: periodDays,
        }).catch(console.error);
        for (const aid of archivedIds) {
          api.updateMaterialVersionRaw(aid, { status: "Архив" }).catch(console.error);
        }
        api.upsertEffectiveVisGroup(version.materialId, version.passport.visibilityGroupIds).catch(console.error);

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
            const email = seedEmail(notifications, {
              to:
                users.find((u) => u.id === (m.passport.ownerId || ""))?.email ||
                "unknown@demo.local",
              subject: `Просрочка пересмотра: ${m.passport.title}`,
              template: "overdue",
              related: { materialId: m.materialId, versionId: m.id },
            });
            emails.push(email);
            return { ...m, status: "На пересмотре" };
          }
          return m;
        });

        if (transitioned.length) {
          setMaterials(nextMaterials);
          for (const tid of transitioned) {
            api.updateMaterialVersionRaw(tid, { status: "На пересмотре" }).catch(console.error);
          }
        }
        if (emails.length) {
          setNotifications((p) => [...emails, ...p]);
          for (const email of emails) {
            persistNotification(email);
          }
        }

        return { transitioned, emails };
      },

      updateAdConfig: (data) => {
        setPolicy((prev) => ({
          ...prev,
          adIntegration: { ...prev.adIntegration, ...data },
        }));
        api.updateAdConfig(data).catch(console.error);
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

          for (const mid of affectedMaterials) {
            api.updateMaterialVersionRaw(mid, { status: "На пересмотре" }).catch(console.error);
          }

          const adminEmail = users.find((u) => u.roles.includes("Администратор"))?.email || "admin@demo.local";
          const email = seedEmail(notifications, {
            to: adminEmail,
            subject: `AD-синхронизация: ${deactivated.length} пользователь(ей) деактивировано, ${affectedMaterials.length} материал(ов) на пересмотре`,
            template: "auto_transition",
            related: {},
          });
          setNotifications((p) => [email, ...p]);
          persistNotification(email);
        }

        for (const u of users) {
          if (u.source === "ad" && !u.deactivatedAt) {
            api.updateUser(u.id, { lastSyncAt: now } as any).catch(console.error);
          }
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

        api.createUser({
          ...newUser,
          username: data.email,
          password: data.password || '1',
        } as any).catch(console.error);

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

          for (const o of owned) {
            api.updateMaterialVersionRaw(o.id, { status: "На пересмотре" }).catch(console.error);
          }

          const adminEmail = users.find((u) => u.roles.includes("Администратор"))?.email || "admin@demo.local";
          const email = seedEmail(notifications, {
            to: adminEmail,
            subject: `Деактивация ${user.displayName}: ${owned.length} материал(ов) переведено на пересмотр`,
            template: "auto_transition",
            related: {},
          });
          setNotifications((p) => [email, ...p]);
          persistNotification(email);
        }

        api.updateUser(userId, { deactivatedAt: now, isAvailable: false } as any).catch(console.error);

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

        api.updateUser(userId, { deactivatedAt: null, isAvailable: true } as any).catch(console.error);

        return { ok: true };
      },

      updateUser: (userId: string, data: { displayName?: string; email?: string; department?: string; legalEntity?: string; roles?: User["roles"] }) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return { ok: false, message: "Пользователь не найден" };

        const updateData: any = { ...data };
        if (data.roles !== undefined) {
          const roles = data.roles.length > 0 ? data.roles : ["Читатель" as const];
          updateData.roles = roles.includes("Читатель") ? roles : ["Читатель" as const, ...roles];
        }

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

        api.updateUser(userId, updateData).catch(console.error);

        return { ok: true };
      },

      createGroup: (data: { title: string; memberIds: string[] }) => {
        if (!data.title.trim()) return { ok: false, message: "Название не может быть пустым" };
        const id = `g-${Date.now()}`;
        const group: VisibilityGroup = { id, title: data.title.trim(), isSystem: false, memberIds: data.memberIds };
        setGroups((prev) => [...prev, group]);

        api.createVisibilityGroup({ title: data.title.trim(), isSystem: false, memberIds: data.memberIds }).then(created => {
          setGroups(prev => prev.map(g => g.id === id ? { ...g, id: created.id } : g));
        }).catch(console.error);

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

        api.updateVisibilityGroup(groupId, {
          title: data.title !== undefined ? data.title.trim() : undefined,
          memberIds: data.memberIds,
        } as any).catch(console.error);

        return { ok: true };
      },

      deleteGroup: (groupId: string) => {
        const group = groups.find((g) => g.id === groupId);
        if (!group) return { ok: false, message: "Группа не найдена" };
        if (group.isSystem) return { ok: false, message: "Системную группу нельзя удалить" };

        setGroups((prev) => prev.filter((g) => g.id !== groupId));

        api.deleteVisibilityGroup(groupId).catch(console.error);

        return { ok: true };
      },

      ratings,

      rateMaterial: (materialId: string, value: "helpful" | "not_helpful") => {
        const today = getMoscowDateString();
        const alreadyRated = ratings.some(
          (r) => r.userId === meId && r.materialId === materialId && r.date === today,
        );
        if (alreadyRated) return { ok: false, message: "Вы уже оценили этот материал сегодня" };
        const newRating: HelpfulRating = { userId: meId, materialId, date: today, value };
        setRatings((prev) => [...prev, newRating]);
        const statKey = value === "helpful" ? "helpfulYes" : "helpfulNo";
        setMaterials((prev) =>
          prev.map((m) =>
            m.materialId === materialId && m.status !== "Архив"
              ? { ...m, stats: { ...m.stats, [statKey]: m.stats[statKey] + 1 } }
              : m,
          ),
        );

        api.createRating(newRating).catch(console.error);
        const version = materials.find(m => m.materialId === materialId && m.status !== "Архив");
        if (version) {
          api.updateMaterialVersionRaw(version.id, {
            [statKey]: version.stats[statKey] + 1,
          }).catch(console.error);
        }

        return { ok: true };
      },

      canRateToday: (materialId: string) => {
        const today = getMoscowDateString();
        return !ratings.some(
          (r) => r.userId === meId && r.materialId === materialId && r.date === today,
        );
      },

      getMaterialRatings: (materialId: string) => {
        const matRatings = ratings.filter((r) => r.materialId === materialId);
        const helpful = matRatings.filter((r) => r.value === "helpful").length;
        const notHelpful = matRatings.filter((r) => r.value === "not_helpful").length;
        return { helpful, notHelpful, total: helpful + notHelpful };
      },

      recordView: (materialId: string) => {
        const now = Date.now();
        const recent = viewLog.find(
          (v) =>
            v.userId === meId &&
            v.materialId === materialId &&
            now - v.at < VIEW_DEDUP_MINUTES * 60 * 1000,
        );
        const version = materials.find(
          (m) => m.materialId === materialId && m.status !== "Архив",
        ) || materials.find((m) => m.materialId === materialId);
        if (version) {
          setMaterials((prev) =>
            prev.map((m) =>
              m.id === version.id
                ? {
                    ...m,
                    stats: recent ? m.stats : { ...m.stats, views: m.stats.views + 1 },
                    auditViews: [{ userId: meId, at: new Date().toISOString() }, ...m.auditViews].slice(0, 200),
                  }
                : m,
            ),
          );

          api.createAuditView(materialId, meId).catch(console.error);
          if (!recent) {
            api.createViewLog(materialId, meId).catch(console.error);
            api.updateMaterialVersionRaw(version.id, { views: version.stats.views + 1 }).catch(console.error);
          }
        }
        setViewLog((prev) => [...prev, { userId: meId, materialId, at: now }]);
      },

      recordDownload: (materialId: string) => {
        const version = materials.find(
          (m) => m.materialId === materialId && m.status !== "Архив",
        ) || materials.find((m) => m.materialId === materialId);
        if (version) {
          setMaterials((prev) =>
            prev.map((m) =>
              m.id === version.id
                ? {
                    ...m,
                    auditDownloads: [{ userId: meId, at: new Date().toISOString() }, ...(m.auditDownloads || [])].slice(0, 200),
                  }
                : m,
            ),
          );
        }
      },

      recordPreview: (materialId: string) => {
        const version = materials.find(
          (m) => m.materialId === materialId && m.status !== "Архив",
        ) || materials.find((m) => m.materialId === materialId);
        if (version) {
          setMaterials((prev) =>
            prev.map((m) =>
              m.id === version.id
                ? {
                    ...m,
                    auditPreviews: [{ userId: meId, at: new Date().toISOString() }, ...(m.auditPreviews || [])].slice(0, 200),
                  }
                : m,
            ),
          );
        }
      },

      viewDedupMinutes: VIEW_DEDUP_MINUTES,

      subscriptions: mySubscriptions,
      toggleSubscription: (materialId: string) => {
        const isCurrentlySub = (subscriptionMap[meId] || []).includes(materialId);
        setSubscriptionMap((prev) => {
          const current = prev[meId] || [];
          const next = current.includes(materialId)
            ? current.filter((id) => id !== materialId)
            : [...current, materialId];
          return { ...prev, [meId]: next };
        });

        if (isCurrentlySub) {
          api.removeSubscriber(materialId, meId).catch(console.error);
        } else {
          api.addSubscriber(materialId, meId).catch(console.error);
        }
      },
      isSubscribed: (materialId: string) => mySubscriptions.includes(materialId),

      createNewVersion: (materialId: string, majorBump?: boolean) => {
        const allVersions = materials
          .filter((m) => m.materialId === materialId)
          .sort((a, b) => compareVersionDesc(a.version, b.version));
        const current = allVersions[0];
        if (!current) return { ok: false, message: "Материал не найден" };

        const hasDraft = allVersions.some((v) => v.status === "Черновик" || v.status === "На согласовании");
        if (hasDraft) return { ok: false, message: "Уже существует черновик или версия на согласовании. Завершите её перед созданием новой." };

        if (!canCreateNewVersion(me, current, allVersions)) return { ok: false, message: "Недостаточно прав для создания новой версии этого материала." };

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
          auditDownloads: [],
          auditPreviews: [],
          approvalStep: undefined,
          rejectedAt: undefined,
        };

        setMaterials((prev) => {
          const updated = prev.map((m) =>
            m.id === current.id && m.status !== "Архив"
              ? { ...m, status: "Архив" as MaterialVersion["status"] }
              : m,
          );
          return [...updated, newVersion];
        });

        api.createMaterialVersion(newVersion).catch(console.error);
        if (current.status !== "Архив") {
          api.updateMaterialVersionRaw(current.id, { status: "Архив" }).catch(console.error);
        }

        return { ok: true, version: newVersion };
      },

      getAllVersions: (materialId: string) => {
        return materials
          .filter((m) => m.materialId === materialId)
          .sort((a, b) => compareVersionDesc(a.version, b.version));
      },

      viewOldVersion: (versionId: string) => {
        return materials.find((m) => m.id === versionId);
      },

      archiveMaterial: (materialId: string) => {
        const current = materials.find((m) => m.materialId === materialId && m.status !== "Архив");
        if (!current) return { ok: false, message: "Материал уже в архиве или не найден" };
        const now = new Date().toISOString();
        setMaterials((prev) =>
          prev.map((m) => m.id === current.id ? { ...m, status: "Архив" as MaterialVersion["status"], archivedBy: meId, archivedAt: now } : m)
        );
        api.updateMaterialVersionRaw(current.id, { status: "Архив", archivedBy: meId, archivedAt: now } as any).catch(console.error);
        return { ok: true };
      },

      restoreMaterial: (materialId: string) => {
        const archived = materials.find((m) => m.materialId === materialId && m.status === "Архив");
        if (!archived) return { ok: false, message: "Архивный материал не найден" };
        setMaterials((prev) =>
          prev.map((m) => m.id === archived.id ? { ...m, status: "Опубликовано" as MaterialVersion["status"], archivedBy: undefined, archivedAt: undefined } : m)
        );
        api.updateMaterialVersionRaw(archived.id, { status: "Опубликовано", archivedBy: null, archivedAt: null } as any).catch(console.error);
        return { ok: true };
      },

      setSectionOwners: (sectionId: string, ownerIds: string[]) => {
        const node = catalogNodes.find((n) => n.id === sectionId);
        if (!node) return { ok: false, message: "Раздел не найден" };
        if (node.type !== "section") return { ok: false, message: "Владельцев можно назначать только разделам" };

        setCatalogNodes((prev) =>
          prev.map((n) => (n.id === sectionId ? { ...n, ownerIds } : n)),
        );

        api.updateCatalogNode(sectionId, { ownerIds } as any).catch(console.error);

        return { ok: true };
      },

      addSection: (title: string, sortOrder?: number) => {
        if (!title.trim()) return { ok: false, message: "Название не может быть пустым" };
        const id = `sec-${Date.now()}`;
        const node: CatalogNode = { id, title: title.trim(), type: "section", ownerIds: [], sortOrder: sortOrder ?? 0 };
        setCatalogNodes((prev) => [...prev, node]);

        api.createCatalogNode({ title: title.trim(), type: "section", ownerIds: [], sortOrder: sortOrder ?? 0 } as any).then(created => {
          setCatalogNodes(prev => prev.map(n => n.id === id ? { ...n, id: created.id } : n));
        }).catch(console.error);

        return { ok: true, node };
      },

      renameSection: (nodeId: string, title: string, sortOrder?: number) => {
        const node = catalogNodes.find((n) => n.id === nodeId);
        if (!node) return { ok: false, message: "Раздел не найден" };
        if (node.type !== "section") return { ok: false, message: "Можно переименовать только раздел" };
        if (!title.trim()) return { ok: false, message: "Название не может быть пустым" };
        const updates: Partial<CatalogNode> = { title: title.trim() };
        if (sortOrder !== undefined) updates.sortOrder = sortOrder;
        setCatalogNodes((prev) =>
          prev.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
        );

        api.updateCatalogNode(nodeId, updates as any).catch(console.error);

        return { ok: true };
      },

      deleteSection: (nodeId: string) => {
        const node = catalogNodes.find((n) => n.id === nodeId);
        if (!node) return { ok: false, message: "Раздел не найден" };
        if (node.type !== "section") return { ok: false, message: "Можно удалить только раздел" };
        const subs = catalogNodes.filter((n) => n.type === "subsection" && n.parentId === nodeId);
        const hasMaterials = subs.some((sub) => materials.some((m) => m.passport.sectionId === sub.id));
        if (hasMaterials) return { ok: false, message: "Нельзя удалить раздел, в котором есть материалы" };

        const subIds = subs.map(s => s.id);
        setCatalogNodes((prev) => prev.filter((n) => n.id !== nodeId && n.parentId !== nodeId));

        api.deleteCatalogNode(nodeId).catch(console.error);
        for (const sid of subIds) {
          api.deleteCatalogNode(sid).catch(console.error);
        }

        return { ok: true };
      },

      addSubsection: (parentId: string, title: string) => {
        const parent = catalogNodes.find((n) => n.id === parentId && n.type === "section");
        if (!parent) return { ok: false, message: "Родительский раздел не найден" };
        if (!title.trim()) return { ok: false, message: "Название не может быть пустым" };

        const id = `sub-${Date.now()}`;
        const node: CatalogNode = { id, title: title.trim(), type: "subsection", parentId };
        setCatalogNodes((prev) => [...prev, node]);

        api.createCatalogNode({ title: title.trim(), type: "subsection", parentId }).then(created => {
          setCatalogNodes(prev => prev.map(n => n.id === id ? { ...n, id: created.id } : n));
        }).catch(console.error);

        return { ok: true, node };
      },

      renameSubsection: (nodeId: string, title: string) => {
        const node = catalogNodes.find((n) => n.id === nodeId);
        if (!node) return { ok: false, message: "Подраздел не найден" };
        if (!title.trim()) return { ok: false, message: "Название не может быть пустым" };

        setCatalogNodes((prev) =>
          prev.map((n) => (n.id === nodeId ? { ...n, title: title.trim() } : n)),
        );

        api.updateCatalogNode(nodeId, { title: title.trim() }).catch(console.error);

        return { ok: true };
      },

      deleteSubsection: (nodeId: string) => {
        const node = catalogNodes.find((n) => n.id === nodeId);
        if (!node) return { ok: false, message: "Подраздел не найден" };
        if (node.type !== "subsection") return { ok: false, message: "Можно удалить только подраздел" };

        const hasMaterials = materials.some((m) => m.passport.sectionId === nodeId);
        if (hasMaterials) return { ok: false, message: "Нельзя удалить подраздел с материалами" };

        setCatalogNodes((prev) => prev.filter((n) => n.id !== nodeId));

        api.deleteCatalogNode(nodeId).catch(console.error);

        return { ok: true };
      },

      emailConfig,
      emailTemplates,

      updateEmailConfig: (data: Partial<EmailConfig>) => {
        setEmailConfig((prev) => ({ ...prev, ...data }));
        api.updateEmailConfig(data).catch(console.error);
        return { ok: true };
      },

      updateEmailTemplate: (key: string, data: { subject?: string; body?: string }) => {
        const tpl = emailTemplates.find((t) => t.key === key);
        if (!tpl) return { ok: false, message: "Шаблон не найден" };
        setEmailTemplates((prev) =>
          prev.map((t) => (t.key === key ? { ...t, ...data } : t)),
        );

        const tplRecord = emailTemplates.find(t => t.key === key);
        if (tplRecord && (tplRecord as any).id) {
          api.updateEmailTemplate((tplRecord as any).id, data).catch(console.error);
        }

        return { ok: true };
      },

      updateCatalogNode: (nodeId: string, updates: Partial<CatalogNode>) => {
        setCatalogNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
        api.updateCatalogNode(nodeId, updates).catch(console.error);
        return { ok: true };
      },

      newHiresEnabled,
      setNewHiresEnabled: (enabled: boolean) => {
        setNewHiresEnabledRaw(enabled);
        api.updateNewHiresConfig({ enabled }).catch(console.error);
      },
      newHireProfiles,
      newHireAssignments,

      detectNewHires: async () => {
        const existingUserIds = new Set(newHireProfiles.map(p => p.userId));
        const recentUsers = users.filter(u => {
          if (existingUserIds.has(u.id)) return false;
          if (u.deactivatedAt) return false;
          if (u.roles.includes("Администратор")) return false;
          return true;
        });
        let added = 0;
        for (const u of recentUsers) {
          try {
            const profile = await api.createNewHireProfile({
              userId: u.id,
              source: u.source === "ad" ? "AD" : "LOCAL",
              status: "Новый",
            });
            setNewHireProfiles(prev => [...prev, profile as NewHireProfile]);
            added++;
          } catch (e) { console.error(e); }
        }
        return { added };
      },

      assignMaterialsToNewHire: async (userId: string) => {
        const requiredMats = materials.filter(m =>
          m.passport.newHireRequired && m.status === "Опубликовано"
        );
        const existingAssignments = new Set(
          newHireAssignments.filter(a => a.userId === userId).map(a => a.materialId)
        );
        const batchId = `batch-${Date.now()}`;
        let assigned = 0;
        for (const mat of requiredMats) {
          if (existingAssignments.has(mat.materialId)) continue;
          try {
            const assignment = await api.createNewHireAssignment({
              userId,
              materialId: mat.materialId,
              assignedBy: me.id,
              batchId,
            });
            setNewHireAssignments(prev => [...prev, assignment as NewHireAssignment]);
            assigned++;
          } catch (e) { console.error(e); }
        }
        const profile = newHireProfiles.find(p => p.userId === userId);
        if (profile && profile.status === "Новый" && assigned > 0) {
          try {
            await api.updateNewHireProfile(profile.id, { status: "Задания выданы" });
            setNewHireProfiles(prev => prev.map(p =>
              p.id === profile.id ? { ...p, status: "Задания выданы" as const } : p
            ));
          } catch (e) { console.error(e); }
        }
        return { assigned };
      },

      assignMaterialsToAllNewHires: async () => {
        const newProfiles = newHireProfiles.filter(p => p.status === "Новый");
        let totalAssigned = 0;
        const requiredMats = materials.filter(m =>
          m.passport.newHireRequired && m.status === "Опубликовано"
        );
        const batchId = `batch-${Date.now()}`;
        for (const profile of newProfiles) {
          const existingAssignments = new Set(
            newHireAssignments.filter(a => a.userId === profile.userId).map(a => a.materialId)
          );
          let assigned = 0;
          for (const mat of requiredMats) {
            if (existingAssignments.has(mat.materialId)) continue;
            try {
              const assignment = await api.createNewHireAssignment({
                userId: profile.userId,
                materialId: mat.materialId,
                assignedBy: me.id,
                batchId,
              });
              setNewHireAssignments(prev => [...prev, assignment as NewHireAssignment]);
              assigned++;
              totalAssigned++;
            } catch (e) { console.error(e); }
          }
          if (assigned > 0) {
            try {
              await api.updateNewHireProfile(profile.id, { status: "Задания выданы" });
              setNewHireProfiles(prev => prev.map(p =>
                p.id === profile.id ? { ...p, status: "Задания выданы" as const } : p
              ));
            } catch (e) { console.error(e); }
          }
        }
        return { assigned: totalAssigned };
      },

      updateNewHireStatus: (profileId: string, status: NewHireStatus) => {
        setNewHireProfiles(prev => prev.map(p =>
          p.id === profileId ? { ...p, status } : p
        ));
        api.updateNewHireProfile(profileId, { status }).catch(console.error);
      },

      acknowledgeAssignment: (assignmentId: string, versionId: string) => {
        const now = new Date().toISOString();
        setNewHireAssignments(prev => prev.map(a =>
          a.id === assignmentId ? { ...a, acknowledgedAt: now, acknowledgedVersionId: versionId } : a
        ));
        api.acknowledgeAssignment(assignmentId, versionId).catch(console.error);
        const assignment = newHireAssignments.find(a => a.id === assignmentId);
        if (assignment) {
          const userAssignments = newHireAssignments.filter(a => a.userId === assignment.userId);
          const allAcknowledged = userAssignments.every(a =>
            a.id === assignmentId || a.acknowledgedAt
          );
          if (allAcknowledged) {
            const profile = newHireProfiles.find(p => p.userId === assignment.userId);
            if (profile && profile.status !== "Завершено") {
              setNewHireProfiles(prev => prev.map(p =>
                p.id === profile.id ? { ...p, status: "Завершено" as const } : p
              ));
              api.updateNewHireProfile(profile.id, { status: "Завершено" }).catch(console.error);
            }
          }
        }
      },

      getMyAssignments: () => {
        return newHireAssignments.filter(a => a.userId === meId);
      },
    };
  }, [catalogNodes, effectiveVisGroupMap, emailConfig, emailTemplates, groups, materials, me, meId, mySubscriptions, newHireAssignments, newHireProfiles, newHiresEnabled, notifications, policy, ratings, rfcs, users, viewLog]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

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
