# Monorepo Structure

## Overview

The project uses **Turborepo** with **pnpm workspaces**. All apps and packages live in a single repository with shared tooling and types.

```
Educational-institution-management-system/
├── apps/
│   ├── web/                        # Next.js 15 frontend
│   └── api/                        # NestJS 11 REST API
├── packages/
│   ├── database/                   # Prisma schema, migrations, seed
│   ├── shared/                     # Zod schemas, constants, utils
│   ├── types/                      # TypeScript interfaces
│   ├── ui/                         # Shared shadcn components (optional)
│   └── config/                     # ESLint, TSConfig, Tailwind presets
├── docs/                           # Documentation
├── docs/templates/                 # Env and seed templates
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .gitignore
├── .prettierrc
└── README.md
```

## Workspace Configuration

### pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### turbo.json (task pipeline)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:seed": {
      "cache": false
    }
  }
}
```

### Root package.json scripts

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "db:generate": "pnpm --filter @eims/database db:generate",
    "db:migrate": "pnpm --filter @eims/database db:migrate",
    "db:seed": "pnpm --filter @eims/database db:seed"
  }
}
```

## apps/web — Next.js Frontend

```
apps/web/
├── public/
│   └── favicon.ico                 # Default only; runtime logo from Storage
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, providers, Toaster
│   │   ├── page.tsx                # Redirect to dashboard or login
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── invite/[token]/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx          # Sidebar, institution branding
│   │       ├── page.tsx            # Role-based dashboard redirect
│   │       ├── students/
│   │       ├── attendance/
│   │       ├── assessments/
│   │       ├── fees/
│   │       ├── notices/
│   │       ├── settings/
│   │       └── ...
│   ├── components/
│   │   ├── ui/                     # shadcn primitives
│   │   ├── layout/                 # Sidebar, Header, Breadcrumb
│   │   └── features/               # Domain-specific components
│   │       ├── students/
│   │       ├── attendance/
│   │       └── ...
│   ├── hooks/
│   │   ├── use-institution.ts
│   │   ├── use-permissions.ts
│   │   └── features/
│   ├── lib/
│   │   ├── api-client.ts           # Fetch wrapper with auth header
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser client
│   │   │   └── server.ts           # Server Component client
│   │   └── utils.ts                # cn() helper
│   └── providers/
│       ├── query-provider.tsx
│       ├── auth-provider.tsx
│       └── institution-provider.tsx
├── next.config.ts
├── tailwind.config.ts              # Extends packages/config
├── tsconfig.json                   # Extends packages/config
├── package.json
└── .env.local                      # Not committed
```

**Package name:** `@eims/web`

**Dependencies:** `@eims/types`, `@eims/shared`, `@eims/ui`, `@eims/config`

## apps/api — NestJS Backend

```
apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── branch-scope.decorator.ts
│   │   │   ├── permissions.decorator.ts
│   │   │   └── current-user.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   ├── branch.guard.ts
│   │   │   └── permissions.guard.ts
│   │   ├── interceptors/
│   │   │   └── audit.interceptor.ts
│   │   └── pipes/
│   │       └── zod-validation.pipe.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── branches/
│   │   ├── academic/
│   │   ├── students/
│   │   ├── parents/
│   │   ├── users/
│   │   ├── attendance/
│   │   ├── assessments/
│   │   ├── fees/
│   │   ├── timetable/
│   │   ├── analytics/
│   │   ├── notices/
│   │   ├── documents/
│   │   ├── form-builder/
│   │   ├── audit/
│   │   └── settings/
│   └── prisma/
│       └── prisma.module.ts        # Re-exports @eims/database
├── nest-cli.json
├── tsconfig.json
├── package.json
└── .env                            # Not committed
```

**Package name:** `@eims/api`

**Standard module structure:**

```
modules/students/
├── students.module.ts
├── students.controller.ts
├── students.service.ts
├── dto/
│   ├── create-student.dto.ts       # Re-exports Zod schema type
│   └── update-student.dto.ts
└── students.service.spec.ts
```

