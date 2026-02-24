# Портал инструкций (Knowledge Base Portal)

## Overview

This project is a Knowledge Base Portal (Портал инструкций), an internal documentation management system in Russian, designed for efficient knowledge sharing and control. It features a catalog of instructional materials with rich metadata, versioning, RFC (Request for Comments) workflows, audit trails, granular visibility controls, and administrative dashboards. The system aims to enhance internal communication and ensure the actuality of shared information.

The application is a full-stack TypeScript project, utilizing a React frontend and an Express backend. It's built to manage internal documentation, streamline approval processes, and provide robust search and access capabilities for users, including specific features for new employee onboarding.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Client)

The frontend is a React 18 application with TypeScript, using Wouter for client-side routing. State management is handled globally via React Context (`KBStoreProvider`), which stores all application data, including materials, RFCs, notifications, and user information. UI components are built using `shadcn/ui` (new-york style) based on Radix UI primitives and styled with Tailwind CSS v4. Custom fonts (Manrope + Literata) are integrated, and Vite serves as the build tool.

Key features include:

-   **Approval Workflow**: Supports direct publishing for owners/deputies, approval requests for authors, and an "Admin force-publish" override. Includes "Вернуть на доработку" (Return for revision) functionality.
-   **WYSIWYG Page Editor**: A rich text editor based on Tiptap, supporting various formatting, tables, images (base64), links, and task lists. It includes `.docx` import via `mammoth.js` with image extraction and paste-cleaning. Content is stored as HTML.
-   **Page Content Viewer**: Renders HTML content with auto-generated heading anchors, a collapsible table of contents, and "copy link" buttons for headings. Supports deep linking via URL hash.
-   **Authentication**: Login page with user dropdown and password field. AD users authenticate with domain credentials, local users with admin-set passwords. Auth state persisted to localStorage. Logout button in app header. Default password for all seed users is "1". Login endpoint: `POST /api/auth/login`, users list: `GET /api/auth/users-list`.
-   **AD/SSO Integration & User Management**: Extends user profiles with AD synchronization capabilities (`adAccountName`, `lastSyncAt`, `deactivatedAt`). Provides admin tools for AD/SSO configuration, user deactivation/reactivation, and local user creation (with password field). Deactivation triggers material status changes for owners/deputies.
-   **Email Notification System**: Configurable SMTP settings and email templates with placeholders for automated notifications (e.g., reminders, escalations, new versions).
-   **Material-Level Visibility & Enhanced Versioning**: Materials can belong to multiple visibility groups, with access granted if a user is a member of any assigned group. Features a warning for access narrowing on publish and cleans up subscriptions accordingly. Versioning follows a `major.minor` format, with old versions retaining their specific visibility settings.
-   **New Hires Onboarding**: Marks materials as "required for new hires." Manages new hire profiles and assignments, tracks acknowledgment, and automatically detects and assigns materials to new users. Features an `/my-onboarding` page for users to track their progress.
-   **Helpfulness Ratings & View Dedup**: Allows users to rate materials as "helpful" or "not helpful" (once per day). Implements view deduplication (once per 30 minutes) for accurate view counts. Material popularity and helpfulness scores are calculated using specific formulas to power "Popular" and "Most Helpful" showcases.
-   **Domain Logic**: Implements role-based access control (Reader, Author, Owner, Deputy Owner, Administrator), visibility scoping, material status lifecycle (Draft, Pending Approval, Published, Under Review, Archive), and overdue material detection.

### Backend (Server)

The backend uses Express 5 on Node.js. It's currently set up with minimal routing, ready for API endpoint integration (prefixed with `/api`). Data storage is defined by an `IStorage` interface, with an in-memory `MemStorage` implementation for user management. In development, it uses Vite's dev server as Express middleware with HMR; in production, it serves static client files.

### Database

The application utilizes Drizzle ORM with a PostgreSQL dialect. The database schema, defined in `shared/schema.ts`, currently includes a `users` table. Drizzle Kit is configured for migrations, and the schema can be synced using `npm run db:push`. A `DATABASE_URL` environment variable is required for connection.

### Build System

Vite handles the client-side build, bundling the React app to `dist/public`. esbuild is used for the server-side build, compiling server code to `dist/index.cjs` with selective dependency bundling. A `script/build.ts` orchestrates both processes. Path aliases are configured for convenient module imports.

### Shared Code

`shared/schema.ts` centralizes Drizzle table definitions and Zod validation schemas, ensuring type consistency and validation across both frontend and backend.

## External Dependencies

### Core Infrastructure
-   **PostgreSQL**: Primary database for persistent storage via Drizzle ORM.
-   **connect-pg-simple**: Planned for PostgreSQL session store.

### Frontend Libraries
-   **Radix UI**: Foundational accessible UI primitives.
-   **TanStack React Query**: For asynchronous state management and data fetching.
-   **Wouter**: Lightweight client-side router.
-   **date-fns**: Date manipulation and formatting (with Russian locale).
-   **Recharts**: Charting library (via shadcn/ui).
-   **react-hook-form** & **@hookform/resolvers**: Form management with Zod validation.

### Build & Dev Tools
-   **Vite**: Client-side development server and bundler.
-   **esbuild**: Server-side bundler for production.
-   **Tailwind CSS v4**: Utility-first CSS framework.
-   **TypeScript**: Ensures type safety across the codebase.
-   **Drizzle Kit**: Database migration tooling.