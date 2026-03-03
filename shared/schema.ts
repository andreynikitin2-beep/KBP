import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
  roles: text("roles").array().notNull(),
  legalEntity: text("legal_entity").notNull(),
  department: text("department").notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  source: text("source").notNull(),
  adAccountName: text("ad_account_name"),
  lastSyncAt: timestamp("last_sync_at"),
  deactivatedAt: timestamp("deactivated_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const catalogNodes = pgTable("catalog_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: text("type").notNull(),
  parentId: varchar("parent_id"),
  allowedRoles: text("allowed_roles").array(),
  ownerIds: text("owner_ids").array(),
  defaultVisibilityGroupIds: text("default_visibility_group_ids").array(),
  sortOrder: integer("sort_order").default(0),
});

export const insertCatalogNodeSchema = createInsertSchema(catalogNodes).omit({ id: true });
export type InsertCatalogNode = z.infer<typeof insertCatalogNodeSchema>;
export type CatalogNode = typeof catalogNodes.$inferSelect;

export const visibilityGroups = pgTable("visibility_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  isSystem: boolean("is_system").default(false).notNull(),
  memberIds: text("member_ids").array().notNull(),
});

export const insertVisibilityGroupSchema = createInsertSchema(visibilityGroups).omit({ id: true });
export type InsertVisibilityGroup = z.infer<typeof insertVisibilityGroupSchema>;
export type VisibilityGroup = typeof visibilityGroups.$inferSelect;

export const materialVersions = pgTable("material_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: varchar("material_id").notNull(),
  version: text("version").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").notNull(),
  changelog: text("changelog"),
  status: text("status").notNull(),
  title: text("title").notNull(),
  purpose: text("purpose"),
  tags: text("tags").array().notNull(),
  tagGroups: jsonb("tag_groups").notNull(),
  criticality: text("criticality").notNull(),
  sectionId: varchar("section_id").notNull(),
  ownerId: varchar("owner_id"),
  deputyId: varchar("deputy_id"),
  legalEntity: text("legal_entity").notNull(),
  department: text("department"),
  requiredTraining: boolean("required_training").default(false).notNull(),
  relatedLinks: jsonb("related_links"),
  lastReviewedAt: timestamp("last_reviewed_at"),
  nextReviewAt: timestamp("next_review_at"),
  reviewPeriodDays: integer("review_period_days"),
  visibilityGroupIds: text("visibility_group_ids").array().notNull(),
  newHireRequired: boolean("new_hire_required").default(false).notNull(),
  contentKind: text("content_kind").notNull(),
  contentFile: jsonb("content_file"),
  contentPage: jsonb("content_page"),
  discussionsEnabled: boolean("discussions_enabled").default(true).notNull(),
  discussionVisibility: text("discussion_visibility").default("Все").notNull(),
  views: integer("views").default(0).notNull(),
  helpfulYes: integer("helpful_yes").default(0).notNull(),
  helpfulNo: integer("helpful_no").default(0).notNull(),
});

export const insertMaterialVersionSchema = createInsertSchema(materialVersions).omit({ id: true, createdAt: true, views: true, helpfulYes: true, helpfulNo: true });
export type InsertMaterialVersion = z.infer<typeof insertMaterialVersionSchema>;
export type MaterialVersion = typeof materialVersions.$inferSelect;

export const materialSubscribers = pgTable("material_subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: varchar("material_id").notNull(),
  userId: varchar("user_id").notNull(),
}, (table) => [
  uniqueIndex("material_subscribers_material_user_idx").on(table.materialId, table.userId),
]);

export const insertMaterialSubscriberSchema = createInsertSchema(materialSubscribers).omit({ id: true });
export type InsertMaterialSubscriber = z.infer<typeof insertMaterialSubscriberSchema>;
export type MaterialSubscriber = typeof materialSubscribers.$inferSelect;

