# §14 — Communication

- **Source:** ERP-Requirements.docx §14
- **Phase:** 1
- **Overall status:** done
- **Implemented by:** [notices](../modules/notices.md), [users](../modules/users.md), [phase-3-future](../modules/phase-3-future.md)
- **Last updated:** 2026-07-01

## Acceptance items

| Item (from client doc) | Module | Status | Notes |
|------------------------|--------|--------|-------|
| In-app notices / announcements | [notices](../modules/notices.md) | done | CRUD + publish + delete |
| Target audience (all, branch, class) | [notices](../modules/notices.md) | done | audience field |
| Realtime notice delivery | [notices](../modules/notices.md) | done | Supabase Realtime hook |
| Portal notice display | [notices](../modules/notices.md) | done | Parent + student portals |
| Email notifications | [phase-3-future](../modules/phase-3-future.md) | done | Resend: invitations, notices, fee reminders |
| SMS / WhatsApp | [phase-3-future](../modules/phase-3-future.md) | done | Event alerts (notice, absence, fees, results); institution Twilio keys |
| Fee reminders | [fees](../modules/fees.md) | done | SMS/WhatsApp + email fallback |
