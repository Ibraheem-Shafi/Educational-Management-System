# Module: branches

- **Phase:** 1
- **Requirements:** §3
- **API base:** `/api/v1/branches`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Create branch | done | done | done | — | done | POST /branches |
| List branches | done | done | done | — | done | GET /branches |
| Get branch by id | done | done | — | — | done | GET /branches/:id |
| Update branch | done | done | done | — | done | PATCH /branches/:id; inline edit UI |
| Deactivate (soft delete) | done | done | done | — | done | DELETE /branches/:id; UI on branches page |
| Branch-scoped reporting filter | done | done | — | — | done | BranchGuard on API |

## Blockers

- None

## Related docs

- [docs/13-feature-modules.md](../docs/13-feature-modules.md)
