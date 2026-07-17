# Module: android-apps

- **Phase:** 7
- **Feature-details:** §13, §14, §16
- **API base:** existing `/api/v1/*` (same institution accounts)
- **Overall status:** deferred
- **Last updated:** 2026-07-17

Paused by product decision — not in current ship scope. Scaffold may exist under `apps/mobile`; do not treat as release-ready until this module is actively resumed.

## Features

| Feature | DB | API | Web | Tests | Status | Notes |
|---------|----|-----|-----|-------|--------|-------|
| Parent Android app (branded) | — | — | deferred | — | deferred | Expo scaffold optional |
| Student Android app (branded) | — | — | deferred | — | deferred | |
| Secure sign-in (same institution accounts) | — | — | deferred | — | deferred | |
| Parent child-switching | — | — | deferred | — | deferred | Exists on web portal |
| Portal feature parity on mobile | — | — | deferred | — | deferred | |
| Push-notification readiness | done | done | deferred | — | partial | `DevicePushToken` + `POST /device-tokens` API ready; native register deferred |
| White-label (name, logo, colors, contact) | — | — | deferred | — | deferred | Web white-label done |
| APK and AAB release builds | — | — | deferred | — | deferred | See [docs/18-android-apps.md](../../docs/18-android-apps.md) |
| Phone and tablet screen support | — | — | deferred | — | deferred | |
| Secure API to dedicated deployment | — | — | deferred | — | deferred | API multi-tenant ready |

## Blockers

- Explicitly deferred — resume when ready to ship native clients
- Interim: responsive web + PWA portals

## Related docs

- [docs/18-android-apps.md](../../docs/18-android-apps.md)
- [docs/feature-details.md](../../docs/feature-details.md) §13, §14, §16
- [sections/16-android-apps.md](../sections/16-android-apps.md)