export const auditViews = pgTable("audit_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: varchar("material_id").notNull(),
  userId: varchar("user_id").notNull(),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

export const insertAuditViewSchema = createInsertSchema(auditViews).omit({ id: true, viewedAt: true });
export type InsertAuditView = z.infer<typeof insertAuditViewSchema>;
export type AuditView = typeof auditViews.$inferSelect;

export const viewLog = pgTable("view_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: varchar("material_id").notNull(),
  userId: varchar("user_id").notNull(),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

export const insertViewLogSchema = createInsertSchema(viewLog).omit({ id: true, viewedAt: true });
export type InsertViewLog = z.infer<typeof insertViewLogSchema>;
export type ViewLog = typeof viewLog.$inferSelect;

export const rfcs = pgTable("rfcs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: varchar("material_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
  assignedTo: varchar("assigned_to").notNull(),
  slaReactedAt: timestamp("sla_reacted_at"),
  slaUpdatedAt: timestamp("sla_updated_at"),
});

export const insertRfcSchema = createInsertSchema(rfcs).omit({ id: true, createdAt: true });
export type InsertRfc = z.infer<typeof insertRfcSchema>;
export type Rfc = typeof rfcs.$inferSelect;

export const rfcComments = pgTable("rfc_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rfcId: varchar("rfc_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").notNull(),
  text: text("text").notNull(),
});

export const insertRfcCommentSchema = createInsertSchema(rfcComments).omit({ id: true, createdAt: true });
export type InsertRfcComment = z.infer<typeof insertRfcCommentSchema>;
export type RfcComment = typeof rfcComments.$inferSelect;

export const notificationLog = pgTable("notification_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  toAddress: text("to_address").notNull(),
  subject: text("subject").notNull(),
  template: text("template").notNull(),
  relatedMaterialId: varchar("related_material_id"),
  relatedVersionId: varchar("related_version_id"),
  relatedRfcId: varchar("related_rfc_id"),
  status: text("status").notNull(),
});

export const insertNotificationLogSchema = createInsertSchema(notificationLog).omit({ id: true, createdAt: true });
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLog = typeof notificationLog.$inferSelect;

export const helpfulRatings = pgTable("helpful_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  materialId: varchar("material_id").notNull(),
  date: text("date").notNull(),
  value: text("value").notNull(),
}, (table) => [
  uniqueIndex("helpful_ratings_user_material_date_idx").on(table.userId, table.materialId, table.date),
]);

export const insertHelpfulRatingSchema = createInsertSchema(helpfulRatings).omit({ id: true });
export type InsertHelpfulRating = z.infer<typeof insertHelpfulRatingSchema>;
export type HelpfulRating = typeof helpfulRatings.$inferSelect;

export const emailConfig = pgTable("email_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderAddress: text("sender_address").notNull(),
  senderName: text("sender_name").notNull(),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpUser: text("smtp_user").notNull(),
  smtpPassword: text("smtp_password").default("").notNull(),
  smtpUseTls: boolean("smtp_use_tls").default(true).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
});

export const insertEmailConfigSchema = createInsertSchema(emailConfig).omit({ id: true });
export type InsertEmailConfig = z.infer<typeof insertEmailConfigSchema>;
export type EmailConfig = typeof emailConfig.$inferSelect;

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  description: text("description").notNull(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true });
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

export const policyReviewPeriods = pgTable("policy_review_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  criticality: text("criticality").notNull().unique(),
  days: integer("days").notNull(),
  remindBeforeDays: integer("remind_before_days").array().notNull(),
  escalationAfterDays: integer("escalation_after_days").array().notNull(),
});

export const insertPolicyReviewPeriodSchema = createInsertSchema(policyReviewPeriods).omit({ id: true });
export type InsertPolicyReviewPeriod = z.infer<typeof insertPolicyReviewPeriodSchema>;
export type PolicyReviewPeriod = typeof policyReviewPeriods.$inferSelect;

export const policyRbacDefaults = pgTable("policy_rbac_defaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  roles: text("roles").array().notNull(),
});

export const insertPolicyRbacDefaultSchema = createInsertSchema(policyRbacDefaults).omit({ id: true });
export type InsertPolicyRbacDefault = z.infer<typeof insertPolicyRbacDefaultSchema>;
export type PolicyRbacDefault = typeof policyRbacDefaults.$inferSelect;

