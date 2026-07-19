# Module: biometric-readiness

- **Phase:** 7
- **Feature-details:** §4
- **API base:** `/api/v1/biometric`, `/api/v1/biometric/webhooks`
- **Overall status:** deferred
- **Last updated:** 2026-07-17

Paused by product decision — not in current ship scope. Scaffold may exist under `apps/api` / `apps/web` dashboard; do not treat as acceptance criteria until resumed.

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Device registry and vendor adapter stubs | deferred | deferred | deferred | — | deferred | |
| Inbound attendance webhook / sync API | deferred | deferred | — | — | deferred | |
| Device mapping to branch / staff | deferred | deferred | deferred | — | deferred | |
| Integration docs and env configuration | — | — | — | — | deferred | `BIOMETRIC_WEBHOOK_SECRET` in env example |

## Blockers

- Explicitly deferred — resume when hardware integration is required
- Manual + OCR attendance remain the supported paths

## Related docs

- [docs/feature-details.md](../../docs/feature-details.md) §4
- [sections/04-attendance.md](../sections/04-attendance.md)
- [progress/modules/attendance.md](../../modules/attendance.md)
