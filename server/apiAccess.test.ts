// Правила доступа к API: публичные маршруты, админские маршруты, права на каталог.
import { describe, it, expect } from "vitest";
import { canChangeCatalogNode, hasAdminRole, isAdminRoute, isPublicRoute } from "./apiAccess";

const admin = { id: "u-admin", roles: ["Администратор"] };
const owner = { id: "u-owner", roles: ["Владелец"] };
const reader = { id: "u-reader", roles: ["Читатель"] };

const section = { id: "s-1", type: "section", parentId: null, ownerIds: ["u-owner"] };
const subsection = { id: "s-1-a", type: "subsection", parentId: "s-1", ownerIds: [] };

describe("isPublicRoute", () => {
  it("пускает без входа только вход, выход, список для входа, health и картинки", () => {
    expect(isPublicRoute("GET", "/api/health")).toBe(true);
    expect(isPublicRoute("POST", "/api/auth/login")).toBe(true);
    expect(isPublicRoute("POST", "/api/auth/logout")).toBe(true);
    expect(isPublicRoute("GET", "/api/auth/users-list")).toBe(true);
    expect(isPublicRoute("GET", "/api/images/abc")).toBe(true);
  });

  it("всё остальное требует входа", () => {
    expect(isPublicRoute("GET", "/api/users")).toBe(false);
    expect(isPublicRoute("GET", "/api/material-versions")).toBe(false);
    expect(isPublicRoute("GET", "/api/material-versions/v-1/file")).toBe(false);
    expect(isPublicRoute("POST", "/api/images")).toBe(false);
    expect(isPublicRoute("GET", "/api/auth/login")).toBe(false);
  });
});

describe("isAdminRoute", () => {
  it.each([
    ["POST", "/api/users"],
    ["PATCH", "/api/users/u-1"],
    ["GET", "/api/email-config"],
    ["PUT", "/api/email-config"],
    ["POST", "/api/email/test"],
    ["PATCH", "/api/email-templates/t-1"],
    ["GET", "/api/ad-config"],
    ["PUT", "/api/ad-config"],
    ["POST", "/api/ad-sync"],
    ["POST", "/api/ad-sync/user"],
    ["GET", "/api/ad-sync-log"],
    ["PATCH", "/api/policy/review-periods/p-1"],
    ["POST", "/api/visibility-groups"],
    ["DELETE", "/api/visibility-groups/g-1"],
    ["PUT", "/api/new-hires/config"],
    ["POST", "/api/new-hires/assignments"],
    ["GET", "/api/admin/file-storage"],
  ])("%s %s — только администратор", (method, path) => {
    expect(isAdminRoute(method, path)).toBe(true);
  });

  it.each([
    ["GET", "/api/users"],
    ["GET", "/api/catalog-nodes"],
    ["GET", "/api/material-versions"],
    ["PATCH", "/api/material-versions/v-1"],
    ["POST", "/api/ratings"],
    ["GET", "/api/policy/review-periods"],
    ["PATCH", "/api/new-hires/assignments/a-1/acknowledge"],
    ["PATCH", "/api/new-hires/profiles/p-1"],
  ])("%s %s — доступно любому вошедшему", (method, path) => {
    expect(isAdminRoute(method, path)).toBe(false);
  });
});

describe("hasAdminRole", () => {
  it("распознаёт роль администратора", () => {
    expect(hasAdminRole(admin)).toBe(true);
    expect(hasAdminRole(owner)).toBe(false);
    expect(hasAdminRole(null)).toBe(false);
  });
});

describe("canChangeCatalogNode", () => {
  it("администратор может всё", () => {
    expect(canChangeCatalogNode({ user: admin, method: "DELETE", node: section })).toBe(true);
    expect(canChangeCatalogNode({ user: admin, method: "POST", body: { title: "x", type: "section" } })).toBe(true);
  });

  it("владелец раздела создаёт, переименовывает и удаляет подразделы", () => {
    expect(canChangeCatalogNode({ user: owner, method: "POST", body: { parentId: "s-1" }, parent: section })).toBe(true);
    expect(canChangeCatalogNode({ user: owner, method: "PATCH", body: { title: "y" }, node: subsection, parent: section })).toBe(true);
    expect(canChangeCatalogNode({ user: owner, method: "DELETE", node: subsection, parent: section })).toBe(true);
  });

  it("владелец переименовывает свой раздел, но не удаляет его и не меняет владельцев", () => {
    expect(canChangeCatalogNode({ user: owner, method: "PATCH", body: { title: "y", sortOrder: 2 }, node: section })).toBe(true);
    expect(canChangeCatalogNode({ user: owner, method: "DELETE", node: section })).toBe(false);
    expect(canChangeCatalogNode({ user: owner, method: "PATCH", body: { ownerIds: ["u-owner", "u-x"] }, node: section })).toBe(false);
    expect(canChangeCatalogNode({ user: owner, method: "PATCH", body: { parentId: "s-2" }, node: subsection, parent: section })).toBe(false);
  });

  it("владелец не может создавать разделы верхнего уровня", () => {
    expect(canChangeCatalogNode({ user: owner, method: "POST", body: { title: "x", type: "section" } })).toBe(false);
  });

  it("читатель и владелец чужого раздела ничего не меняют", () => {
    const other = { id: "s-2", type: "section", parentId: null, ownerIds: ["u-x"] };
    expect(canChangeCatalogNode({ user: reader, method: "PATCH", body: { title: "y" }, node: section })).toBe(false);
    expect(canChangeCatalogNode({ user: owner, method: "PATCH", body: { title: "y" }, node: other })).toBe(false);
    expect(canChangeCatalogNode({ user: owner, method: "POST", body: { parentId: "s-2" }, parent: other })).toBe(false);
  });

  it("несуществующий узел — отказ", () => {
    expect(canChangeCatalogNode({ user: owner, method: "PATCH", body: { title: "y" } })).toBe(false);
  });
});
