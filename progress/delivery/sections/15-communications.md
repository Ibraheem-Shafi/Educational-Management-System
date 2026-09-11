# §15 — Communications

- **Source:** [docs/feature-details.md](../../docs/feature-details.md) §15
- **Phase:** 1–3
- **Overall status:** done
- **Implemented by:** [notices](../../modules/notices.md), [phase-3-future](../../modules/phase-3-future.md)
- **Last updated:** 2026-09-08

## Acceptance items

| Item | Module | Status | Notes |
|------|--------|--------|-------|
| Individual SMS and WhatsApp workflows | phase-3-future | done | Institution Twilio keys; templates; SMS fallback off by default |
| Bulk communication to selected audiences | phase-3-future | done | Event alerts (notices, absences, fees, results) — not a blast composer |
| Notice broadcasting to parents, students, and staff | notices | done | Auto-queued when a notice is published |
| Fee-defaulter reminders | phase-3-future | done | Fees → Defaulters → Send reminders |
| Message logs and delivery status where supported by the provider | phase-3-future | done | Twilio status webhook (sent/delivered/read/failed) |
| Institution-wide announcements through portals | notices | done | |
