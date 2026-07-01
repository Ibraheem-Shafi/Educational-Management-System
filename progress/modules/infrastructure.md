# Module: infrastructure

- **Phase:** —
- **Requirements:** §18, §21
- **API base:** `/api/v1/health`
- **Overall status:** done
- **Last updated:** 2026-07-01

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Monorepo (Turborepo, npm workspaces) | — | — | — | — | done | |
| Shared packages | — | — | — | — | done | |
| Prisma schema | done | — | — | — | done | |
| Seed script + institution JSON | done | — | — | — | done | |
| Auth / Branch / Permissions guards | — | done | — | — | done | |
| Zod validation pipe | — | done | — | — | done | |
| Audit service | done | done | — | — | done | |
| Health endpoint | — | done | — | — | done | |
| Supabase RLS policies | done | — | — | — | done | `packages/database/supabase/rls.sql` |
| CI pipeline (lint, build) | — | — | — | — | done | `.github/workflows/ci.yml` |
| E2E tests (Playwright) | — | — | — | done | done | smoke + critical-path specs |

## Related docs

- [docs/04-monorepo-structure.md](../docs/04-monorepo-structure.md)
- [docs/12-security.md](../docs/12-security.md)
