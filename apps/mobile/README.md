# EIMS Mobile App

One Expo app for **parents, students, and teachers**. Login chooses the portal from `/auth/me`.

## Run locally

From the repo root:

```bash
cp apps/mobile/.env.example apps/mobile/.env
npm install
npm run dev -w @eims/api
npm run mobile
```

Then scan the QR code with Expo Go, or press `a` / `i` for an emulator.

On a physical phone, set `EXPO_PUBLIC_API_URL` to your machine LAN IP (not `localhost`).

## Stack

- Expo SDK 52 + Expo Router + TypeScript
- NativeWind (Tailwind) with the web navy/teal palette
- Supabase Auth + NestJS `/api/v1`
- TanStack Query with a 30-minute offline-ish cache

## Later: Android Studio

When you move this folder out of the monorepo:

```bash
cd apps/mobile
npx expo prebuild
```

That generates `android/` and `ios/`. Open `android/` in Android Studio. Keep using Expo as the source of truth — do not eject.
