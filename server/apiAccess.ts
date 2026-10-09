// Server-side access rules for the REST API.
//
// Every /api route requires a valid session except the few listed in
// PUBLIC_ROUTES. Routes in ADMIN_ROUTES additionally require the
// "Администратор" role. Finer, per-object checks (catalog sections, new-hire
// profiles) live next to the routes that need them.

type Rule = { method: string; path: RegExp };

const PUBLIC_ROUTES: Rule[] = [
  { method: "GET", path: /^\/api\/health$/ },
  { method: "GET", path: /^\/api\/auth\/users-list$/ },
  { method: "POST", path: /^\/api\/auth\/login$/ },
  { method: "POST", path: /^\/api\/auth\/logout$/ },
  // Image ids are random UUIDs; images embedded in sandboxed HTML previews
  // are requested without cookies, so reading one by id stays public.
  { method: "GET", path: /^\/api\/images\/[^/]+$/ },
];

const ANY = "*";

const ADMIN_ROUTES: Rule[] = [
  // Users: everyone may read the directory, only admins change it.
  { method: "POST", path: /^\/api\/users$/ },
  { method: "PATCH", path: /^\/api\/users\/[^/]+$/ },
  // Visibility groups
  { method: "POST", path: /^\/api\/visibility-groups$/ },
  { method: "PATCH", path: /^\/api\/visibility-groups\/[^/]+$/ },
  { method: "DELETE", path: /^\/api\/visibility-groups\/[^/]+$/ },
  // Mail
  { method: ANY, path: /^\/api\/email-config$/ },
  { method: "POST", path: /^\/api\/email\/test$/ },
  { method: ANY, path: /^\/api\/email-templates(\/.*)?$/ },
  // Policies
  { method: "PATCH", path: /^\/api\/policy\/.+$/ },
  // Active Directory
  { method: ANY, path: /^\/api\/ad-config$/ },
  { method: ANY, path: /^\/api\/ad-sync-log$/ },
  { method: "POST", path: /^\/api\/ad-sync(\/user)?$/ },
  // New hires: configuration and assigning materials
  { method: "PUT", path: /^\/api\/new-hires\/config$/ },
  { method: "POST", path: /^\/api\/new-hires\/profiles$/ },
  { method: "POST", path: /^\/api\/new-hires\/assignments$/ },
  // Deleting a material with all versions, comments and history
  { method: "DELETE", path: /^\/api\/materials\/[^/]+$/ },
  // Admin section (individual routes also check, this is defence in depth)
  { method: ANY, path: /^\/api\/admin\/.+$/ },
];

function matches(rules: Rule[], method: string, path: string): boolean {
  const m = method.toUpperCase();
  return rules.some((r) => (r.method === ANY || r.method === m) && r.path.test(path));
}

/** `path` is the request path without the query string, e.g. "/api/users/u-1". */
export function isPublicRoute(method: string, path: string): boolean {
  return matches(PUBLIC_ROUTES, method, path);
}

export function isAdminRoute(method: string, path: string): boolean {
  return matches(ADMIN_ROUTES, method, path);
}

export const ADMIN_ROLE = "Администратор";

export function hasAdminRole(user: { roles?: unknown } | null | undefined): boolean {
  return Array.isArray(user?.roles) && (user!.roles as string[]).includes(ADMIN_ROLE);
}

type CatalogNodeLike = { id: string; type: string; parentId?: string | null; ownerIds?: unknown };

function ownsSection(userId: string, section: CatalogNodeLike | undefined): boolean {
  return !!section && Array.isArray(section.ownerIds) && (section.ownerIds as string[]).includes(userId);
}

/**
 * Who may change the catalog. Admins may do anything. A section owner may
 * create, rename and delete subsections of their section and rename the
 * section itself, but may not delete sections or change section owners.
 */
export function canChangeCatalogNode(opts: {
  user: { id: string; roles?: unknown };
  method: string;
  body?: any;
  node?: CatalogNodeLike;
  parent?: CatalogNodeLike;
}): boolean {
  const { user, body, node, parent } = opts;
  const method = opts.method.toUpperCase();
  if (hasAdminRole(user)) return true;

  if (method === "POST") {
    // Only subsections of an owned section; new top-level sections are admin-only.
    return !!body?.parentId && ownsSection(user.id, parent);
  }

  if (!node) return false;
  if (body && "ownerIds" in body) return false;
  if (body && "parentId" in body) return false;

  if (node.type === "section") {
    if (method === "DELETE") return false;
    return ownsSection(user.id, node);
  }
  return ownsSection(user.id, parent);
}
