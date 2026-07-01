# §6 — Student Management

- **Source:** ERP-Requirements.docx §6
- **Phase:** 1
- **Overall status:** done
- **Implemented by:** [students](../modules/students.md)
- **Last updated:** 2026-06-30

## Acceptance items

| Item (from client doc) | Module | Status | Notes |
|------------------------|--------|--------|-------|
| Personal info (name, DOB, gender, CNIC/B-Form) | [students](../modules/students.md) | done | Admission + detail forms |
| Contact info (phone, email, address) | [students](../modules/students.md) | done | |
| Photograph | [students](../modules/students.md) | done | Supabase `student-photos` upload |
| Program, batch, subjects assignment | [students](../modules/students.md) | done | Admission + subject enrollment |
| Status (Active, Inactive, Suspended, etc.) | [students](../modules/students.md) | done | Lookup on admission |
| Search & filter | [students](../modules/students.md) | done | API + list page |
| Soft delete | [students](../modules/students.md) | done | DELETE /students/:id |
