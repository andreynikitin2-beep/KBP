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

**Key Pages:**
- `/` — Home dashboard with KPIs, overdue materials, recent activity
- `/catalog` — Hierarchical catalog browser with scope-based access control
- `/materials/new` — Material creation wizard (multi-step form)
- `/materials/:id` — Material detail view with passport, versions, RFC workflow, audit
- `/admin` — Admin panel with notifications log, user management, CSV export

**Domain Logic** (`kbLogic.ts`):
- Role-based access control (Читатель, Автор, Владелец, Заместитель владельца, Администратор)
- Visibility scoping by legal entity, branch, and roles
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