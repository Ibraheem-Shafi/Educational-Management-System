# §18 — Security, control, and administration

- **Source:** [docs/feature-details.md](../../docs/feature-details.md) §18
- **Phase:** 1–3
- **Overall status:** done
- **Implemented by:** [auth](../../modules/auth.md), [audit](../../modules/audit.md), [settings](../../modules/settings.md), [form-builder](../../modules/form-builder.md), [infrastructure](../../modules/infrastructure.md)
- **Last updated:** 2026-07-17

## Acceptance items

| Item | Module | Status | Notes |
|------|--------|--------|-------|
| Role-based access and permissions | auth, users | done | |
| Branch-level data isolation | branches, infrastructure | done | RLS + guards |
| Administrative multi-factor authentication | auth | done | |
| Audit trail for important user actions | audit | done | |
| User invitations and account lifecycle controls | users | done | |
| Session visibility and revocation | auth | done | |
| Institution feature settings | settings | done | |
| Custom admission fields | form-builder | done | |
| Dedicated institutional deployment and database | infrastructure | done | Clone/rebrand docs |
