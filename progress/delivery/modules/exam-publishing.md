# Module: exam-publishing

- **Phase:** 4
- **Feature-details:** §6
- **API base:** `/api/v1/assessments` (extend), `/api/v1/report-cards`
- **Overall status:** done
- **Last updated:** 2026-07-17

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Result publish / unpublish workflow | done | done | done | — | done | draft → in_review → published |
| Teacher review and correction before publication | done | done | done | — | done | Submit for review; marks locked when published |
| Digital and printable report cards | done | done | done | — | done | `/print/report-cards/[studentId]` |
| Answer keys | done | done | done | — | done | On create/edit dialog |
| Result exports (enhanced) | done | done | done | — | done | `GET /assessments/:id/export.csv` + Export CSV on marks page |

## Blockers

- None

## Related docs

- [docs/feature-details.md](../../docs/feature-details.md) §6
- [sections/06-examinations.md](../sections/06-examinations.md)
