# Портал инструкций (Knowledge Base Portal)

## Overview

This is a **Knowledge Base Portal** ("Портал инструкций") — a Russian-language internal documentation management system with actuality control. It provides a catalog of instructional materials with passports (metadata), versioning, RFC workflows, audit trails, visibility controls, and admin dashboards.

The application is a full-stack TypeScript project using a React frontend with Express backend. Currently, all data is managed through **in-memory mock data** on the client side (via React context in `kbStore`), with a minimal server setup ready for backend API integration. The database schema exists but is minimal (just a users table).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Client)

- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: React Context (`KBStoreProvider` in `kbStore.tsx`) holds all application state including materials, RFCs, notifications, and the current user
- **Data Layer**: Currently uses mock/seed data defined in `mockData.ts` — no API calls for domain data yet. TanStack React Query is set up but mainly for future API integration
- **UI Components**: shadcn/ui component library (new-york style) built on Radix UI primitives with Tailwind CSS v4
- **Styling**: Tailwind CSS with CSS variables for theming, custom fonts (Manrope + Literata via Google Fonts)
- **Build Tool**: Vite

**Approval Workflow (Batch 5):**
- Owner/Deputy as creator → direct publish without approval
- Author (non-owner) as creator → must submit for approval → owner/deputy approves/rejects
- "Вернуть на доработку" requires mandatory comment
- Admin force-publish overrides all rules
- Logic functions: `canPublishDirectly`, `canSubmitForApproval`, `canApproveAndPublish`, `canReturnForRevision` in `kbLogic.ts`
- Store actions: `submitForApproval`, `publishDirect`, `approveAndPublish`, `returnForRevision` in `kbStore.tsx`

**WYSIWYG Page Editor (Batch 12):**
- Rich text editor based on Tiptap (free, open-source): `client/src/components/kb/RichEditor.tsx`
- Supported features: headings (H1-H3), bold/italic/underline/strike, highlight, blockquote ("Важно" callout), code blocks, bullet/ordered lists, task lists (checklists), tables (with dynamic row/column management), images (base64), links, text alignment, horizontal rules
- Word import: .docx files imported via mammoth.js with embedded image extraction (base64); paste-cleaning strips Word-specific markup (MSO styles, spans, fonts)
- Page content viewer: `client/src/components/kb/PageViewer.tsx` — renders HTML with auto-generated heading anchors, collapsible TOC (table of contents), per-heading "copy link" buttons
- Deep links: headings auto-get `id` attributes via slugify; URL hash scrolls to heading on page load; heading :target highlighted with accent background
- Content model: `MaterialVersion.content.page` stores `{ html: string }` (was blocks array, migrated to HTML in Batch 12)
- CSS styles for both editor (.tiptap) and viewer (.tiptap-content) in `client/src/index.css`

**AD/SSO Integration & User Management (Batch 11):**
- User type extended: `source` (ad/local), `adAccountName`, `lastSyncAt`, `deactivatedAt`
- Users are now mutable state in kbStore (not static demoUsers import)
- AD sync: `syncADUsers()` action updates lastSyncAt for AD users, handles deactivation cascade
- Deactivation cascade: if owner/deputy deactivated → their published materials move to "На пересмотре" + email to admin
- Local user creation: `createLocalUser()` action with full form in admin panel
- User deactivation/reactivation: `deactivateUser()`, `reactivateUser()` actions
- policySeed.adIntegration: enabled, mode (SAML/OIDC/LDAP/demo), ssoUrl, syncFrequencyMinutes, syncStatus, syncLog[]
- AD/SSO admin: fully editable config (enable/disable, protocol, SSO URL, sync frequency, attribute mapping)
- `updateAdConfig(data)` store action for AD/SSO settings
- Admin tabs: AD/SSO config + sync log, Пользователи (list + create local + deactivate/reactivate)
- All files use `users` from kbStore instead of importing `demoUsers` directly

