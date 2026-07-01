# Module: form-builder

- **Phase:** 2
- **Requirements:** §16
- **API base:** `/api/v1/form-fields`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Custom admission field definitions | done | done | done | — | done | `/dashboard/form-fields` |
| Field types (text, number, date, etc.) | done | done | done | — | done | dropdown, checkbox supported |
| Store values in Student.customFields | done | done | done | — | done | On admission create |
| Dynamic admission form render | — | done | done | — | done | `/dashboard/students/new` |
| File upload field type | — | done | done | — | done | Stored in customFields |
| View custom fields on profile | — | done | done | — | done | Student detail page |

## Blockers

- None

## Related docs

- [docs/13-feature-modules.md](../docs/13-feature-modules.md)
