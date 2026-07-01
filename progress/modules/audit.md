# Module: audit

- **Phase:** 1
- **Requirements:** §17
- **API base:** `/api/v1/audit-logs`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| AuditLog model (immutable) | done | — | — | — | done | |
| Auto-log on mutations | done | done | — | — | done | AuditService wired across modules |
| View logs API | done | done | done | — | done | GET /audit-logs with filters |
| Filter by user, action, entity, date | done | done | done | — | done | `/dashboard/audit` |
| Admin audit UI | — | done | done | — | done | |

## Blockers

- None

## Related docs

- [docs/11-backend-guidelines.md](../docs/11-backend-guidelines.md)
- [docs/12-security.md](../docs/12-security.md)