## packages/database — Prisma

```
packages/database/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                     # Reads institution JSON config
├── src/
│   └── index.ts                    # export { PrismaClient }
├── package.json
└── tsconfig.json
```

**Package name:** `@eims/database`

**Scripts:**
- `db:generate` — `prisma generate`
- `db:migrate` — `prisma migrate dev`
- `db:seed` — `tsx prisma/seed.ts`

## packages/types — Shared TypeScript Contracts

```
packages/types/
├── src/
│   ├── entities/
│   │   ├── student.ts
│   │   ├── branch.ts
│   │   ├── institution-settings.ts
│   │   └── ...
│   ├── api/
│   │   ├── students/
│   │   │   ├── create-student.request.ts
│   │   │   ├── student.response.ts
│   │   │   └── list-students.query.ts
│   │   └── ...
│   ├── enums/
│   │   ├── sort-order.ts           # Technical only
│   │   └── institution-type.ts     # coaching | school | college
│   └── index.ts
├── package.json
└── tsconfig.json
```

**Package name:** `@eims/types`

**Rule:** No runtime dependencies. Pure types and interfaces.

## packages/shared — Schemas, Constants, Utils

```
packages/shared/
├── src/
│   ├── schemas/
│   │   ├── student.schema.ts       # Zod schemas
│   │   ├── auth.schema.ts
│   │   └── ...
│   ├── constants/
│   │   ├── pakistan.ts             # CNIC, phone regex
│   │   ├── permissions.ts          # Permission code constants
│   │   └── defaults.ts
│   └── utils/
│       ├── grade.ts                # Grade calculation
│       ├── currency.ts             # PKR formatting
│       ├── percentage.ts
│       └── date.ts
├── package.json
└── tsconfig.json
```

**Package name:** `@eims/shared`

**Dependencies:** `zod`, `date-fns`, `@eims/types`

## packages/ui — Shared Components (optional)

```
packages/ui/
├── src/
│   ├── button.tsx
│   ├── data-table.tsx
│   └── ...
├── package.json
└── tsconfig.json
```

**Package name:** `@eims/ui`

Use when a component is needed in multiple apps. App-specific components stay in `apps/web/src/components/`.

## packages/config — Shared Tooling

```
packages/config/
├── eslint/
│   ├── base.js
│   ├── next.js
│   └── nest.js
├── typescript/
│   ├── base.json
│   ├── nextjs.json
│   └── nestjs.json
├── tailwind/
│   └── preset.ts
└── package.json
```

**Package name:** `@eims/config`

## Package Dependency Graph

```
@eims/config          (no internal deps)
@eims/types           (no internal deps)
@eims/database        (no internal deps)
@eims/shared          → @eims/types
@eims/ui              → @eims/config
@eims/web             → @eims/types, @eims/shared, @eims/ui, @eims/config
@eims/api             → @eims/types, @eims/shared, @eims/database
```

**Forbidden:**
- `@eims/types` must not depend on `@eims/shared` (types are the foundation)
- `apps/web` must not depend on `@eims/database` (no direct DB access from frontend)
- Circular dependencies between any packages

## Import Aliases

| Package | Import alias |
|---------|-------------|
| `@eims/types` | `import type { Student } from '@eims/types'` |
| `@eims/shared` | `import { createStudentSchema } from '@eims/shared/schemas'` |
| `@eims/database` | `import { PrismaClient } from '@eims/database'` |
| `@eims/ui` | `import { Button } from '@eims/ui'` |

Within `apps/web`, use `@/` for local imports:

```typescript
import { StudentTable } from '@/components/features/students/student-table';
```

## docs/ — Documentation

All markdown docs numbered `01` through `17`. Templates in `docs/templates/`.

**Do not** put runtime code in `docs/`. Only examples and reference configs.

## Related Documents

- [05-naming-conventions.md](05-naming-conventions.md) — naming rules for all folders
- [06-types-and-contracts.md](06-types-and-contracts.md) — types package details
- [03-tech-stack.md](03-tech-stack.md) — library choices
