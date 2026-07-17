# Android Mobile Apps (Phase 7)

> **Status: deferred.** Native parent/student Android apps are not in the current ship scope. Use the web portals (and PWA) until this work is resumed. This document is kept so builds can start quickly when needed.

Parent and student Android apps built with **Expo SDK 52** and **Expo Router**, sharing the same EIMS portal API as the web app.

## Apps

| Flavor | Package ID | App name | Start command |
|--------|------------|----------|---------------|
| Parent | `pk.edu.nexium.parent` | Nexium Parent | `npm run mobile:parent` |
| Student | `pk.edu.nexium.student` | Nexium Student | `npm run mobile:student` |

Both apps live in `apps/mobile`. The active flavor is selected at **build/start time** via `APP_ROLE` (`parent` or `student`).

## Prerequisites

- Node.js 20+
- Android Studio (emulator) or a physical Android device with [Expo Go](https://expo.dev/go) for local dev
- [EAS CLI](https://docs.expo.dev/build/setup/) for cloud builds: `npm i -g eas-cli`
- Running EIMS API (`apps/api`) and Supabase project (same as web)

## Environment variables

Copy the example file:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | NestJS API base URL (no `/api/v1` suffix), e.g. `http://localhost:3001` |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Expo project ID (required for push tokens in dev builds) |

Build-time only (set by npm scripts or EAS):

| Variable | Values |
|----------|--------|
| `APP_ROLE` | `parent` \| `student` |

EAS build profiles in `apps/mobile/eas.json` set `APP_ROLE` per profile (`preview`, `preview-student`, `production`, `production-student`, etc.).

## Run locally (Windows)

From the repo root:

```powershell
# Install dependencies (first time)
npm install

# Start API
npm run dev -w @eims/api

# Parent app
npm run mobile:parent

# Student app (separate terminal)
npm run mobile:student
```

Scan the QR code with Expo Go, or press `a` to open the Android emulator.

> Use your machine's LAN IP in `EXPO_PUBLIC_API_URL` when testing on a physical device (not `localhost`).

## Auth flow

1. Email/password via Supabase (`lib/supabase.ts` + SecureStore session).
2. After login, `GET /auth/me` validates the JWT and loads the EIMS user.
3. If `roles` does not include the app flavor (`parent` or `student`), the app signs out and shows an error.
4. On successful login, the app requests notification permission and registers an Expo push token via `POST /device-tokens`.

## EAS build

```bash
cd apps/mobile
eas login
eas build:configure   # first time only

# Parent preview APK
eas build --profile preview --platform android

# Student preview APK
eas build --profile preview-student --platform android

# Production AAB (Play Store)
eas build --profile production --platform android
eas build --profile production-student --platform android
```

Set secrets in the EAS project dashboard or `eas secret:create` for `EXPO_PUBLIC_*` values.

## Play Console checklist

- [ ] Create two apps (parent + student) or one app with separate listings per white-label deployment
- [ ] Upload AAB from `production` / `production-student` profiles
- [ ] Set package name: `pk.edu.nexium.parent` / `pk.edu.nexium.student` (or overridden — see below)
- [ ] Privacy policy URL (required for apps using auth + notifications)
- [ ] Data safety form: account info, device identifiers (push token)
- [ ] Content rating questionnaire
- [ ] Internal testing track → closed testing → production rollout
- [ ] Configure Firebase / FCM if moving beyond Expo push stub (future phase)

## White-label package override

For cloned deployments, override Android package IDs in `apps/mobile/app.config.ts`:

```typescript
android: {
  package: role === 'student'
    ? 'pk.edu.yourinstitution.student'
    : 'pk.edu.yourinstitution.parent',
},
```

Also update `name`, `slug`, and `scheme` for store listings. Institution branding (name, primary color) is loaded at runtime from `GET /settings/institution` — no code change required for colors.

See [14-white-label-config.md](./14-white-label-config.md) for full white-label guidance.

## Project structure

```
apps/mobile/
├── app.config.ts          # Role-based Expo config
├── eas.json               # EAS build profiles
├── app/
│   ├── _layout.tsx        # Providers (Query, Auth, Theme, Child)
│   ├── index.tsx          # Auth redirect
│   ├── login.tsx
│   └── (tabs)/            # Home, Attendance, Fees, Learning, More
├── lib/
│   ├── api.ts             # Bearer fetch to /api/v1
│   ├── supabase.ts        # SecureStore auth adapter
│   ├── auth-context.tsx   # Session + role gate
│   ├── child-context.tsx  # Parent child switcher state
│   ├── theme-context.tsx  # Institution primaryColor
│   └── push.ts            # Expo push token registration
└── components/
```

## API: device tokens

Backend module: `apps/api/src/modules/device-tokens`

| Method | Path | Body |
|--------|------|------|
| POST | `/api/v1/device-tokens` | `{ token, platform, appRole }` |
| DELETE | `/api/v1/device-tokens` | `{ token }` |

Schema: `packages/shared/src/schemas/device-token.schema.ts`  
Prisma model: `DevicePushToken` in `packages/database/prisma/schema.prisma`

Push delivery is stubbed in `PushService` for a later phase.
