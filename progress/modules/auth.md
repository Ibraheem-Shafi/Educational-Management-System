# Module: auth

- **Phase:** 1
- **Requirements:** §8, §18
- **API base:** `/api/v1/auth`
- **Overall status:** done
- **Last updated:** 2026-07-01

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Login / logout | done | done | done | — | done | Supabase signIn/signOut |
| Password reset | — | — | done | — | done | `/forgot-password` |
| MFA (admin TOTP) | — | done | done | — | done | Enroll at login; AAL2 enforced in AuthGuard |
| Session management | done | done | done | — | done | List/revoke on profile |
| Current user endpoint | done | done | done | — | done | GET/PATCH /auth/me |
| Invitation accept | done | done | done | e2e | done | Public invitation flow |
| Portal endpoints | done | done | done | — | done | Parent/student portals |
| JWT verification guard | — | done | — | — | done | AuthGuard + MFA AAL2 check |
| Role-based redirect | — | — | done | — | done | StaffGuard + auth-redirect |
| Supabase app_metadata sync | — | done | — | — | done | branch_id + role for RLS |

## Related docs

- [docs/08-auth-and-rbac.md](../docs/08-auth-and-rbac.md)
- [docs/12-security.md](../docs/12-security.md)
