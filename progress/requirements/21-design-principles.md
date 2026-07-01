# §21 — Design Principles

- **Source:** ERP-Requirements.docx §21
- **Phase:** Cross-cutting (all phases)
- **Overall status:** partial
- **Implemented by:** [infrastructure](../modules/infrastructure.md), [settings](../modules/settings.md)
- **Last updated:** 2026-06-30

## Acceptance items

| Item (from client doc) | Module | Status | Notes |
|------------------------|--------|--------|-------|
| White-label / institution-agnostic | [settings](../modules/settings.md) | partial | InstitutionSettings + branding |
| No hardcoded institution names in code | [infrastructure](../modules/infrastructure.md) | done | Enforced in scaffold |
| Copy-paste deployment per customer | [infrastructure](../modules/infrastructure.md) | done | Monorepo + seed JSON |
| Modular architecture | [infrastructure](../modules/infrastructure.md) | done | NestJS modules |
| Scalable multi-branch | [branches](../modules/branches.md) | partial | |
| Configurable academic structure | [academic](../modules/academic.md) | partial | DB-driven |
| Configurable assessment types | [assessments](../modules/assessments.md) | partial | DB-driven |
| Clean, modern UI (shadcn) | [infrastructure](../modules/infrastructure.md) | partial | Web scaffold |
| Pakistan-specific fields (CNIC, B-Form) | [students](../modules/students.md) | partial | On model |
| Urdu/English support | [settings](../modules/settings.md) | not_started | i18n not started |
| Offline-capable (future) | [phase-3-future](../modules/phase-3-future.md) | deferred | |
