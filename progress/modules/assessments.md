# Module: assessments

- **Phase:** 1
- **Requirements:** §5
- **API base:** `/api/v1/assessments`, `/api/v1/assessment-records`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Assessment types (dynamic) | done | done | done | — | done | Seeded + API |
| Assessment series (FLP, etc.) | done | done | partial | — | done | CRUD API; seeded; select on marks entry |
| Create assessment | done | done | done | — | done | `/dashboard/assessments` |
| Enter marks per student/subject | done | done | done | — | done | Marks sheet UI |
| Percentage, grade, rank | done | done | done | — | done | Computed on save |
| Bulk marks entry | done | done | done | — | done | POST bulk marks |
| Remarks per record | done | done | done | — | done | |

## Blockers

- None

## Related docs

- [docs/13-feature-modules.md](../docs/13-feature-modules.md)
