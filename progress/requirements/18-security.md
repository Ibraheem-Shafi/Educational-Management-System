# §18 — Security

- **Source:** ERP-Requirements.docx §18
- **Phase:** 1
- **Overall status:** done
- **Implemented by:** [auth](../modules/auth.md), [infrastructure](../modules/infrastructure.md)
- **Last updated:** 2026-07-01

## Acceptance items

| Item (from client doc) | Module | Status | Notes |
|------------------------|--------|--------|-------|
| Role-based access control | [auth](../modules/auth.md), [infrastructure](../modules/infrastructure.md) | done | Guards in place |
| Branch data isolation | [infrastructure](../modules/infrastructure.md) | done | BranchGuard + `packages/database/supabase/rls.sql` |
| Password policies | [auth](../modules/auth.md) | done | Supabase defaults |
| MFA (multi-factor auth) | [auth](../modules/auth.md) | done | TOTP enroll + AAL2 enforced for admins at login & API |
| Session management | [auth](../modules/auth.md) | done | List/revoke on profile |
| Supabase RLS policies | [infrastructure](../modules/infrastructure.md) | done | SQL script for branch-scoped tables |
| Audit logging | [audit](../modules/audit.md) | done | |
| HTTPS / secure headers | [infrastructure](../modules/infrastructure.md) | partial | Deployment concern |
