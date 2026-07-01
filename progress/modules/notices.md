# Module: notices

- **Phase:** 1
- **Requirements:** §14
- **API base:** `/api/v1/notices`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Create notice (title, body) | done | done | done | — | done | `/dashboard/notices` |
| Audience targeting | done | done | done | — | done | audience field |
| Publish / draft | done | done | done | — | done | isPublished |
| Realtime delivery | — | done | done | — | done | Supabase postgres_changes hook |
| Parent/student portal view | — | done | done | — | done | Portal pages |

## Related docs

- [docs/13-feature-modules.md](../docs/13-feature-modules.md)
