import type {
  User,
  MaterialVersion,
  CatalogNode,
  VisibilityGroup,
  RFC,
  NotificationLog,
  HelpfulRating,
  EmailConfig,
  EmailTemplate,
  NewHireProfile,
  NewHireAssignment,
} from "./mockData";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function postJson<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return res.json();
}

async function patchJson<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${url} failed: ${res.status}`);
  return res.json();
}

async function putJson<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${url} failed: ${res.status}`);
  return res.json();
}

async function deleteJson(url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status}`);
}

function dbMaterialToFrontend(
  dbMat: any,
  subscribers: string[],
  auditViews: { userId: string; at: string }[]
): MaterialVersion {
  return {
    id: dbMat.id,
    materialId: dbMat.materialId,
    version: dbMat.version,
    createdAt: dbMat.createdAt,
    createdBy: dbMat.createdBy,
    changelog: dbMat.changelog,
    status: dbMat.status,
    passport: {
      title: dbMat.title,
      purpose: dbMat.purpose,
      tags: dbMat.tags,
      tagGroups: dbMat.tagGroups,
      criticality: dbMat.criticality,
      sectionId: dbMat.sectionId,
      ownerId: dbMat.ownerId,
      deputyId: dbMat.deputyId,
      legalEntity: dbMat.legalEntity,
      department: dbMat.department,
      requiredTraining: dbMat.requiredTraining,
      newHireRequired: dbMat.newHireRequired,
      relatedLinks: dbMat.relatedLinks,
      lastReviewedAt: dbMat.lastReviewedAt,
      nextReviewAt: dbMat.nextReviewAt,
      reviewPeriodDays: dbMat.reviewPeriodDays,
      visibilityGroupIds: dbMat.visibilityGroupIds,
    },
    content: {
      kind: dbMat.contentKind,
      file: dbMat.contentFile,
      page: dbMat.contentPage,
    },
    subscribers,
    discussionsEnabled: dbMat.discussionsEnabled,
    discussionVisibility: dbMat.discussionVisibility,
    stats: {
      views: dbMat.views,
      helpfulYes: dbMat.helpfulYes,
      helpfulNo: dbMat.helpfulNo,
    },
    auditViews,
  };
}

function frontendMaterialToDb(mat: MaterialVersion): any {
  const { passport, content, stats, subscribers: _s, auditViews: _a, ...rest } = mat;
  return {
    ...rest,
    title: passport.title,
    purpose: passport.purpose,
    tags: passport.tags,
    tagGroups: passport.tagGroups,
    criticality: passport.criticality,
    sectionId: passport.sectionId,
    ownerId: passport.ownerId,
    deputyId: passport.deputyId,
    legalEntity: passport.legalEntity,
    department: passport.department,
    requiredTraining: passport.requiredTraining,
    newHireRequired: passport.newHireRequired,
    relatedLinks: passport.relatedLinks,
    lastReviewedAt: passport.lastReviewedAt,
    nextReviewAt: passport.nextReviewAt,
    reviewPeriodDays: passport.reviewPeriodDays,
    visibilityGroupIds: passport.visibilityGroupIds,
    contentKind: content.kind,
    contentFile: content.file,
    contentPage: content.page,
    views: stats.views,
    helpfulYes: stats.helpfulYes,
    helpfulNo: stats.helpfulNo,
  };
}

function dbUserToFrontend(dbUser: any): User {
  const { username: _u, password: _p, ...rest } = dbUser;
  return {
    ...rest,
    lastSyncAt: dbUser.lastSyncAt || undefined,
    deactivatedAt: dbUser.deactivatedAt || undefined,
  };
}

function dbRfcToFrontend(dbRfc: any, comments: any[]): RFC {
  return {
    id: dbRfc.id,
    materialId: dbRfc.materialId,
    createdAt: dbRfc.createdAt,
    createdBy: dbRfc.createdBy,
    type: dbRfc.type,
    title: dbRfc.title,
    description: dbRfc.description,
    status: dbRfc.status,
    assignedTo: dbRfc.assignedTo,
    sla: {
      reactedAt: dbRfc.slaReactedAt,
      updatedAt: dbRfc.slaUpdatedAt,
    },
    comments: comments.map((c) => ({
      id: c.id,
      at: c.createdAt,
      by: c.createdBy,
      text: c.text,
    })),
  };
}

function dbNotificationToFrontend(dbNotif: any): NotificationLog {
  return {
    id: dbNotif.id,
    at: dbNotif.createdAt,
    to: dbNotif.toAddress,
    subject: dbNotif.subject,
    template: dbNotif.template,
    related: {
      materialId: dbNotif.relatedMaterialId,
      versionId: dbNotif.relatedVersionId,
      rfcId: dbNotif.relatedRfcId,
    },
    status: dbNotif.status,
  };
}

export const api = {
  async getUsers(): Promise<User[]> {
    const users = await fetchJson<any[]>("/api/users");
    return users.map(dbUserToFrontend);
  },

  async getUser(id: string): Promise<User> {
    const user = await fetchJson<any>(`/api/users/${id}`);
    return dbUserToFrontend(user);
  },

  async createUser(data: Partial<User>): Promise<User> {
    const user = await postJson<any>("/api/users", data);
    return dbUserToFrontend(user);
  },

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const user = await patchJson<any>(`/api/users/${id}`, data);
    return dbUserToFrontend(user);
  },

  async getCatalogNodes(): Promise<CatalogNode[]> {
    return fetchJson<CatalogNode[]>("/api/catalog-nodes");
  },

  async createCatalogNode(data: Partial<CatalogNode>): Promise<CatalogNode> {
    return postJson<CatalogNode>("/api/catalog-nodes", data);
  },

  async updateCatalogNode(id: string, data: Partial<CatalogNode>): Promise<CatalogNode> {
    return patchJson<CatalogNode>(`/api/catalog-nodes/${id}`, data);
  },

  async deleteCatalogNode(id: string): Promise<void> {
    return deleteJson(`/api/catalog-nodes/${id}`);
  },

  async getVisibilityGroups(): Promise<VisibilityGroup[]> {
    return fetchJson<VisibilityGroup[]>("/api/visibility-groups");
  },

  async createVisibilityGroup(data: { title: string; isSystem: boolean; memberIds: string[] }): Promise<VisibilityGroup> {
    return postJson<VisibilityGroup>("/api/visibility-groups", data);
  },

  async updateVisibilityGroup(id: string, data: Partial<VisibilityGroup>): Promise<VisibilityGroup> {
    return patchJson<VisibilityGroup>(`/api/visibility-groups/${id}`, data);
  },

  async deleteVisibilityGroup(id: string): Promise<void> {
    return deleteJson(`/api/visibility-groups/${id}`);
  },

  async getMaterialVersions(): Promise<MaterialVersion[]> {
    const dbVersions = await fetchJson<any[]>("/api/material-versions");
    const materialIds = Array.from(new Set(dbVersions.map((v) => v.materialId)));
    const [subsResults, viewsResults] = await Promise.all([
      Promise.all(materialIds.map((mid) => fetchJson<any[]>(`/api/materials/${mid}/subscribers`))),
      Promise.all(materialIds.map((mid) => fetchJson<any[]>(`/api/materials/${mid}/audit-views`))),
    ]);
    const subsMap: Record<string, string[]> = {};
    const viewsMap: Record<string, { userId: string; at: string }[]> = {};
    materialIds.forEach((mid, i) => {
      subsMap[mid] = subsResults[i].map((s: any) => s.userId);
      viewsMap[mid] = viewsResults[i].map((v: any) => ({ userId: v.userId, at: v.viewedAt }));
    });
    return dbVersions.map((v) =>
      dbMaterialToFrontend(v, subsMap[v.materialId] || [], viewsMap[v.materialId] || [])
    );
  },

  async getMaterialVersion(id: string): Promise<MaterialVersion> {
    const dbMat = await fetchJson<any>(`/api/material-versions/${id}`);
    const [subs, views] = await Promise.all([
      fetchJson<any[]>(`/api/materials/${dbMat.materialId}/subscribers`),
      fetchJson<any[]>(`/api/materials/${dbMat.materialId}/audit-views`),
    ]);
    return dbMaterialToFrontend(
      dbMat,
      subs.map((s: any) => s.userId),
      views.map((v: any) => ({ userId: v.userId, at: v.viewedAt }))
    );
  },

  async createMaterialVersion(mat: MaterialVersion): Promise<MaterialVersion> {
    const dbData = frontendMaterialToDb(mat);
    const created = await postJson<any>("/api/material-versions", dbData);
    return dbMaterialToFrontend(created, mat.subscribers, mat.auditViews);
  },

  async updateMaterialVersion(id: string, updates: Partial<any>): Promise<any> {
    return patchJson<any>(`/api/material-versions/${id}`, updates);
  },

  async updateMaterialVersionRaw(id: string, data: any): Promise<any> {
    return patchJson<any>(`/api/material-versions/${id}`, data);
  },

  async getSubscribers(materialId: string): Promise<string[]> {
    const subs = await fetchJson<any[]>(`/api/materials/${materialId}/subscribers`);
    return subs.map((s: any) => s.userId);
  },

  async addSubscriber(materialId: string, userId: string): Promise<void> {
    await postJson(`/api/materials/${materialId}/subscribers`, { userId });
  },

  async removeSubscriber(materialId: string, userId: string): Promise<void> {
    await deleteJson(`/api/materials/${materialId}/subscribers/${userId}`);
  },

  async getUserSubscriptions(userId: string): Promise<string[]> {
    const subs = await fetchJson<any[]>(`/api/users/${userId}/subscriptions`);
    return subs.map((s: any) => s.materialId);
  },

  async removeSubscribersByMaterialAndUsers(materialId: string, userIds: string[]): Promise<void> {
    await Promise.all(userIds.map((uid) => deleteJson(`/api/materials/${materialId}/subscribers/${uid}`)));
  },

  async getAuditViews(materialId: string): Promise<{ userId: string; at: string }[]> {
    const views = await fetchJson<any[]>(`/api/materials/${materialId}/audit-views`);
    return views.map((v: any) => ({ userId: v.userId, at: v.viewedAt }));
  },

  async createAuditView(materialId: string, userId: string): Promise<void> {
    await postJson("/api/audit-views", { materialId, userId });
  },

  async checkRecentView(materialId: string, userId: string, minutes: number): Promise<boolean> {
    const result = await fetchJson<any[]>(
      `/api/view-log/check?materialId=${encodeURIComponent(materialId)}&userId=${encodeURIComponent(userId)}&minutes=${minutes}`
    );
    return result.length > 0;
  },

  async createViewLog(materialId: string, userId: string): Promise<void> {
    await postJson("/api/view-log", { materialId, userId });
  },

  async getRfcs(): Promise<RFC[]> {
    const dbRfcs = await fetchJson<any[]>("/api/rfcs");
    const rfcsWithComments = await Promise.all(
      dbRfcs.map(async (rfc) => {
        const comments = await fetchJson<any[]>(`/api/rfcs/${rfc.id}/comments`);
        return dbRfcToFrontend(rfc, comments);
      })
    );
    return rfcsWithComments;
  },

  async createRfc(data: Partial<RFC>): Promise<RFC> {
    const { sla, comments: _c, ...rest } = data as any;
    const dbData: any = { ...rest };
    if (sla) {
      dbData.slaReactedAt = sla.reactedAt;
      dbData.slaUpdatedAt = sla.updatedAt;
    }
    const created = await postJson<any>("/api/rfcs", dbData);
    return dbRfcToFrontend(created, []);
  },

  async updateRfc(id: string, data: Partial<any>): Promise<any> {
    return patchJson<any>(`/api/rfcs/${id}`, data);
  },

  async addRfcComment(rfcId: string, data: { createdBy: string; text: string }): Promise<any> {
    return postJson<any>(`/api/rfcs/${rfcId}/comments`, data);
  },

  async getNotifications(): Promise<NotificationLog[]> {
    const dbNotifs = await fetchJson<any[]>("/api/notifications");
    return dbNotifs.map(dbNotificationToFrontend);
  },

  async createNotification(data: Partial<NotificationLog>): Promise<NotificationLog> {
    const dbData: any = {
      toAddress: data.to,
      subject: data.subject,
      template: data.template,
      relatedMaterialId: data.related?.materialId,
      relatedVersionId: data.related?.versionId,
      relatedRfcId: data.related?.rfcId,
      status: data.status,
    };
    const created = await postJson<any>("/api/notifications", dbData);
    return dbNotificationToFrontend(created);
  },

  async getRatings(): Promise<HelpfulRating[]> {
    return fetchJson<HelpfulRating[]>("/api/ratings");
  },

  async getRating(userId: string, materialId: string, date: string): Promise<HelpfulRating | null> {
    try {
      return await fetchJson<HelpfulRating>(
        `/api/ratings/check?userId=${encodeURIComponent(userId)}&materialId=${encodeURIComponent(materialId)}&date=${encodeURIComponent(date)}`
      );
    } catch {
      return null;
    }
  },

  async createRating(data: HelpfulRating): Promise<HelpfulRating> {
    return postJson<HelpfulRating>("/api/ratings", data);
  },

  async getEmailConfig(): Promise<EmailConfig | null> {
    return fetchJson<EmailConfig | null>("/api/email-config");
  },

  async updateEmailConfig(data: Partial<EmailConfig>): Promise<EmailConfig> {
    return putJson<EmailConfig>("/api/email-config", data);
  },

  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return fetchJson<EmailTemplate[]>("/api/email-templates");
  },

  async updateEmailTemplate(id: string, data: { subject?: string; body?: string }): Promise<EmailTemplate> {
    return patchJson<EmailTemplate>(`/api/email-templates/${id}`, data);
  },

  async getReviewPeriods(): Promise<any[]> {
    return fetchJson<any[]>("/api/policy/review-periods");
  },

  async updateReviewPeriod(id: string, data: any): Promise<any> {
    return patchJson<any>(`/api/policy/review-periods/${id}`, data);
  },

  async getRbacDefaults(): Promise<any[]> {
    return fetchJson<any[]>("/api/policy/rbac-defaults");
  },

  async updateRbacDefault(id: string, data: any): Promise<any> {
    return patchJson<any>(`/api/policy/rbac-defaults/${id}`, data);
  },

  async getAdConfig(): Promise<any> {
    return fetchJson<any>("/api/ad-config");
  },

  async updateAdConfig(data: any): Promise<any> {
    return putJson<any>("/api/ad-config", data);
  },

  async getAdSyncLog(): Promise<any[]> {
    return fetchJson<any[]>("/api/ad-sync-log");
  },

  async createAdSyncLog(data: any): Promise<any> {
    return postJson<any>("/api/ad-sync-log", data);
  },

  async getEffectiveVisGroups(): Promise<Record<string, string[]>> {
    const items = await fetchJson<any[]>("/api/effective-vis-groups");
    const map: Record<string, string[]> = {};
    items.forEach((item: any) => {
      map[item.materialId] = item.visibilityGroupIds;
    });
    return map;
  },

  async upsertEffectiveVisGroup(materialId: string, groupIds: string[]): Promise<void> {
    await putJson(`/api/effective-vis-groups/${materialId}`, { visibilityGroupIds: groupIds });
  },

  async getNewHiresConfig(): Promise<{ enabled: boolean }> {
    return fetchJson<{ enabled: boolean }>("/api/new-hires/config");
  },

  async updateNewHiresConfig(data: { enabled: boolean }): Promise<{ enabled: boolean }> {
    return putJson<{ enabled: boolean }>("/api/new-hires/config", data);
  },

  async getNewHireProfiles(): Promise<NewHireProfile[]> {
    return fetchJson<NewHireProfile[]>("/api/new-hires/profiles");
  },

  async createNewHireProfile(data: { userId: string; source: string; status: string }): Promise<NewHireProfile> {
    return postJson<NewHireProfile>("/api/new-hires/profiles", data);
  },

  async updateNewHireProfile(id: string, data: { status?: string }): Promise<NewHireProfile> {
    return patchJson<NewHireProfile>(`/api/new-hires/profiles/${id}`, data);
  },

  async getNewHireAssignments(): Promise<NewHireAssignment[]> {
    return fetchJson<NewHireAssignment[]>("/api/new-hires/assignments");
  },

  async getNewHireAssignmentsByUser(userId: string): Promise<NewHireAssignment[]> {
    return fetchJson<NewHireAssignment[]>(`/api/new-hires/assignments/user/${userId}`);
  },

  async createNewHireAssignment(data: { userId: string; materialId: string; assignedBy: string; batchId: string }): Promise<NewHireAssignment> {
    return postJson<NewHireAssignment>("/api/new-hires/assignments", data);
  },

  async acknowledgeAssignment(assignmentId: string, versionId: string): Promise<NewHireAssignment> {
    return patchJson<NewHireAssignment>(`/api/new-hires/assignments/${assignmentId}/acknowledge`, { acknowledgedVersionId: versionId });
  },
};
