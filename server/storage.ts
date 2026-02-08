import { eq, and, desc, gte, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";

export interface IStorage {
  getUsers(): Promise<schema.User[]>;
  getUser(id: string): Promise<schema.User | undefined>;
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
}

export class DatabaseStorage implements IStorage {
  async getUsers(): Promise<schema.User[]> {
    return db.select().from(schema.users);
  }

  async getUser(id: string): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
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
    const [version] = await db.insert(schema.materialVersions).values(data).returning();
    return version;
  }

  async updateMaterialVersion(id: string, data: Partial<schema.InsertMaterialVersion>): Promise<schema.MaterialVersion | undefined> {
    const [version] = await db.update(schema.materialVersions).set(data).where(eq(schema.materialVersions.id, id)).returning();
    return version;
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
}

export const storage = new DatabaseStorage();
