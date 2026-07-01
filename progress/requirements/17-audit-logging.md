# §17 — Audit Logging

- **Source:** ERP-Requirements.docx §17
- **Phase:** 1
- **Overall status:** done
- **Implemented by:** [audit](../modules/audit.md)
- **Last updated:** 2026-06-30

## Acceptance items

| Item (from client doc) | Module | Status | Notes |
|------------------------|--------|--------|-------|
| Log create/update/delete actions | [audit](../modules/audit.md) | done | AuditService wired |
| Actor (user), entity, timestamp | [audit](../modules/audit.md) | done | Model + service |
| Before/after values (JSON) | [audit](../modules/audit.md) | done | oldValues/newValues |
| Audit log viewer (admin) | [audit](../modules/audit.md) | done | `/dashboard/audit` |
| Filter by user, entity, date | [audit](../modules/audit.md) | done | Query params on API |
