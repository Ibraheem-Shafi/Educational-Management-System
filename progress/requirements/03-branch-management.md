# §3 — Branch Management

- **Source:** ERP-Requirements.docx §3
- **Phase:** 1
- **Overall status:** done
- **Implemented by:** [branches](../modules/branches.md)
- **Last updated:** 2026-06-30

## Acceptance items

| Item (from client doc) | Module | Status | Notes |
|------------------------|--------|--------|-------|
| Unlimited branches | [branches](../modules/branches.md) | done | Create + list UI |
| Independent branch operations | [branches](../modules/branches.md) | done | BranchGuard on API |
| Branch-specific staff | [users](../modules/users.md) | done | branchId on users |
| Branch-specific students | [students](../modules/students.md) | done | branchId on create |
| Branch settings / branding | [settings](../modules/settings.md) | done | Institution-wide + branch context |
| Branch data isolation | [infrastructure](../modules/infrastructure.md) | done | branchId scoping |
