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

## Build Phases (from J-1 Development Roadmap)
Phase 1: Foundation & Infrastructure (database, auth, multi-tenancy, CI/CD)
Phase 2: Core Operations (customers, properties, contracts, jobs, crews)
Phase 3: Financial & Billing (invoicing, Xero, disputes)
Phase 4: Specialised Modules (snow, hardscape, SOPs, equipment)
Phase 5: Integrations (Canopy Ops, Quotes, NorthChat, Mautic, Google Drive)
Phase 6: UI, Portals & Mobile (dashboards, crew PWA, client portal)
Phase 7: Reporting, Polish & Launch
