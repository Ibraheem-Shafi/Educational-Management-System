# Module: settings

- **Phase:** 1
- **Requirements:** §4, white-label
- **API base:** `/api/v1/settings`
- **Overall status:** done
- **Last updated:** 2026-07-01

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Institution profile (name, contact, address) | done | done | done | — | done | GET/PATCH /settings/institution |
| Logo / favicon URLs | done | done | done | — | done | Upload to Supabase `institution-assets` |
| Primary color / theming | done | done | done | — | done | CSS variable --institution-primary |
| Terminology overrides | done | done | done | — | done | Settings page editor |
| Feature flags | done | done | done | — | done | Parent/student portal toggles |
| Lookup management (statuses) | done | done | done | — | done | CRUD for student_status |
| System preferences (timezone, currency) | done | done | done | — | done | Settings page fields |
| Fee policy (sibling discount, late fees) | done | done | done | — | done | `siblingDiscountPercent`, `lateFeeAmount`, `lateFeeDaysAfterDue` |

## Blockers

- None

## Related docs

- [docs/14-white-label-config.md](../docs/14-white-label-config.md)
