# Tech Stack

## Summary

| Category | Choice | Version target |
|----------|--------|----------------|
| Runtime | Node.js | 20 LTS |
| Package manager | pnpm | 9.x |
| Monorepo | Turborepo | 2.x |
| Language | TypeScript | 5.x |
| Frontend framework | Next.js (App Router) | 15.x |
| UI components | shadcn/ui | latest |
| Styling | Tailwind CSS | 4.x |
| Toasts | Sonner | latest |
| Server state | TanStack Query | 5.x |
| Forms | react-hook-form + Zod | latest |
| Tables | TanStack Table | 8.x |
| Charts | Recharts + Tremor | latest |
| Backend framework | NestJS | 11.x |
| ORM | Prisma | 6.x |
| Database | PostgreSQL via Supabase | 15+ |
| Auth | Supabase Auth | — |
| File storage | Supabase Storage | — |
| Realtime | Supabase Realtime | — |
| Validation | Zod | 3.x |
| Date handling | date-fns | 4.x |
| Testing | Vitest + Playwright | latest |
| Linting | ESLint + Prettier | latest |

## Frontend

### Next.js 15 (App Router)

**Why:** Server Components for fast initial loads, built-in routing, API routes for BFF patterns, excellent TypeScript support, easy Vercel deployment.

**Usage:**
- App Router with route groups `(auth)` and `(dashboard)`
- Server Components for read-heavy pages (student lists, reports)
- Client Components for interactive forms, charts, tables
- `next/image` for institution logo and student photos
- Middleware for auth session check and redirect

### shadcn/ui

**Why:** Copy-paste components (you own the code), built on Radix primitives for accessibility, Tailwind-native, easy to theme for white-label.

**Usage:**
- All UI primitives live in `apps/web/src/components/ui/` or shared `packages/ui/`
- Customize theme tokens via CSS variables for per-institution primary color
- Standard patterns: DataTable, Form, Dialog, Sheet, Command (search)

### Tailwind CSS v4

**Why:** Utility-first, CSS variable theming for white-label, small bundle with purging.

**Usage:**
- Shared preset in `packages/config/tailwind.config.ts`
- Institution primary color injected at runtime via `InstitutionSettings.primaryColor`

### Sonner

**Why:** Lightweight, beautiful toast notifications, works well with shadcn.

**Usage:**
- Global `<Toaster />` in root layout
- `toast.success()`, `toast.error()` from API mutation callbacks

### TanStack Query

**Why:** Server state caching, automatic refetch, optimistic updates, devtools.

**Usage:**
- One `QueryClient` in providers
- Query keys: `['students', branchId, filters]`
- Mutations invalidate related queries on success

### react-hook-form + Zod

**Why:** Performant forms, shared validation schemas between frontend and backend.

**Usage:**
- `@hookform/resolvers/zod` for schema binding
- Schemas imported from `packages/shared/schemas/`

### TanStack Table

**Why:** Headless table logic, sorting, filtering, pagination — pairs with shadcn DataTable.

### Recharts

**Why:** Composable React charts, good for line/bar/pie charts in student performance and attendance trends.

**Use for:** Subject-wise performance over time, attendance trends, fee collection charts.

### Tremor

**Why:** Pre-built dashboard KPI cards and spark charts, faster to build admin dashboards.

**Use for:** Dashboard summary cards (total students, fee collection %, attendance rate). Use Recharts for detailed drill-down charts.

### Zustand (minimal)

**Why:** Only for client-only UI state where React context is overkill.

**Use for:** Sidebar collapsed state, theme preview in admin settings. **Not** for server data.

### next-intl (structure only, Phase 2+)

**Why:** i18n with RTL support for future Urdu localization.

**Now:** File structure prepared, English only.

## Backend

### NestJS 11

**Why:** Modular architecture maps directly to domain modules, decorators for guards/pipes, built-in validation, OpenAPI support, enterprise-grade patterns.

**Usage:**
- One module per domain (students, fees, etc.)
- Global validation pipe with Zod or class-validator
- Global exception filter for consistent error responses
- Swagger/OpenAPI at `/api/docs` (dev only)

### Prisma 6

**Why:** Type-safe queries, migration system, excellent PostgreSQL support, schema as single source of truth for DB structure.

**Usage:**
- Schema in `packages/database/prisma/schema.prisma`
- `PrismaService` injected globally in NestJS
- Soft deletes via `deletedAt` field, not Prisma middleware (explicit queries)

### Supabase (full stack)

**Why:** Managed PostgreSQL, built-in Auth with MFA, S3-compatible Storage, Realtime WebSockets, RLS for defense-in-depth — reduces ops burden per deployment.

| Feature | Usage |
|---------|-------|
| PostgreSQL | Primary database, Prisma connects via `DATABASE_URL` |
| Auth | Email/password login, MFA, password reset, JWT |
| Storage | `logos`, `student-photos`, `documents` buckets |
| Realtime | Notice and attendance live updates |
| RLS | Branch-scoped read policies on sensitive tables |

## Shared Packages

### Zod

**Why:** Single validation schema → infer TypeScript type → use in NestJS pipes and React forms.

### date-fns

**Why:** Lightweight date formatting, timezone-aware operations with `date-fns-tz` for `Asia/Karachi`.

**Use for:** Display dates in UI, academic session boundaries, fee due dates.

### packages/types

Pure TypeScript interfaces — no runtime code. Shared between web and api.

### packages/shared

Zod schemas, constants (CNIC regex, phone format), utilities (grade calculation, percentage).

## DevOps & Tooling

| Tool | Purpose |
|------|---------|
| Turborepo | Build caching, task orchestration across packages |
| pnpm workspaces | Efficient monorepo dependency management |
| ESLint | Linting with shared config in `packages/config` |
| Prettier | Code formatting |
| Husky + lint-staged | Pre-commit hooks |
| Vitest | Unit tests for shared utils and services |
| Playwright | E2E tests for critical flows (login, admission) |
| GitHub Actions | CI: lint, test, build on PR |

## What We Explicitly Avoid

| Avoided | Reason | Alternative |
|---------|--------|-------------|
| Redux | Overkill for server-state-heavy app | TanStack Query |
| Multi-tenant SaaS DB | Per-deployment model | Separate Supabase per customer |
| Hardcoded enums for business data | Must be dynamic | DB lookup tables |
| Direct DB writes from Next.js | Security, audit | All mutations via NestJS |
| MongoDB | Relational data model fits SQL | PostgreSQL |
| GraphQL | Team familiarity, simpler caching | REST + OpenAPI |

## Environment-Specific Configuration

| Variable | App | Purpose |
|----------|-----|---------|
| `DATABASE_URL` | api | Prisma connection string |
| `SUPABASE_URL` | web, api | Supabase project URL |
| `SUPABASE_ANON_KEY` | web | Public client key |
| `SUPABASE_SERVICE_ROLE_KEY` | api | Server-side admin operations |
| `JWT_SECRET` | api | Verify Supabase JWT (if needed) |
| `INSTITUTION_NAME` | web, api | Display name fallback |
| `INSTITUTION_TYPE` | api | Profile: coaching, school, college |
| `NEXT_PUBLIC_APP_URL` | web | Canonical app URL |
| `API_URL` | web | NestJS base URL |

See [docs/templates/](templates/) for full env examples.

## Related Documents

- [04-monorepo-structure.md](04-monorepo-structure.md) — where each library lives
- [10-frontend-guidelines.md](10-frontend-guidelines.md) — frontend patterns
- [11-backend-guidelines.md](11-backend-guidelines.md) — backend patterns
