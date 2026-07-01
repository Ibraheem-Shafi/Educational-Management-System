# Module: fees

- **Phase:** 1
- **Requirements:** §11
- **API base:** `/api/v1/fee-types`, `/api/v1/fee-invoices`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Fee types (configurable) | done | done | done | — | done | Seeded for Rekhta |
| Create invoice | done | done | done | — | done | `/dashboard/fees` with discount, fine, due date |
| Record payment | done | done | done | — | done | PATCH /fee-invoices/:id/pay |
| Discounts / scholarships | done | done | done | — | done | discount field on create |
| Sibling discount (auto) | — | not_started | not_started | — | deferred | Phase 2 |
| Late fee fines | done | done | done | — | done | fine field on invoice create |
| Collection / defaulter reports | done | done | done | — | done | GET /reports/fee-defaulters + UI section |

## Blockers

- None

## Related docs

- [docs/13-feature-modules.md](../docs/13-feature-modules.md)
