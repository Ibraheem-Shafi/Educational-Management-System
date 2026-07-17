# Module: certificates

- **Phase:** 4
- **Feature-details:** §2
- **API base:** `/api/v1/certificates`, `/api/v1/id-cards`
- **Overall status:** done
- **Last updated:** 2026-07-17

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Certificate templates and generation | done | done | done | — | done | Completion, transfer, character; browser print |
| Printable student ID cards | done | done | done | — | done | `/print/id-cards/[studentId]` |
| Certificate issuance history | done | done | done | — | done | `/dashboard/certificates` |

## Blockers

- None

## Related docs

- [docs/feature-details.md](../../docs/feature-details.md) §2
- [sections/02-student-information.md](../sections/02-student-information.md)
- [progress/modules/documents.md](../../modules/documents.md)
