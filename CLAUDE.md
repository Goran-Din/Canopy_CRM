# Canopy CRM - Project Configuration

## Technology Stack (LOCKED - Do Not Change)
- Language: TypeScript 5.x (strict mode, ES Modules only)
- Frontend: React 18 + Vite 5 (NOT Next.js)
- UI Components: Shadcn/ui + Tailwind CSS 3.x
- State: Zustand (global) + React Query (server state)
- Backend: Node.js 20 LTS + Express 4
- Database: PostgreSQL 16 via pg driver (raw SQL - NOT Prisma, NOT Drizzle)
- Auth: JWT RS256 + httpOnly refresh cookie (15min access / 30day refresh)
- File Storage: Cloudflare R2 (private, signed URLs only)
- Email: Resend SDK
- PDF Generation: Puppeteer (headless Chrome)
- Process Manager: PM2 5.x
- Containers: Docker + Docker Compose (managed by Dokploy)
- Validation: Zod (both frontend and backend)
- Forms: React Hook Form + Zod
- HTTP Client: Axios
- Dates: date-fns
- Icons: Lucide React
- Charts: Recharts
- Logging: Winston (structured JSON)
- Caching: Redis (sessions and API caching)
- Scheduling: node-cron (background jobs)
- Testing: Vitest

## Architecture Rules
- Multi-tenant: tenant_id on every table, every query
- UUID primary keys on all tables
- Soft delete via deleted_at column (never hard delete)
- updated_at triggers on all tables
- All SQL written by hand. Parameterized queries only. No ORM.
- CommonJS (require) is PROHIBITED. Use ES Modules (import/export).
- Every API endpoint validates with Zod schemas
- Role-based access: owner, div_mgr, coordinator, crew_leader, crew_member, client
- Division scoping: landscaping_maintenance, landscaping_projects, hardscape, snow_removal

## Project Structure
canopy-crm/
  api/              # Backend (Express + TypeScript)
    src/
      config/       # Environment, database pool, Redis client
      middleware/    # Auth, tenant, error handling, validation
      modules/      # Feature modules (customers, properties, etc.)
        [module]/
          controller.ts   # Route handlers
          service.ts      # Business logic
          repository.ts   # Database queries (raw SQL)
          schema.ts       # Zod validation schemas
          routes.ts       # Express route definitions
    db/
      migrations/   # Sequential migration files
      seeds/        # Development seed data
    utils/          # Shared utilities
  frontend/         # React + Vite + Tailwind
    src/
      components/   # Shared UI components
      pages/        # Page-level components
      stores/       # Zustand stores
      hooks/        # Custom React hooks
      api/          # Axios API client
  docker/           # Docker Compose files
  docs/             # Specification documents

## Branching Strategy
- main: Production (protected, Goran merges only)
- staging: Staging (feature branches merge here first)
- feature/*: Feature branches (e.g., feature/d1-customer-management)
- fix/*: Bug fix branches

## V1 Build Phases (COMPLETED - from J-1 Development Roadmap)
Phase 1: Foundation & Infrastructure (database, auth, multi-tenancy, CI/CD)
Phase 2: Core Operations (customers, properties, contracts, jobs, crews)
Phase 3: Financial & Billing (invoicing, Xero, disputes)
Phase 4: Specialised Modules (snow, hardscape, SOPs, equipment)
Phase 5: Integrations (Canopy Ops, Quotes, NorthChat, Mautic, Google Drive)
Phase 6: UI, Portals & Mobile (dashboards, crew PWA, client portal)
Phase 7: Reporting, Polish & Launch

V1 Status: Fully built, 698 tests passing, deployed to staging.sunsetapp.us with 301 customers and 315 properties imported. 19 DB migrations (001-019).

---

## V2 Build Plan (CURRENT - from J-6 V2 Master Overview)

### V2 Knowledge Base Location
All V2 specification documents (130 .docx files) are stored in:
`C:\Users\Goran\Documents\Development\Canopy CRM\V2 Knowledge files\`

The V2 Development Roadmap with complete Document Index is at:
`C:\Users\Goran\Documents\Development\Canopy CRM\Canopy_CRM_V2_Development_Roadmap.docx`

### V2 Document Authority (from V2_Document_Registry.docx)
Before writing any V2 code, check document authority:
- **STAYS (41 docs)**: V1 doc is fully valid. Use as-is.
- **STAYS+EXT (18 docs)**: Read V1 doc FIRST, then read the V2 addendum.
- **NEW V2 (31 docs)**: New V2-only document.
- **REPLACED (3 docs)**: D-11 → use D-33; H-3 → use H-12; H-9 → use H-14.
- **RETIRED (6 docs)**: K-1 through K-5, J-1. Ignore for V2 build.

### V2 Build Waves (Sequential - each wave depends on the previous)

**Wave 0: Pre-Requisites** — Fix $NaN dashboard bug, deploy V1 to production, generate production JWT keys, UAT with Erick & Marcin

**Wave 1: Foundation** — Database migrations 020-034 (job numbers, quotes, files, properties V2, service tiers, billing schedules, automations, feedback)
- Key docs: B-7, B-8, B-9, D-22, D-27

**Wave 2: Core Modules** — Job Pipeline (D-23), Quote Builder (D-24), E-Signature (D-25), Service Occurrences (D-28), Billing Engine (D-29), File Management (D-33), Property Knowledge Card (D-34)
- Each module: migration → repository.ts → service.ts → schema.ts → controller.ts → routes.ts → tests

**Wave 3: Supporting Modules** — Templates (D-26), Hardscape Milestone Billing (D-30), Automation Engine (D-31), Customer Feedback (D-32), Geofence & GPS Intelligence (D-35)

**Wave 4: API & Integrations** — Quote API (E-7), Files API (E-8), Canopy Quotes v2 (F-1 v2), NorthChat v2 (F-3 v2), Xero v2 + Payment Links (F-4 v2, F-4 v2.1), Mautic v2 (F-5 v2)

**Wave 5: Frontend - New UI** — Job Card (G-12), Quote Builder (G-13), Signing Page (G-14), Templates Tab (G-15), Season Setup (G-16), Billing Dashboard (G-17), File Library (G-18)

**Wave 6: Frontend - Updates** — Owner Command Center (G-20), Property UI (G-3), Financial UI (G-6), Dispatch Board (G-11), Crew PWA Geofence (G-7 v2), Live Crew Map (G-19)

**Wave 7: Workflows & Reports** — H-12, H-13, H-14, H-15, H-16, I-3 v2, I-5

**Wave 8: Config, QA & Launch** — Sunset Services V2 config (L-1, L-4, L-5), data migration for 301 customers, QA, UAT, production deployment

### Current Wave
**Status: Wave 0 — Pre-Requisites**
See wave tracker: `C:\Users\Goran\Documents\Development\Canopy CRM\V2_Wave_Tracker.md`

### V2 Critical Rules (Non-Negotiable)
- V2 does NOT modify or break any V1 functionality — it extends it
- Migrations continue from 019 — next migration is 020
- No migration may modify or drop existing V1 tables — only ADD columns, ADD tables, CREATE indexes
- No invoice goes to Xero without human approval (billing engine generates drafts only)
- Gold/Silver package services NEVER appear as individual invoice line items
- Signed quotes are permanently locked — no edits after signature
- All files stored in Cloudflare R2 — signed URLs only, never public
- Internal folder NEVER visible in client portal
- Gate codes/access_notes NEVER returned in portal API responses
- Prices always entered manually — Xero items provide name/account code only, never price
