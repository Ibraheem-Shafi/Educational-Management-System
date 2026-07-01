# Module: students

- **Phase:** 1
- **Requirements:** §6
- **API base:** `/api/v1/students`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Student profile fields | done | done | done | — | done | List + detail views |
| Admission (create) | done | done | done | — | done | `/dashboard/students/new` |
| Get student by id | done | done | done | — | done | GET /students/:id |
| List with search/filter | done | done | done | — | done | Pagination, batchId, search |
| Status management | done | done | done | — | done | Lookup on admission form |
| Photo upload | done | done | done | — | done | Supabase `student-photos` bucket |
| Update / soft delete | done | done | done | — | done | `/dashboard/students/[id]` |
| Custom fields (form builder) | done | — | — | — | partial | customFields JSON; Phase 2 UI |

## Blockers

- None

## Related docs

- [docs/13-feature-modules.md](../docs/13-feature-modules.md)
