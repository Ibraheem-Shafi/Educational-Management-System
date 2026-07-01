# Module: attendance

- **Phase:** 1
- **Requirements:** §9
- **API base:** `/api/v1/attendance`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Student attendance | done | done | done | — | done | `/dashboard/attendance` student tab |
| Teacher attendance | done | done | done | — | done | Staff sheet with entityType teacher |
| Staff attendance | done | done | done | — | done | Staff sheet with entityType staff |
| Statuses (present, absent, leave, late) | done | done | done | — | done | Lookup API + UI |
| Mark by date | done | done | done | — | done | |
| Bulk mark (entire batch) | done | done | done | — | done | POST /attendance/bulk + staff-bulk |
| View history / date range | done | done | done | — | done | GET /attendance/history; student detail + portals |

## Blockers

- None

## Related docs

- [docs/13-feature-modules.md](../docs/13-feature-modules.md)
