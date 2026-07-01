# Module: users

- **Phase:** 1
- **Requirements:** §8
- **API base:** `/api/v1/users`, `/api/v1/invitations`
- **Overall status:** done
- **Last updated:** 2026-06-30

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Invitation record + token | done | done | done | — | done | POST /invitations |
| Send invitation email | done | done | partial | — | done | Resend via EmailService; copy-link fallback in UI |
| Verify / accept invitation | done | done | done | — | done | `/accept-invite` |
| 10-step onboarding workflow | done | partial | partial | — | done | Core invite→accept→login→staff/student setup |
| Role assignment (UserRole) | done | done | done | — | done | RBAC seeded + invite roles |
| Staff management CRUD | done | done | done | — | done | List + deactivate at `/dashboard/users` |
| User profile update | done | done | done | — | done | `/dashboard/profile`; PATCH /auth/me |
| Deactivate user | done | done | done | — | done | PATCH /users/:id `{ isActive: false }` |

## Blockers

- None for Rekhta MVP

## Related docs

- [docs/08-auth-and-rbac.md](../docs/08-auth-and-rbac.md)
- [requirements/08-onboarding-workflow.md](../requirements/08-onboarding-workflow.md)
