import { eq, and, desc, gte, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";

export interface IStorage {
  getUsers(): Promise<schema.User[]>;
  getUser(id: string): Promise<schema.User | undefined>;
  getUserByUsername(username: string): Promise<schema.User | undefined>;
  createUser(data: schema.InsertUser): Promise<schema.User>;
  updateUser(id: string, data: Partial<schema.InsertUser>): Promise<schema.User | undefined>;

  getCatalogNodes(): Promise<schema.CatalogNode[]>;
  getCatalogNode(id: string): Promise<schema.CatalogNode | undefined>;
  createCatalogNode(data: schema.InsertCatalogNode): Promise<schema.CatalogNode>;
  updateCatalogNode(id: string, data: Partial<schema.InsertCatalogNode>): Promise<schema.CatalogNode | undefined>;
  deleteCatalogNode(id: string): Promise<boolean>;

  getVisibilityGroups(): Promise<schema.VisibilityGroup[]>;
  getVisibilityGroup(id: string): Promise<schema.VisibilityGroup | undefined>;
  createVisibilityGroup(data: schema.InsertVisibilityGroup): Promise<schema.VisibilityGroup>;
  updateVisibilityGroup(id: string, data: Partial<schema.InsertVisibilityGroup>): Promise<schema.VisibilityGroup | undefined>;
  deleteVisibilityGroup(id: string): Promise<boolean>;

  getMaterialVersions(): Promise<schema.MaterialVersion[]>;
  getMaterialVersion(id: string): Promise<schema.MaterialVersion | undefined>;
  getMaterialVersionsByMaterialId(materialId: string): Promise<schema.MaterialVersion[]>;
  createMaterialVersion(data: schema.InsertMaterialVersion): Promise<schema.MaterialVersion>;
  updateMaterialVersion(id: string, data: Partial<schema.InsertMaterialVersion>): Promise<schema.MaterialVersion | undefined>;
  deleteMaterialByMaterialId(materialId: string): Promise<boolean>;

  getSubscribers(materialId: string): Promise<schema.MaterialSubscriber[]>;
  addSubscriber(data: schema.InsertMaterialSubscriber): Promise<schema.MaterialSubscriber>;
  removeSubscriber(materialId: string, userId: string): Promise<boolean>;
  getSubscriptionsByUser(userId: string): Promise<schema.MaterialSubscriber[]>;
  removeSubscribersByMaterialAndUsers(materialId: string, userIds: string[]): Promise<void>;

  getAuditViews(materialId: string): Promise<schema.AuditView[]>;
  createAuditView(data: schema.InsertAuditView): Promise<schema.AuditView>;

  getRecentViewLog(materialId: string, userId: string, minutesAgo: number): Promise<schema.ViewLog[]>;
  createViewLog(data: schema.InsertViewLog): Promise<schema.ViewLog>;

  getRfcs(): Promise<schema.Rfc[]>;
  getRfc(id: string): Promise<schema.Rfc | undefined>;
  getRfcsByMaterialId(materialId: string): Promise<schema.Rfc[]>;
  createRfc(data: schema.InsertRfc): Promise<schema.Rfc>;
  updateRfc(id: string, data: Partial<schema.InsertRfc>): Promise<schema.Rfc | undefined>;

  getRfcComments(rfcId: string): Promise<schema.RfcComment[]>;
  createRfcComment(data: schema.InsertRfcComment): Promise<schema.RfcComment>;

  getNotifications(): Promise<schema.NotificationLog[]>;
  createNotification(data: schema.InsertNotificationLog): Promise<schema.NotificationLog>;

  getRatings(): Promise<schema.HelpfulRating[]>;
  getRatingsByMaterial(materialId: string): Promise<schema.HelpfulRating[]>;
  getRating(userId: string, materialId: string, date: string): Promise<schema.HelpfulRating | undefined>;
  createRating(data: schema.InsertHelpfulRating): Promise<schema.HelpfulRating>;

  getEmailConfig(): Promise<schema.EmailConfig | undefined>;
  upsertEmailConfig(data: schema.InsertEmailConfig): Promise<schema.EmailConfig>;
  updateEmailConfig(id: string, data: Partial<schema.InsertEmailConfig>): Promise<schema.EmailConfig | undefined>;

  getEmailTemplates(): Promise<schema.EmailTemplate[]>;
  getEmailTemplateByKey(key: string): Promise<schema.EmailTemplate | undefined>;
  createEmailTemplate(data: schema.InsertEmailTemplate): Promise<schema.EmailTemplate>;
  updateEmailTemplate(id: string, data: Partial<schema.InsertEmailTemplate>): Promise<schema.EmailTemplate | undefined>;

  getPolicyReviewPeriods(): Promise<schema.PolicyReviewPeriod[]>;
  createPolicyReviewPeriod(data: schema.InsertPolicyReviewPeriod): Promise<schema.PolicyReviewPeriod>;
  updatePolicyReviewPeriod(id: string, data: Partial<schema.InsertPolicyReviewPeriod>): Promise<schema.PolicyReviewPeriod | undefined>;

  getPolicyRbacDefaults(): Promise<schema.PolicyRbacDefault[]>;
  createPolicyRbacDefault(data: schema.InsertPolicyRbacDefault): Promise<schema.PolicyRbacDefault>;
  updatePolicyRbacDefault(id: string, data: Partial<schema.InsertPolicyRbacDefault>): Promise<schema.PolicyRbacDefault | undefined>;
  getPolicyRbacDefaultByKey(key: string): Promise<schema.PolicyRbacDefault | undefined>;

  getAdIntegrationConfig(): Promise<schema.AdIntegrationConfig | undefined>;
  upsertAdIntegrationConfig(data: schema.InsertAdIntegrationConfig): Promise<schema.AdIntegrationConfig>;
  updateAdIntegrationConfig(id: string, data: Partial<schema.InsertAdIntegrationConfig>): Promise<schema.AdIntegrationConfig | undefined>;

  getAdSyncLogs(): Promise<schema.AdSyncLog[]>;
  createAdSyncLog(data: schema.InsertAdSyncLog): Promise<schema.AdSyncLog>;

  getEffectiveVisGroupMap(): Promise<schema.EffectiveVisGroupMap[]>;
  upsertEffectiveVisGroupMap(materialId: string, visibilityGroupIds: string[]): Promise<schema.EffectiveVisGroupMap>;
  deleteEffectiveVisGroupMap(materialId: string): Promise<boolean>;

  getNewHiresConfig(): Promise<schema.NewHiresConfig | undefined>;
  upsertNewHiresConfig(data: schema.InsertNewHiresConfig): Promise<schema.NewHiresConfig>;

  getNewHireProfiles(): Promise<schema.NewHireProfile[]>;
  getNewHireProfile(id: string): Promise<schema.NewHireProfile | undefined>;
  getNewHireProfileByUserId(userId: string): Promise<schema.NewHireProfile | undefined>;
  createNewHireProfile(data: schema.InsertNewHireProfile): Promise<schema.NewHireProfile>;
  updateNewHireProfile(id: string, data: Partial<schema.InsertNewHireProfile>): Promise<schema.NewHireProfile | undefined>;

  getNewHireAssignments(): Promise<schema.NewHireAssignment[]>;
  getNewHireAssignmentsByUser(userId: string): Promise<schema.NewHireAssignment[]>;
  getNewHireAssignment(id: string): Promise<schema.NewHireAssignment | undefined>;
  createNewHireAssignment(data: schema.InsertNewHireAssignment): Promise<schema.NewHireAssignment>;
  updateNewHireAssignment(id: string, data: Partial<{ acknowledgedAt: Date; acknowledgedVersionId: string }>): Promise<schema.NewHireAssignment | undefined>;

  getAiSettings(): Promise<schema.AiSettings | undefined>;
  upsertAiSettings(data: schema.InsertAiSettings): Promise<schema.AiSettings>;

  createAiQueryLog(data: schema.InsertAiQueryLog): Promise<schema.AiQueryLog>;
  getAiQueryLogs(limit?: number): Promise<schema.AiQueryLog[]>;

  createAiChatSession(userId: string, title: string): Promise<schema.AiChatSession>;
  getAiChatSessions(userId: string): Promise<schema.AiChatSession[]>;
  getAiChatSession(id: string): Promise<schema.AiChatSession | undefined>;
  touchAiChatSession(id: string): Promise<void>;
  deleteAiChatSession(id: string): Promise<boolean>;
  createAiChatMessage(data: schema.InsertAiChatMessage): Promise<schema.AiChatMessage>;
  getAiChatMessages(sessionId: string): Promise<schema.AiChatMessage[]>;

  getPublishedMaterialVersionsLight(): Promise<Array<{
    id: string;
    materialId: string;
    status: string;
    title: string;
    contentKind: string;
    contentFile: unknown;
    contentPage: unknown;
    visibilityGroupIds: string[];
  }>>;

  searchPublishedMaterialsByQuery(query: string): Promise<Array<{
    id: string;
    materialId: string;
    title: string;
    contentKind: string;
    contentFile: unknown;
    contentPage: unknown;
    visibilityGroupIds: string[];
    rank: number;
  }>>;

  createSession(userId: string): Promise<string>;
  getSessionUser(token: string): Promise<schema.User | undefined>;
  deleteSession(token: string): Promise<void>;
}

function extractTextForSearch(data: {
  contentKind: string;
  contentPage?: unknown;
  contentFile?: unknown;
}): string {
  if ((data.contentKind === "page" || data.contentKind === "html") && data.contentPage) {
    return ((data.contentPage as any).html || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200000);
  }
  if (data.contentKind === "file" && data.contentFile) {
    return ((data.contentFile as any).extractedText || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200000);
  }
  return "";
}

export class DatabaseStorage implements IStorage {
  async getUsers(): Promise<schema.User[]> {
    return db.select().from(schema.users);
  }

  async getUser(id: string): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user;
  }

  async createUser(data: schema.InsertUser): Promise<schema.User> {
    const [user] = await db.insert(schema.users).values(data).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<schema.InsertUser>): Promise<schema.User | undefined> {
    const [user] = await db.update(schema.users).set(data).where(eq(schema.users.id, id)).returning();
    return user;
  }

  async getCatalogNodes(): Promise<schema.CatalogNode[]> {
    return db.select().from(schema.catalogNodes);
  }

  async getCatalogNode(id: string): Promise<schema.CatalogNode | undefined> {
    const [node] = await db.select().from(schema.catalogNodes).where(eq(schema.catalogNodes.id, id));
    return node;
  }

  async createCatalogNode(data: schema.InsertCatalogNode): Promise<schema.CatalogNode> {
    const [node] = await db.insert(schema.catalogNodes).values(data).returning();
    return node;
  }

  async updateCatalogNode(id: string, data: Partial<schema.InsertCatalogNode>): Promise<schema.CatalogNode | undefined> {
    const [node] = await db.update(schema.catalogNodes).set(data).where(eq(schema.catalogNodes.id, id)).returning();
    return node;
  }

  async deleteCatalogNode(id: string): Promise<boolean> {
    const result = await db.delete(schema.catalogNodes).where(eq(schema.catalogNodes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getVisibilityGroups(): Promise<schema.VisibilityGroup[]> {
    return db.select().from(schema.visibilityGroups);
  }

  async getVisibilityGroup(id: string): Promise<schema.VisibilityGroup | undefined> {
    const [group] = await db.select().from(schema.visibilityGroups).where(eq(schema.visibilityGroups.id, id));
    return group;
  }

  async createVisibilityGroup(data: schema.InsertVisibilityGroup): Promise<schema.VisibilityGroup> {
    const [group] = await db.insert(schema.visibilityGroups).values(data).returning();
    return group;
  }

  async updateVisibilityGroup(id: string, data: Partial<schema.InsertVisibilityGroup>): Promise<schema.VisibilityGroup | undefined> {
    const [group] = await db.update(schema.visibilityGroups).set(data).where(eq(schema.visibilityGroups.id, id)).returning();
    return group;
  }

  async deleteVisibilityGroup(id: string): Promise<boolean> {
    const result = await db.delete(schema.visibilityGroups).where(eq(schema.visibilityGroups.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getMaterialVersions(): Promise<schema.MaterialVersion[]> {
    return db.select().from(schema.materialVersions);
  }

  async getMaterialVersion(id: string): Promise<schema.MaterialVersion | undefined> {
    const [version] = await db.select().from(schema.materialVersions).where(eq(schema.materialVersions.id, id));
    return version;
  }

  async getMaterialVersionsByMaterialId(materialId: string): Promise<schema.MaterialVersion[]> {
    return db.select().from(schema.materialVersions).where(eq(schema.materialVersions.materialId, materialId)).orderBy(desc(schema.materialVersions.createdAt));
  }

  async createMaterialVersion(data: schema.InsertMaterialVersion): Promise<schema.MaterialVersion> {
    const searchText = extractTextForSearch(data);
    const [version] = await db.insert(schema.materialVersions).values({ ...data, searchText }).returning();
    return version;
  }

  async updateMaterialVersion(id: string, data: Partial<schema.InsertMaterialVersion>): Promise<schema.MaterialVersion | undefined> {
    const payload: Partial<schema.InsertMaterialVersion> & { searchText?: string } = { ...data };
    if (data.contentKind !== undefined || data.contentPage !== undefined || data.contentFile !== undefined) {
      const existing = await this.getMaterialVersion(id);
      if (existing) {
        const merged = {
          contentKind: data.contentKind ?? existing.contentKind,
          contentPage: data.contentPage ?? existing.contentPage,
          contentFile: data.contentFile ?? existing.contentFile,
        };
        payload.searchText = extractTextForSearch(merged);
      }
    }
    const [version] = await db.update(schema.materialVersions).set(payload).where(eq(schema.materialVersions.id, id)).returning();
    return version;
  }

  async deleteMaterialByMaterialId(materialId: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // Delete RFC comments for all RFCs of this material
      const matRfcs = await tx.select({ id: schema.rfcs.id }).from(schema.rfcs).where(eq(schema.rfcs.materialId, materialId));
      if (matRfcs.length > 0) {
        const rfcIds = matRfcs.map(r => r.id);
        await tx.delete(schema.rfcComments).where(inArray(schema.rfcComments.rfcId, rfcIds));
      }
      // Delete all related records
      await tx.delete(schema.materialSubscribers).where(eq(schema.materialSubscribers.materialId, materialId));
      await tx.delete(schema.auditViews).where(eq(schema.auditViews.materialId, materialId));
      await tx.delete(schema.viewLog).where(eq(schema.viewLog.materialId, materialId));
      await tx.delete(schema.rfcs).where(eq(schema.rfcs.materialId, materialId));
      await tx.delete(schema.helpfulRatings).where(eq(schema.helpfulRatings.materialId, materialId));
      await tx.delete(schema.effectiveVisGroupMap).where(eq(schema.effectiveVisGroupMap.materialId, materialId));
      await tx.delete(schema.newHireAssignments).where(eq(schema.newHireAssignments.materialId, materialId));
      // Delete all versions
      const result = await tx.delete(schema.materialVersions).where(eq(schema.materialVersions.materialId, materialId));
      return (result.rowCount ?? 0) > 0;
    });
  }

  async getSubscribers(materialId: string): Promise<schema.MaterialSubscriber[]> {
    return db.select().from(schema.materialSubscribers).where(eq(schema.materialSubscribers.materialId, materialId));
  }

  async addSubscriber(data: schema.InsertMaterialSubscriber): Promise<schema.MaterialSubscriber> {
    const [sub] = await db.insert(schema.materialSubscribers).values(data).returning();
    return sub;
  }

  async removeSubscriber(materialId: string, userId: string): Promise<boolean> {
    const result = await db.delete(schema.materialSubscribers).where(
      and(eq(schema.materialSubscribers.materialId, materialId), eq(schema.materialSubscribers.userId, userId))
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getSubscriptionsByUser(userId: string): Promise<schema.MaterialSubscriber[]> {
    return db.select().from(schema.materialSubscribers).where(eq(schema.materialSubscribers.userId, userId));
  }

  async removeSubscribersByMaterialAndUsers(materialId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await db.delete(schema.materialSubscribers).where(
      and(eq(schema.materialSubscribers.materialId, materialId), inArray(schema.materialSubscribers.userId, userIds))
    );
  }

  async getAuditViews(materialId: string): Promise<schema.AuditView[]> {
    return db.select().from(schema.auditViews).where(eq(schema.auditViews.materialId, materialId)).orderBy(desc(schema.auditViews.viewedAt));
  }

  async createAuditView(data: schema.InsertAuditView): Promise<schema.AuditView> {
    const [view] = await db.insert(schema.auditViews).values(data).returning();
    return view;
  }

  async getRecentViewLog(materialId: string, userId: string, minutesAgo: number): Promise<schema.ViewLog[]> {
    const threshold = new Date(Date.now() - minutesAgo * 60 * 1000);
    return db.select().from(schema.viewLog).where(
      and(
        eq(schema.viewLog.materialId, materialId),
        eq(schema.viewLog.userId, userId),
        gte(schema.viewLog.viewedAt, threshold)
      )
    );
  }

  async createViewLog(data: schema.InsertViewLog): Promise<schema.ViewLog> {
    const [log] = await db.insert(schema.viewLog).values(data).returning();
    return log;
  }

  async getRfcs(): Promise<schema.Rfc[]> {
    return db.select().from(schema.rfcs).orderBy(desc(schema.rfcs.createdAt));
  }

  async getRfc(id: string): Promise<schema.Rfc | undefined> {
    const [rfc] = await db.select().from(schema.rfcs).where(eq(schema.rfcs.id, id));
    return rfc;
  }

  async getRfcsByMaterialId(materialId: string): Promise<schema.Rfc[]> {
    return db.select().from(schema.rfcs).where(eq(schema.rfcs.materialId, materialId)).orderBy(desc(schema.rfcs.createdAt));
  }

  async createRfc(data: schema.InsertRfc): Promise<schema.Rfc> {
    const [rfc] = await db.insert(schema.rfcs).values(data).returning();
    return rfc;
  }

  async updateRfc(id: string, data: Partial<schema.InsertRfc>): Promise<schema.Rfc | undefined> {
    const [rfc] = await db.update(schema.rfcs).set(data).where(eq(schema.rfcs.id, id)).returning();
    return rfc;
  }

  async getRfcComments(rfcId: string): Promise<schema.RfcComment[]> {
    return db.select().from(schema.rfcComments).where(eq(schema.rfcComments.rfcId, rfcId)).orderBy(desc(schema.rfcComments.createdAt));
  }

  async createRfcComment(data: schema.InsertRfcComment): Promise<schema.RfcComment> {
    const [comment] = await db.insert(schema.rfcComments).values(data).returning();
    return comment;
  }

  async getNotifications(): Promise<schema.NotificationLog[]> {
    return db.select().from(schema.notificationLog).orderBy(desc(schema.notificationLog.createdAt));
  }

  async createNotification(data: schema.InsertNotificationLog): Promise<schema.NotificationLog> {
    const [notification] = await db.insert(schema.notificationLog).values(data).returning();
    return notification;
  }

  async getRatings(): Promise<schema.HelpfulRating[]> {
    return db.select().from(schema.helpfulRatings);
  }

  async getRatingsByMaterial(materialId: string): Promise<schema.HelpfulRating[]> {
    return db.select().from(schema.helpfulRatings).where(eq(schema.helpfulRatings.materialId, materialId));
  }

  async getRating(userId: string, materialId: string, date: string): Promise<schema.HelpfulRating | undefined> {
    const [rating] = await db.select().from(schema.helpfulRatings).where(
      and(
        eq(schema.helpfulRatings.userId, userId),
        eq(schema.helpfulRatings.materialId, materialId),
        eq(schema.helpfulRatings.date, date)
      )
    );
    return rating;
  }

  async createRating(data: schema.InsertHelpfulRating): Promise<schema.HelpfulRating> {
    const [rating] = await db.insert(schema.helpfulRatings).values(data).returning();
    return rating;
  }

  async getEmailConfig(): Promise<schema.EmailConfig | undefined> {
    const [config] = await db.select().from(schema.emailConfig);
    return config;
  }

  async upsertEmailConfig(data: schema.InsertEmailConfig): Promise<schema.EmailConfig> {
    const existing = await this.getEmailConfig();
    if (existing) {
      const [updated] = await db.update(schema.emailConfig).set(data).where(eq(schema.emailConfig.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(schema.emailConfig).values(data).returning();
    return created;
  }

  async updateEmailConfig(id: string, data: Partial<schema.InsertEmailConfig>): Promise<schema.EmailConfig | undefined> {
    const [config] = await db.update(schema.emailConfig).set(data).where(eq(schema.emailConfig.id, id)).returning();
    return config;
  }

  async getEmailTemplates(): Promise<schema.EmailTemplate[]> {
    return db.select().from(schema.emailTemplates);
  }

  async getEmailTemplateByKey(key: string): Promise<schema.EmailTemplate | undefined> {
    const [template] = await db.select().from(schema.emailTemplates).where(eq(schema.emailTemplates.key, key));
    return template;
  }

  async createEmailTemplate(data: schema.InsertEmailTemplate): Promise<schema.EmailTemplate> {
    const [template] = await db.insert(schema.emailTemplates).values(data).returning();
    return template;
  }

  async updateEmailTemplate(id: string, data: Partial<schema.InsertEmailTemplate>): Promise<schema.EmailTemplate | undefined> {
    const [template] = await db.update(schema.emailTemplates).set(data).where(eq(schema.emailTemplates.id, id)).returning();
    return template;
  }

  async getPolicyReviewPeriods(): Promise<schema.PolicyReviewPeriod[]> {
    return db.select().from(schema.policyReviewPeriods);
  }

  async createPolicyReviewPeriod(data: schema.InsertPolicyReviewPeriod): Promise<schema.PolicyReviewPeriod> {
    const [period] = await db.insert(schema.policyReviewPeriods).values(data).returning();
    return period;
  }

  async updatePolicyReviewPeriod(id: string, data: Partial<schema.InsertPolicyReviewPeriod>): Promise<schema.PolicyReviewPeriod | undefined> {
    const [period] = await db.update(schema.policyReviewPeriods).set(data).where(eq(schema.policyReviewPeriods.id, id)).returning();
    return period;
  }

  async getPolicyRbacDefaults(): Promise<schema.PolicyRbacDefault[]> {
    return db.select().from(schema.policyRbacDefaults);
  }

  async createPolicyRbacDefault(data: schema.InsertPolicyRbacDefault): Promise<schema.PolicyRbacDefault> {
    const [rbac] = await db.insert(schema.policyRbacDefaults).values(data).returning();
    return rbac;
  }

  async updatePolicyRbacDefault(id: string, data: Partial<schema.InsertPolicyRbacDefault>): Promise<schema.PolicyRbacDefault | undefined> {
    const [rbac] = await db.update(schema.policyRbacDefaults).set(data).where(eq(schema.policyRbacDefaults.id, id)).returning();
    return rbac;
  }

  async getPolicyRbacDefaultByKey(key: string): Promise<schema.PolicyRbacDefault | undefined> {
    const [rbac] = await db.select().from(schema.policyRbacDefaults).where(eq(schema.policyRbacDefaults.key, key));
    return rbac;
  }

  async getAdIntegrationConfig(): Promise<schema.AdIntegrationConfig | undefined> {
    const [config] = await db.select().from(schema.adIntegrationConfig);
    return config;
  }

  async upsertAdIntegrationConfig(data: schema.InsertAdIntegrationConfig): Promise<schema.AdIntegrationConfig> {
    const existing = await this.getAdIntegrationConfig();
    if (existing) {
      const [updated] = await db.update(schema.adIntegrationConfig).set(data).where(eq(schema.adIntegrationConfig.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(schema.adIntegrationConfig).values(data).returning();
    return created;
  }

  async updateAdIntegrationConfig(id: string, data: Partial<schema.InsertAdIntegrationConfig>): Promise<schema.AdIntegrationConfig | undefined> {
    const [config] = await db.update(schema.adIntegrationConfig).set(data).where(eq(schema.adIntegrationConfig.id, id)).returning();
    return config;
  }

  async getAdSyncLogs(): Promise<schema.AdSyncLog[]> {
    return db.select().from(schema.adSyncLog).orderBy(desc(schema.adSyncLog.syncedAt));
  }

  async createAdSyncLog(data: schema.InsertAdSyncLog): Promise<schema.AdSyncLog> {
    const [log] = await db.insert(schema.adSyncLog).values(data).returning();
    return log;
  }

  async getEffectiveVisGroupMap(): Promise<schema.EffectiveVisGroupMap[]> {
    return db.select().from(schema.effectiveVisGroupMap);
  }

  async upsertEffectiveVisGroupMap(materialId: string, visibilityGroupIds: string[]): Promise<schema.EffectiveVisGroupMap> {
    const [existing] = await db.select().from(schema.effectiveVisGroupMap).where(eq(schema.effectiveVisGroupMap.materialId, materialId));
    if (existing) {
      const [updated] = await db.update(schema.effectiveVisGroupMap).set({ visibilityGroupIds }).where(eq(schema.effectiveVisGroupMap.materialId, materialId)).returning();
      return updated;
    }
    const [created] = await db.insert(schema.effectiveVisGroupMap).values({ materialId, visibilityGroupIds }).returning();
    return created;
  }

  async deleteEffectiveVisGroupMap(materialId: string): Promise<boolean> {
    const result = await db.delete(schema.effectiveVisGroupMap).where(eq(schema.effectiveVisGroupMap.materialId, materialId));
    return (result.rowCount ?? 0) > 0;
  }

  async getNewHiresConfig(): Promise<schema.NewHiresConfig | undefined> {
    const [config] = await db.select().from(schema.newHiresConfig);
    return config;
  }

  async upsertNewHiresConfig(data: schema.InsertNewHiresConfig): Promise<schema.NewHiresConfig> {
    const existing = await this.getNewHiresConfig();
    if (existing) {
      const [updated] = await db.update(schema.newHiresConfig).set(data).where(eq(schema.newHiresConfig.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(schema.newHiresConfig).values(data).returning();
    return created;
  }

  async getNewHireProfiles(): Promise<schema.NewHireProfile[]> {
    return db.select().from(schema.newHireProfiles);
  }

  async getNewHireProfile(id: string): Promise<schema.NewHireProfile | undefined> {
    const [profile] = await db.select().from(schema.newHireProfiles).where(eq(schema.newHireProfiles.id, id));
    return profile;
  }

  async getNewHireProfileByUserId(userId: string): Promise<schema.NewHireProfile | undefined> {
    const [profile] = await db.select().from(schema.newHireProfiles).where(eq(schema.newHireProfiles.userId, userId));
    return profile;
  }

  async createNewHireProfile(data: schema.InsertNewHireProfile): Promise<schema.NewHireProfile> {
    const [profile] = await db.insert(schema.newHireProfiles).values(data).returning();
    return profile;
  }

  async updateNewHireProfile(id: string, data: Partial<schema.InsertNewHireProfile>): Promise<schema.NewHireProfile | undefined> {
    const [profile] = await db.update(schema.newHireProfiles).set(data).where(eq(schema.newHireProfiles.id, id)).returning();
    return profile;
  }

  async getNewHireAssignments(): Promise<schema.NewHireAssignment[]> {
    return db.select().from(schema.newHireAssignments);
  }

  async getNewHireAssignmentsByUser(userId: string): Promise<schema.NewHireAssignment[]> {
    return db.select().from(schema.newHireAssignments).where(eq(schema.newHireAssignments.userId, userId));
  }

  async getNewHireAssignment(id: string): Promise<schema.NewHireAssignment | undefined> {
    const [assignment] = await db.select().from(schema.newHireAssignments).where(eq(schema.newHireAssignments.id, id));
    return assignment;
  }

  async createNewHireAssignment(data: schema.InsertNewHireAssignment): Promise<schema.NewHireAssignment> {
    const [assignment] = await db.insert(schema.newHireAssignments).values(data).returning();
    return assignment;
  }

  async updateNewHireAssignment(id: string, data: Partial<{ acknowledgedAt: Date; acknowledgedVersionId: string }>): Promise<schema.NewHireAssignment | undefined> {
    const [assignment] = await db.update(schema.newHireAssignments).set(data).where(eq(schema.newHireAssignments.id, id)).returning();
    return assignment;
  }

  async getAiSettings(): Promise<schema.AiSettings | undefined> {
    const [settings] = await db.select().from(schema.aiSettings);
    return settings;
  }

  async upsertAiSettings(data: schema.InsertAiSettings): Promise<schema.AiSettings> {
    const existing = await this.getAiSettings();
    if (existing) {
      const [updated] = await db
        .update(schema.aiSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.aiSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(schema.aiSettings).values(data).returning();
    return created;
  }

  async createAiQueryLog(data: schema.InsertAiQueryLog): Promise<schema.AiQueryLog> {
    const [entry] = await db.insert(schema.aiQueryLog).values(data).returning();
    return entry;
  }

  async getAiQueryLogs(limit: number = 200): Promise<schema.AiQueryLog[]> {
    return db.select().from(schema.aiQueryLog).orderBy(desc(schema.aiQueryLog.createdAt)).limit(limit);
  }

  async getPublishedMaterialVersionsLight(): Promise<Array<{
    id: string;
    materialId: string;
    status: string;
    title: string;
    contentKind: string;
    contentFile: unknown;
    contentPage: unknown;
    visibilityGroupIds: string[];
  }>> {
    return db.select({
      id: schema.materialVersions.id,
      materialId: schema.materialVersions.materialId,
      status: schema.materialVersions.status,
      title: schema.materialVersions.title,
      contentKind: schema.materialVersions.contentKind,
      contentFile: schema.materialVersions.contentFile,
      contentPage: schema.materialVersions.contentPage,
      visibilityGroupIds: schema.materialVersions.visibilityGroupIds,
    }).from(schema.materialVersions).where(eq(schema.materialVersions.status, "Опубликовано"));
  }

  async searchPublishedMaterialsByQuery(query: string): Promise<Array<{
    id: string;
    materialId: string;
    title: string;
    contentKind: string;
    contentFile: unknown;
    contentPage: unknown;
    visibilityGroupIds: string[];
    rank: number;
  }>> {
    const tsVector = sql`
      setweight(to_tsvector('russian', coalesce(${schema.materialVersions.title}, '')), 'A') ||
      setweight(to_tsvector('russian', coalesce(${schema.materialVersions.searchText}, '')), 'B')
    `;
    const tsQuery = sql`plainto_tsquery('russian', ${query})`;
    const rows = await db.select({
      id: schema.materialVersions.id,
      materialId: schema.materialVersions.materialId,
      title: schema.materialVersions.title,
      contentKind: schema.materialVersions.contentKind,
      contentFile: schema.materialVersions.contentFile,
      contentPage: schema.materialVersions.contentPage,
      visibilityGroupIds: schema.materialVersions.visibilityGroupIds,
      rank: sql<number>`ts_rank_cd(${tsVector}, ${tsQuery})`,
    })
    .from(schema.materialVersions)
    .where(eq(schema.materialVersions.status, "Опубликовано"))
    .orderBy(sql`ts_rank_cd(${tsVector}, ${tsQuery}) DESC`);
    return rows;
  }

  async createAiChatSession(userId: string, title: string): Promise<schema.AiChatSession> {
    const [session] = await db.insert(schema.aiChatSessions).values({ userId, title }).returning();
    return session;
  }

  async getAiChatSessions(userId: string): Promise<schema.AiChatSession[]> {
    return db.select().from(schema.aiChatSessions)
      .where(eq(schema.aiChatSessions.userId, userId))
      .orderBy(desc(schema.aiChatSessions.updatedAt));
  }

  async getAiChatSession(id: string): Promise<schema.AiChatSession | undefined> {
    const [session] = await db.select().from(schema.aiChatSessions).where(eq(schema.aiChatSessions.id, id));
    return session;
  }

  async touchAiChatSession(id: string): Promise<void> {
    await db.update(schema.aiChatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(schema.aiChatSessions.id, id));
  }

  async deleteAiChatSession(id: string): Promise<boolean> {
    await db.delete(schema.aiChatMessages).where(eq(schema.aiChatMessages.sessionId, id));
    const result = await db.delete(schema.aiChatSessions).where(eq(schema.aiChatSessions.id, id)).returning();
    return result.length > 0;
  }

  async createAiChatMessage(data: schema.InsertAiChatMessage): Promise<schema.AiChatMessage> {
    const [msg] = await db.insert(schema.aiChatMessages).values(data).returning();
    return msg;
  }

  async getAiChatMessages(sessionId: string): Promise<schema.AiChatMessage[]> {
    return db.select().from(schema.aiChatMessages)
      .where(eq(schema.aiChatMessages.sessionId, sessionId))
      .orderBy(schema.aiChatMessages.createdAt);
  }

  async createSession(userId: string): Promise<string> {
    const { randomUUID } = await import("crypto");
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(schema.sessions).values({ token, userId, expiresAt });
    return token;
  }

  async getSessionUser(token: string): Promise<schema.User | undefined> {
    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.token, token));
    if (!session) return undefined;
    if (session.expiresAt < new Date()) {
      await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
      return undefined;
    }
    return this.getUser(session.userId);
  }

  async deleteSession(token: string): Promise<void> {
    await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
  }
}

export const storage = new DatabaseStorage();

export async function backfillSearchText(): Promise<void> {
  const { isNull, or } = await import("drizzle-orm");
  // Cover both NULL and empty string — page/html materials may have been saved before fix
  const rows = await db.select({
    id: schema.materialVersions.id,
    contentKind: schema.materialVersions.contentKind,
    contentPage: schema.materialVersions.contentPage,
    contentFile: schema.materialVersions.contentFile,
  }).from(schema.materialVersions).where(
    or(
      isNull(schema.materialVersions.searchText),
      eq(schema.materialVersions.searchText, ""),
    )
  );

  if (rows.length === 0) return;

  let updated = 0;
  for (const row of rows) {
    const searchText = extractTextForSearch(row);
    if (!searchText) continue; // skip if content genuinely empty
    await db.update(schema.materialVersions)
      .set({ searchText })
      .where(eq(schema.materialVersions.id, row.id));
    updated++;
  }
  if (updated > 0) {
    console.log(`[search] Backfilled searchText for ${updated} material version(s)`);
  }
}

const FEEDBACK_TEMPLATES = [
  {
    key: "report_error",
    label: "Сообщение об ошибке в инструкции",
    subject: "Ошибка в инструкции «{{title}}» — сообщение от {{reporter}}",
    body: "Уважаемый(ая) {{owner}},\n\nПользователь {{reporter}} сообщил об ошибке в инструкции «{{title}}».\n\nТекст сообщения:\n{{message}}\n\nСсылка на материал: {{link}}",
    description: "Отправляется автору и администратору, когда пользователь сообщает об ошибке в материале. Переменные: {{title}}, {{reporter}}, {{owner}}, {{message}}, {{link}}",
  },
  {
    key: "suggest_improvement",
    label: "Предложение по улучшению",
    subject: "Предложение по улучшению «{{title}}» от {{reporter}}",
    body: "Уважаемый(ая) {{owner}},\n\nПользователь {{reporter}} предлагает улучшение для инструкции «{{title}}».\n\nПредложение:\n{{message}}\n\nСсылка на материал: {{link}}",
    description: "Отправляется автору и администратору, когда пользователь предлагает улучшение материала. Переменные: {{title}}, {{reporter}}, {{owner}}, {{message}}, {{link}}",
  },
];

export async function ensureFeedbackTemplates() {
  const existing = await db.select({ key: schema.emailTemplates.key }).from(schema.emailTemplates);
  const existingKeys = new Set(existing.map((t) => t.key));
  const toInsert = FEEDBACK_TEMPLATES.filter((t) => !existingKeys.has(t.key));
  if (toInsert.length > 0) {
    await db.insert(schema.emailTemplates).values(toInsert);
    console.log(`[email] Ensured feedback templates: ${toInsert.map((t) => t.key).join(", ")}`);
  }
}
