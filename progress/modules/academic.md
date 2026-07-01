# Module: academic

- **Phase:** 1
- **Requirements:** §4
- **API base:** `/api/v1/programs`, `/batches`, `/subjects`, `/academic-sessions`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Programs (dynamic) | done | done | done | — | done | CRUD API + academic page tab |
| Batches | done | done | done | — | done | CRUD API + academic page tab |
| Subjects (institution-wide) | done | done | done | — | done | CRUD API + academic page tab |
| Academic sessions | done | done | done | — | done | CRUD API + academic page tab |
| Batch-subject assignment | done | done | done | — | done | `GET/PUT /batches/:id/subjects`; Assignments tab |
| Student-subject assignment | done | done | done | — | done | `GET/PUT /students/:id/subjects`; student detail page |

## Blockers

- None

## Related docs

- [docs/13-feature-modules.md](../docs/13-feature-modules.md)
- [docs/07-database-design.md](../docs/07-database-design.md)
