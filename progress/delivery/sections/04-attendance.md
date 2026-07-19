# §4 — Attendance management

- **Source:** [docs/feature-details.md](../../docs/feature-details.md) §4
- **Phase:** 1–3 (core) · biometric Phase 7
- **Overall status:** partial
- **Implemented by:** [attendance](../../modules/attendance.md), [phase-3-future](../../modules/phase-3-future.md), [biometric-readiness](../modules/biometric-readiness.md)
- **Last updated:** 2026-07-17

## Acceptance items

| Item | Module | Status | Notes |
|------|--------|--------|-------|
| Student, teacher, and staff attendance | attendance | done | |
| Daily and bulk attendance marking | attendance | done | |
| Mobile-ready attendance workflow | attendance, phase-3-future | done | Responsive web / PWA |
| Batch/class and date-based attendance sheets | attendance | done | |
| Attendance history, summaries, and reports | attendance, analytics | done | |
| Parent and student attendance visibility | parents, portals | done | |
| AI-assisted attendance register image scanning with human confirmation | phase-3-future | done | OCR + confirm |
| Biometric-device integration readiness through supported vendor APIs | biometric-readiness | deferred | Phase 7 paused |
| Attendance alerts and absence communication workflows | communications | done | Auto SMS/WhatsApp to parents on mark-absent; deduped per day |