**Email Notification System (full admin):**
- `EmailConfig` type: senderAddress, senderName, smtpHost, smtpPort, smtpUser, smtpUseTls, enabled
- `EmailTemplate` type: key, label, subject, body, description — 6 built-in templates (reminder_before, reminder_due, overdue, escalation, new_version, auto_transition)
- Store state: `emailConfig` + `emailTemplates` with `updateEmailConfig()` and `updateEmailTemplate()` actions
- Admin Email tab: 3 cards — (1) SMTP/sender config with edit mode, (2) template editor with inline editing of subject+body, (3) notification log with human-readable status/template labels
- Templates use `{{variable}}` placeholders: title, owner, days, dueDate, link, version, recipient, changelog, newStatus, reason
- Seed data in `mockData.ts`: `emailConfigSeed`, `emailTemplatesSeed`

**Material-Level Visibility & Enhanced Versioning (Batch 14 + Multi-Group Refactor):**
- **Multiple visibility groups per material**: `Passport.visibilityGroupIds: string[]` (was single `visibilityGroupId`)
- Access granted if user is member of ANY assigned group; system groups (e.g. "Базовая") grant access to everyone
- `effectiveVisGroupMap` in kbStore: `Record<materialId, string[]>` — tracks current effective visibility groups per material, updated only on publish
- `CatalogNode.defaultVisibilityGroupIds?: string[]` — subsection default groups, auto-populated when creating material in that subsection
- Access control (`canViewMaterial` in kbLogic.ts) checks ALL groups in array; drafts/approvals bypass visibility for author/owner/deputy/admin
- UI: checkboxes for multi-group selection in material-wizard and material-view (draft edit mode)
- **Access narrowing warning**: on publish, if visibility groups changed to more restrictive, shows dialog with count/names of users who lose access
- Subscription cleanup: `cleanupSubscriptionsOnGroupChange(materialId, newGroupIds[])` removes subscriptions for users who lost access across ALL groups
- `notifySubscribers(version, newGroupIds[])` checks access against all groups before sending email
- Admin panel: "Группы по умолчанию для подразделов" section in Groups tab — dropdown per subsection to set default group
- `updateCatalogNode(nodeId, updates)` store action for updating catalog node properties
- Version numbering: major.minor format; `createNewVersion(materialId, majorBump?)` — if majorBump=true → major+1.0, else major.minor+1
- Inline dialog in material-view.tsx for creating new version with checkbox for major bump
- On publish: auto-archives previous published versions of same material, resets reviewDate/confirmedAt
- "Мои материалы" page (`/my-materials`): two sections — "Я - владелец" and "Я - заместитель владельца"
- **Per-version access control**: `canViewVersion()` in kbLogic.ts checks each version's own `visibilityGroupIds`; old versions with restricted groups remain hidden even if the current version has broader access; version list in material-view.tsx shows only `accessibleVersions`; direct selection of inaccessible versions is blocked
- **Access enforcement everywhere**: catalog, search, home dashboards, my-materials, direct links, downloads — all filter through `visibleMaterials` which uses `canViewMaterial`; direct link to restricted material shows "Доступ ограничен" without content leak

**Key Pages:**
- `/` — Home dashboard with KPIs, overdue materials, recent activity
- `/catalog` — Hierarchical catalog browser with scope-based access control
- `/materials/new` — Material creation wizard (multi-step form)
- `/materials/:id` — Material detail view with passport, versions, RFC workflow, audit
- `/my-materials` — Personal materials dashboard for owners and deputies
- `/admin` — Admin panel with 7 tabs: Политики, AD/SSO, Пользователи, Права, Группы, Отчёты, Email-журнал

**Helpfulness Ratings & View Dedup (Batch 15):**
- Portal timezone: `PORTAL_TZ = "Europe/Moscow"` — all date calculations use Moscow time
- `HelpfulRating` type: userId, materialId, date (YYYY-MM-DD Moscow), value (helpful/not_helpful)
- Rating limit: 1 rating per user per material per calendar day (Moscow timezone); immutable within day
- Store state: `ratings: HelpfulRating[]` with `rateMaterial()`, `canRateToday()`, `getMaterialRatings()`
- View dedup: `VIEW_DEDUP_MINUTES = 30` — same user can increment view count only once per 30 min window
- `recordView(materialId)` store action: always logs to auditViews, only increments stats.views on dedup pass
- Popularity formula: `popularity_score = 0.7 * log(views_30d + 1) + 0.3 * helpfulness_score`
- Helpfulness formula (Bayesian smoothing): `helpfulness_score = (helpful + m*C) / (total + m)` where m=20, C=avg portal helpfulness
- Home showcase: 3 tabs — "Новое" (by date), "Популярное" (by popularity_score), "Самые полезные" (by helpfulness_score, min 5 ratings)
- Sorting controls on home page search results and catalog: by date, popularity, criticality, status, next review
- `MIN_RATINGS_FOR_HELPFUL = 5` — minimum ratings for "Most Helpful" showcase
- Helper functions: `getMoscowDate()`, `getMoscowDateString()`, `computeHelpfulnessScore()`, `computePopularityScore()`