export const adIntegrationConfig = pgTable("ad_integration_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enabled: boolean("enabled").default(true).notNull(),
  mode: text("mode").notNull(),
  ssoUrl: text("sso_url").notNull(),
  bindDn: text("bind_dn").default("").notNull(),
  bindPassword: text("bind_password").default("").notNull(),
  baseDn: text("base_dn").default("").notNull(),
  syncFrequencyMinutes: integer("sync_frequency_minutes").default(60).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: text("sync_status").notNull(),
  syncedUsersCount: integer("synced_users_count").default(0).notNull(),
  deactivatedCount: integer("deactivated_count").default(0).notNull(),
  mappingRoles: text("mapping_roles"),
  mappingDepartment: text("mapping_department").default("department").notNull(),
  mappingLegalEntity: text("mapping_legal_entity").default("company").notNull(),
  mappingDisplayName: text("mapping_display_name").default("displayName").notNull(),
  mappingEmail: text("mapping_email").default("mail").notNull(),
});

export const insertAdIntegrationConfigSchema = createInsertSchema(adIntegrationConfig).omit({ id: true });
export type InsertAdIntegrationConfig = z.infer<typeof insertAdIntegrationConfigSchema>;
export type AdIntegrationConfig = typeof adIntegrationConfig.$inferSelect;

export const adSyncLog = pgTable("ad_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  status: text("status").notNull(),
  usersTotal: integer("users_total").notNull(),
  usersUpdated: integer("users_updated").notNull(),
  usersDeactivated: integer("users_deactivated").notNull(),
  message: text("message").notNull(),
});

export const insertAdSyncLogSchema = createInsertSchema(adSyncLog).omit({ id: true, syncedAt: true });
export type InsertAdSyncLog = z.infer<typeof insertAdSyncLogSchema>;
export type AdSyncLog = typeof adSyncLog.$inferSelect;

export const newHiresConfig = pgTable("new_hires_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enabled: boolean("enabled").default(false).notNull(),
});

export const insertNewHiresConfigSchema = createInsertSchema(newHiresConfig).omit({ id: true });
export type InsertNewHiresConfig = z.infer<typeof insertNewHiresConfigSchema>;
export type NewHiresConfig = typeof newHiresConfig.$inferSelect;

export const newHireProfiles = pgTable("new_hire_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  source: text("source").notNull(),
  status: text("status").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("new_hire_profiles_user_idx").on(table.userId),
]);

export const insertNewHireProfileSchema = createInsertSchema(newHireProfiles).omit({ id: true, addedAt: true });
export type InsertNewHireProfile = z.infer<typeof insertNewHireProfileSchema>;
export type NewHireProfile = typeof newHireProfiles.$inferSelect;

export const newHireAssignments = pgTable("new_hire_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  materialId: varchar("material_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  assignedBy: varchar("assigned_by").notNull(),
  batchId: varchar("batch_id").notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedVersionId: varchar("acknowledged_version_id"),
}, (table) => [
  uniqueIndex("new_hire_assignments_user_material_idx").on(table.userId, table.materialId),
]);

export const insertNewHireAssignmentSchema = createInsertSchema(newHireAssignments).omit({ id: true, assignedAt: true, acknowledgedAt: true, acknowledgedVersionId: true });
export type InsertNewHireAssignment = z.infer<typeof insertNewHireAssignmentSchema>;
export type NewHireAssignment = typeof newHireAssignments.$inferSelect;

export const effectiveVisGroupMap = pgTable("effective_vis_group_map", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: varchar("material_id").notNull().unique(),
  visibilityGroupIds: text("visibility_group_ids").array().notNull(),
});

export const insertEffectiveVisGroupMapSchema = createInsertSchema(effectiveVisGroupMap).omit({ id: true });
export type InsertEffectiveVisGroupMap = z.infer<typeof insertEffectiveVisGroupMapSchema>;
export type EffectiveVisGroupMap = typeof effectiveVisGroupMap.$inferSelect;
