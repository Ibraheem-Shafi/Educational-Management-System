# Module: analytics

- **Phase:** 2
- **Requirements:** §13
- **API base:** `/api/v1/analytics`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Student performance (subject/test) | — | done | done | — | done | GET /analytics/performance |
| Attendance trends | — | done | done | — | done | Bar chart on `/dashboard/analytics` |
| Progress trends | — | done | done | — | done | 30-day KPIs on main dashboard |
| Rankings (batch, branch, program) | — | done | done | — | done | GET /analytics/rankings |
| Weak subject alerts | — | done | done | — | done | Configurable threshold |
| Batch performance comparison | — | done | done | — | done | Analytics page batch filter |
| Dashboard KPIs | — | done | done | — | done | Main dashboard + analytics page |
| Parent performance view | — | done | done | — | done | Parent portal assessments |

## Blockers

- None

## Related docs

- [docs/13-feature-modules.md](../docs/13-feature-modules.md)
