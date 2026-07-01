# Module: parents

- **Phase:** 1
- **Requirements:** §7
- **API base:** `/api/v1/parents`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Parent entity | done | done | done | — | done | CRUD API + `/dashboard/parents` |
| Link to students (many-to-many) | done | done | done | — | done | Link/unlink endpoints |
| Relationships (father, mother, guardian) | done | done | done | — | done | relationshipCode on link |
| One parent → many students | done | done | done | — | done | |
| Parent portal (read-only) | — | done | done | — | done | `/portal/parent` |

## Blockers

- None

## Related docs

- [docs/13-feature-modules.md](../docs/13-feature-modules.md)
