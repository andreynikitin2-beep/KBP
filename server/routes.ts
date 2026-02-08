import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // USERS
  app.get("/api/users", async (_req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const user = await storage.createUser(req.body);
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // USER SUBSCRIPTIONS
  app.get("/api/users/:userId/subscriptions", async (req, res) => {
    try {
      const subs = await storage.getSubscriptionsByUser(req.params.userId);
      res.json(subs);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // CATALOG NODES
  app.get("/api/catalog-nodes", async (_req, res) => {
    try {
      const nodes = await storage.getCatalogNodes();
      res.json(nodes);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/catalog-nodes", async (req, res) => {
    try {
      const node = await storage.createCatalogNode(req.body);
      res.json(node);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/catalog-nodes/:id", async (req, res) => {
    try {
      const node = await storage.updateCatalogNode(req.params.id, req.body);
      if (!node) return res.status(404).json({ error: "Catalog node not found" });
      res.json(node);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/catalog-nodes/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCatalogNode(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Catalog node not found" });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // VISIBILITY GROUPS
  app.get("/api/visibility-groups", async (_req, res) => {
    try {
      const groups = await storage.getVisibilityGroups();
      res.json(groups);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/visibility-groups", async (req, res) => {
    try {
      const group = await storage.createVisibilityGroup(req.body);
      res.json(group);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/visibility-groups/:id", async (req, res) => {
    try {
      const group = await storage.updateVisibilityGroup(req.params.id, req.body);
      if (!group) return res.status(404).json({ error: "Visibility group not found" });
      res.json(group);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/visibility-groups/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteVisibilityGroup(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Visibility group not found" });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // MATERIAL VERSIONS
  app.get("/api/material-versions", async (_req, res) => {
    try {
      const versions = await storage.getMaterialVersions();
      res.json(versions);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/material-versions/:id", async (req, res) => {
    try {
      const version = await storage.getMaterialVersion(req.params.id);
      if (!version) return res.status(404).json({ error: "Material version not found" });
      res.json(version);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/material-versions", async (req, res) => {
    try {
      const version = await storage.createMaterialVersion(req.body);
      res.json(version);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/material-versions/:id", async (req, res) => {
    try {
      const version = await storage.updateMaterialVersion(req.params.id, req.body);
      if (!version) return res.status(404).json({ error: "Material version not found" });
      res.json(version);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // MATERIALS SUB-ROUTES
  app.get("/api/materials/:materialId/versions", async (req, res) => {
    try {
      const versions = await storage.getMaterialVersionsByMaterialId(req.params.materialId);
      res.json(versions);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/materials/:materialId/subscribers", async (req, res) => {
    try {
      const subs = await storage.getSubscribers(req.params.materialId);
      res.json(subs);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/materials/:materialId/subscribers", async (req, res) => {
    try {
      const sub = await storage.addSubscriber({ materialId: req.params.materialId, userId: req.body.userId });
      res.json(sub);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/materials/:materialId/subscribers/:userId", async (req, res) => {
    try {
      const removed = await storage.removeSubscriber(req.params.materialId, req.params.userId);
      if (!removed) return res.status(404).json({ error: "Subscriber not found" });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/materials/:materialId/audit-views", async (req, res) => {
    try {
      const views = await storage.getAuditViews(req.params.materialId);
      res.json(views);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/materials/:materialId/rfcs", async (req, res) => {
    try {
      const rfcs = await storage.getRfcsByMaterialId(req.params.materialId);
      res.json(rfcs);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/materials/:materialId/ratings", async (req, res) => {
    try {
      const ratings = await storage.getRatingsByMaterial(req.params.materialId);
      res.json(ratings);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // AUDIT VIEWS
  app.post("/api/audit-views", async (req, res) => {
    try {
      const view = await storage.createAuditView(req.body);
      res.json(view);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // VIEW LOG
  app.post("/api/view-log", async (req, res) => {
    try {
      const log = await storage.createViewLog(req.body);
      res.json(log);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/view-log/check", async (req, res) => {
    try {
      const { materialId, userId, minutes } = req.query;
      if (!materialId || !userId || !minutes) {
        return res.status(400).json({ error: "materialId, userId, and minutes query params are required" });
      }
      const logs = await storage.getRecentViewLog(
        materialId as string,
        userId as string,
        Number(minutes)
      );
      res.json(logs);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // RFCS
  app.get("/api/rfcs", async (_req, res) => {
    try {
      const rfcs = await storage.getRfcs();
      res.json(rfcs);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/rfcs/:id", async (req, res) => {
    try {
      const rfc = await storage.getRfc(req.params.id);
      if (!rfc) return res.status(404).json({ error: "RFC not found" });
      res.json(rfc);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/rfcs", async (req, res) => {
    try {
      const rfc = await storage.createRfc(req.body);
      res.json(rfc);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/rfcs/:id", async (req, res) => {
    try {
      const rfc = await storage.updateRfc(req.params.id, req.body);
      if (!rfc) return res.status(404).json({ error: "RFC not found" });
      res.json(rfc);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // RFC COMMENTS
  app.get("/api/rfcs/:rfcId/comments", async (req, res) => {
    try {
      const comments = await storage.getRfcComments(req.params.rfcId);
      res.json(comments);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/rfcs/:rfcId/comments", async (req, res) => {
    try {
      const comment = await storage.createRfcComment({ rfcId: req.params.rfcId, ...req.body });
      res.json(comment);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // NOTIFICATIONS
  app.get("/api/notifications", async (_req, res) => {
    try {
      const notifications = await storage.getNotifications();
      res.json(notifications);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const notification = await storage.createNotification(req.body);
      res.json(notification);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // HELPFUL RATINGS
  app.get("/api/ratings", async (_req, res) => {
    try {
      const ratings = await storage.getRatings();
      res.json(ratings);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/ratings/check", async (req, res) => {
    try {
      const { userId, materialId, date } = req.query;
      if (!userId || !materialId || !date) {
        return res.status(400).json({ error: "userId, materialId, and date query params are required" });
      }
      const rating = await storage.getRating(
        userId as string,
        materialId as string,
        date as string
      );
      if (!rating) return res.status(404).json({ error: "Rating not found" });
      res.json(rating);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/ratings", async (req, res) => {
    try {
      const rating = await storage.createRating(req.body);
      res.json(rating);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // EMAIL CONFIG
  app.get("/api/email-config", async (_req, res) => {
    try {
      const config = await storage.getEmailConfig();
      res.json(config || null);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.put("/api/email-config", async (req, res) => {
    try {
      const config = await storage.upsertEmailConfig(req.body);
      res.json(config);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // EMAIL TEMPLATES
  app.get("/api/email-templates", async (_req, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      res.json(templates);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/email-templates/:id", async (req, res) => {
    try {
      const template = await storage.updateEmailTemplate(req.params.id, req.body);
      if (!template) return res.status(404).json({ error: "Email template not found" });
      res.json(template);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // POLICY REVIEW PERIODS
  app.get("/api/policy/review-periods", async (_req, res) => {
    try {
      const periods = await storage.getPolicyReviewPeriods();
      res.json(periods);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/policy/review-periods/:id", async (req, res) => {
    try {
      const period = await storage.updatePolicyReviewPeriod(req.params.id, req.body);
      if (!period) return res.status(404).json({ error: "Policy review period not found" });
      res.json(period);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // POLICY RBAC DEFAULTS
  app.get("/api/policy/rbac-defaults", async (_req, res) => {
    try {
      const defaults = await storage.getPolicyRbacDefaults();
      res.json(defaults);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch("/api/policy/rbac-defaults/:id", async (req, res) => {
    try {
      const rbac = await storage.updatePolicyRbacDefault(req.params.id, req.body);
      if (!rbac) return res.status(404).json({ error: "Policy RBAC default not found" });
      res.json(rbac);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // AD INTEGRATION CONFIG
  app.get("/api/ad-config", async (_req, res) => {
    try {
      const config = await storage.getAdIntegrationConfig();
      res.json(config || null);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.put("/api/ad-config", async (req, res) => {
    try {
      const config = await storage.upsertAdIntegrationConfig(req.body);
      res.json(config);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // AD SYNC LOG
  app.get("/api/ad-sync-log", async (_req, res) => {
    try {
      const logs = await storage.getAdSyncLogs();
      res.json(logs);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/ad-sync-log", async (req, res) => {
    try {
      const log = await storage.createAdSyncLog(req.body);
      res.json(log);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // EFFECTIVE VIS GROUP MAP
  app.get("/api/effective-vis-groups", async (_req, res) => {
    try {
      const map = await storage.getEffectiveVisGroupMap();
      res.json(map);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.put("/api/effective-vis-groups/:materialId", async (req, res) => {
    try {
      const result = await storage.upsertEffectiveVisGroupMap(req.params.materialId, req.body.visibilityGroupIds);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete("/api/effective-vis-groups/:materialId", async (req, res) => {
    try {
      const deleted = await storage.deleteEffectiveVisGroupMap(req.params.materialId);
      if (!deleted) return res.status(404).json({ error: "Effective vis group map not found" });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return httpServer;
}
