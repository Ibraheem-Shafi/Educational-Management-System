# Module: timetable

- **Phase:** 2
- **Requirements:** §12
- **API base:** `/api/v1/timetable`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Batch schedules | done | done | done | — | done | Weekly slots by day |
| Subject scheduling | done | done | done | — | done | Subject per slot |
| Teacher assignment | done | done | done | — | done | Optional teacherId |
| Room assignment | done | done | done | — | done | Room field |
| Conflict detection | — | done | done | — | done | Teacher + room conflicts API + UI |
| Views (batch, teacher, room) | — | done | done | — | done | Filter tabs on `/dashboard/timetable` |
| Student portal view | — | done | done | — | done | Batch timetable on `/portal/student` |
| Parent portal view | — | done | done | — | done | Per-child timetable on parent portal |

## Blockers

- None

## Related docs

- [docs/13-feature-modules.md](../docs/13-feature-modules.md)
