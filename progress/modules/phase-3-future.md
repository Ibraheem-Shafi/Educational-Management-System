# Module: phase-3-future

- **Phase:** 3
- **Requirements:** §10, §14 (future), §19, §20
- **API base:** `/api/v1/ai-attendance`, `/api/v1/communications`, `/api/v1/ai-insights`
- **Overall status:** done (web MVP — native apps deferred)
- **Last updated:** 2026-09-08

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| AI attendance OCR (§10) | done | done | done | — | done | Upload → analyze → human confirm |
| SMS integration | done | done | done | — | done | Twilio; stub when env unset |
| WhatsApp integration | done | done | done | — | done | Business API templates + delivery webhook |
| Fee reminders / notice broadcast | done | done | done | — | done | Event-triggered: publish notice, Fees reminders, absence, results |
| AI parent performance summaries | — | done | done | — | done | Parent portal + OpenAI optional |
| AI student risk detection | — | done | done | — | done | Rule-based at-risk list |
| AI trend analysis / recommendations | — | done | done | — | done | Template or OpenAI narrative |
| PWA / responsive mobile portal | — | — | done | — | done | manifest + bottom nav |
| Parent mobile app (native) | — | — | — | — | deferred | §20 — same API later |
| Student mobile app (native) | — | — | — | — | deferred | §20 |
| Admin mobile app (native) | — | — | — | — | deferred | §20 |
| Teacher mobile app (native) | — | — | — | — | deferred | §20 |

## Blockers

- None for web MVP

## Related docs

- [requirements/10-ai-attendance.md](../requirements/10-ai-attendance.md)
- [requirements/19-ai-features.md](../requirements/19-ai-features.md)
- [requirements/20-mobile-apps.md](../requirements/20-mobile-apps.md)
