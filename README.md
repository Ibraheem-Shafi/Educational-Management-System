# Educational Institution Management System

A white-label ERP for schools, colleges, and coaching centers in Pakistan. Built as a copy-paste product: one codebase, separate deployment per institution, configuration-only rebranding.

**First deployment:** Rekhta Academy Pakistan (coaching center profile).

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, shadcn/ui, Tailwind CSS, Sonner, TanStack Query |
| Backend | NestJS 11, Prisma |
| Database & Auth | Supabase (PostgreSQL, Auth, Storage, Realtime, RLS) |
| Charts | Recharts, Tremor |
| Monorepo | Turborepo, npm workspaces |

## Repository Structure

```
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS REST API
├── packages/
│   ├── database/     # Prisma schema & migrations
│   ├── shared/       # Zod schemas, constants, utils
│   ├── types/        # Shared TypeScript contracts
│   └── config/       # ESLint, TSConfig presets
└── docs/             # Architecture & guidelines
```

## Documentation Index

| # | Document | Description |
|---|----------|-------------|
| — | [ERP Requirements (client brief)](docs/ERP-Requirements.docx) | Original Rekhta Academy v1.0 scope |
| 1 | [Product Vision](docs/01-product-vision.md) | White-label model, institution types, Pakistan context |
| 2 | [System Architecture](docs/02-system-architecture.md) | Request flows, NestJS + Supabase split, branch isolation |
| 3 | [Tech Stack](docs/03-tech-stack.md) | Library choices and rationale |
| 4 | [Monorepo Structure](docs/04-monorepo-structure.md) | Folder layout, package boundaries |
| 5 | [Naming Conventions](docs/05-naming-conventions.md) | Files, DB, API, env vars |
| 6 | [Types & Contracts](docs/06-types-and-contracts.md) | Shared types, Zod schemas, DTOs |
| 7 | [Database Design](docs/07-database-design.md) | Prisma models, entity map, branch scoping |
| 8 | [Auth & RBAC](docs/08-auth-and-rbac.md) | Supabase Auth, JWT, dynamic permissions |
| 9 | [API Design](docs/09-api-design.md) | REST conventions, errors, pagination |
| 10 | [Frontend Guidelines](docs/10-frontend-guidelines.md) | Next.js, shadcn, theming, forms |
| 11 | [Backend Guidelines](docs/11-backend-guidelines.md) | NestJS modules, guards, services |
| 12 | [Security](docs/12-security.md) | Auth, RLS, audit, Pakistan data validation |
| 13 | [Feature Modules](docs/13-feature-modules.md) | Module map, phased delivery |
| 14 | [White-Label Config](docs/14-white-label-config.md) | Branding, institution profiles, feature flags |
| 15 | [Deployment](docs/15-deployment.md) | Provisioning, env, CI/CD |
| 16 | [Coding Standards](docs/16-coding-standards.md) | Linting, testing, PRs, error handling |
| 17 | [Clone & Rebrand](docs/17-clone-and-rebrand.md) | Copy-paste checklist for new institutions |

### Templates

| File | Purpose |
|------|---------|
| [docs/templates/.env.web.example](docs/templates/.env.web.example) | Frontend environment variables |
| [docs/templates/.env.api.example](docs/templates/.env.api.example) | Backend environment variables |
| [docs/templates/institution-seed.example.json](docs/templates/institution-seed.example.json) | Blank institution config template |
| [docs/templates/rekhta.institution.json](docs/templates/rekhta.institution.json) | Rekhta Academy reference config |

## Core Principles

1. **No hardcoded institution names in code** — branding comes from `InstitutionSettings` and env vars.
2. **No hardcoded academic structures** — programs, batches, subjects, assessments are DB-configured.
3. **Branch-level data isolation** — every operational entity is scoped to a branch.
4. **Copy-paste deployments** — new customer = new Supabase project + config swap, no code forks.

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
# Fill in Supabase credentials and DATABASE_URL

# Run migrations (requires PostgreSQL)
npm run db:migrate

# Seed Rekhta Academy reference data
npm run db:seed -- --config=docs/templates/rekhta.institution.json

# Start API + Web (in separate terminals)
npm run dev -w @eims/api
npm run dev -w @eims/web
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1/health
- API docs (dev): http://localhost:3001/api/docs

## Progress

See [progress/README.md](progress/README.md) for feature completion status.

## License

Proprietary — Nexium Technologies.