**Domain Logic** (`kbLogic.ts`):
- Role-based access control (Читатель, Автор, Владелец, Заместитель владельца, Администратор)
- Visibility scoping by roles and visibility groups (legal entity is metadata only, no access restrictions)
- Branches/locations removed entirely (Batch 13)
- Actuality confirmation workflow
- Material status lifecycle: Черновик → На согласовании → Опубликовано → На пересмотре → Архив
- Overdue detection based on review periods and criticality levels

### Backend (Server)

- **Framework**: Express 5 on Node.js
- **Entry Point**: `server/index.ts` creates HTTP server, registers routes, sets up Vite dev middleware or static serving
- **Routes**: `server/routes.ts` — currently empty, ready for API endpoints (should be prefixed with `/api`)
- **Storage**: `server/storage.ts` defines an `IStorage` interface with a `MemStorage` implementation using in-memory Maps. Currently only has user CRUD methods
- **Dev Mode**: Vite dev server runs as Express middleware with HMR via WebSocket
- **Production**: Client is built to `dist/public`, served as static files with SPA fallback

### Database

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: `shared/schema.ts` — currently only a `users` table (id, username, password)
- **Migrations**: Drizzle Kit configured to output to `./migrations` directory
- **Push Command**: `npm run db:push` to sync schema to database
- **Connection**: Requires `DATABASE_URL` environment variable

### Build System

- **Client Build**: Vite bundles React app to `dist/public`
- **Server Build**: esbuild bundles server code to `dist/index.cjs` with selective dependency bundling (allowlist pattern to reduce cold start times)
- **Build Script**: `script/build.ts` orchestrates both builds
- **Path Aliases**: `@/` → `client/src/`, `@shared/` → `shared/`, `@assets/` → `attached_assets/`

### Shared Code

- `shared/schema.ts` contains Drizzle table definitions and Zod validation schemas, shared between client and server
- Types are inferred from the schema using `drizzle-zod`

## External Dependencies

### Core Infrastructure
- **PostgreSQL** — Database (via `DATABASE_URL` env var), used through Drizzle ORM
- **connect-pg-simple** — PostgreSQL session store (available but not yet wired up)

### Frontend Libraries
- **Radix UI** — Full suite of accessible UI primitives (dialog, dropdown, tabs, etc.)
- **TanStack React Query** — Async state management (configured, minimal usage currently)
- **Wouter** — Client-side routing
- **date-fns** — Date formatting (with Russian locale)
- **Recharts** — Chart components (via shadcn chart component)
- **embla-carousel-react** — Carousel functionality
- **react-day-picker** — Calendar/date picker
- **cmdk** — Command palette
- **vaul** — Drawer component
- **react-resizable-panels** — Resizable panel layouts
- **react-hook-form** + **@hookform/resolvers** — Form management with Zod validation

### Build & Dev Tools
- **Vite** — Dev server and client bundler with HMR
- **esbuild** — Server bundler for production
- **Tailwind CSS v4** — Utility-first CSS (via `@tailwindcss/vite` plugin)
- **TypeScript** — Type checking across all code
- **Drizzle Kit** — Database migration tooling

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal** — Runtime error overlay in development
- **@replit/vite-plugin-cartographer** — Dev tooling (dev only)
- **@replit/vite-plugin-dev-banner** — Dev banner (dev only)
- **vite-plugin-meta-images** — Custom plugin for OpenGraph meta tag management