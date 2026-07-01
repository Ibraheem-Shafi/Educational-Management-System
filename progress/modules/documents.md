# Module: documents

- **Phase:** 2
- **Requirements:** §15
- **API base:** `/api/v1/documents`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Document entity | done | done | done | — | done | `Document` model |
| Upload to Supabase Storage | done | done | done | — | done | `student-documents` bucket |
| Link to student | done | done | done | — | done | studentId on create |
| Signed URL access | done | done | done | — | done | GET /documents/:id/signed-url |
| Document categories | done | done | done | — | done | admission_form, cnic, etc. |

## Blockers

- Create Supabase bucket `student-documents` for uploads

## Related docs

- [docs/13-feature-modules.md](../docs/13-feature-modules.md)
