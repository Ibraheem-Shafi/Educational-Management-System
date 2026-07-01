# §8 — Onboarding Workflow

- **Source:** ERP-Requirements.docx §8
- **Phase:** 1
- **Overall status:** done
- **Implemented by:** [users](../modules/users.md), [auth](../modules/auth.md), [branches](../modules/branches.md), [students](../modules/students.md), [parents](../modules/parents.md)
- **Last updated:** 2026-06-30

## Acceptance items

| Step | Item | Module | Status | Notes |
|------|------|--------|--------|-------|
| 1 | Super Admin creates branch | [branches](../modules/branches.md) | done | POST /branches + UI |
| 2 | Super Admin creates Branch Admin | [users](../modules/users.md) | done | Invite with role |
| 3 | Invitation email sent | [users](../modules/users.md) | done | Resend EmailService |
| 4 | Branch Admin activates account | [auth](../modules/auth.md) | done | `/accept-invite` + login |
| 5 | Branch Admin creates staff | [users](../modules/users.md) | done | Invite flow |
| 6 | Staff invitation emails | [users](../modules/users.md) | done | Same invite pipeline |
| 7 | Student admission | [students](../modules/students.md) | done | `/dashboard/students/new` |
| 8 | Parent accounts linked | [parents](../modules/parents.md) | done | Link students on parents page |
| 9 | Student/parent invitation emails | [users](../modules/users.md) | done | Invite with parent/student roles |
| 10 | Users set passwords and activate | [auth](../modules/auth.md) | done | Supabase auth on accept |
