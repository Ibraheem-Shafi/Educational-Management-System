# Mobile App (Parent, Student, Teacher)

One **Expo SDK 52** app for Android and iOS. After login, `/auth/me` opens the parent, student, or teacher portal. Other staff roles are blocked and asked to use the web dashboard.

## Run locally

```powershell
cp apps/mobile/.env.example apps/mobile/.env
npm install
npm run dev -w @eims/api
npm run mobile
```

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | NestJS API base (no `/api/v1`), e.g. `http://192.168.x.x:3001` on a device |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Required for Expo push tokens in dev builds |

Package ID: `pk.edu.nexium.app` (Android and iOS).

## Auth

1. Email/password via Supabase (session in SecureStore).
2. `GET /auth/me` loads roles.
3. `teacher` / `parent` / `student` enter their portal. Admins and other staff are signed out.
4. Push token is registered with `appRole` and unregistered on sign-out.
5. Forgot password uses Supabase `resetPasswordForEmail`.

## Portals

**Parent tabs:** Home · Children · Learning · Fees · More  
**Student tabs:** Home · Learning · Attendance · Fees · More  
**Teacher tabs:** Home · Attendance · Class · Learning · More  

Teacher writes (attendance, marks, learning publish) are limited to classes assigned on the timetable.

## EAS build

```bash
cd apps/mobile
eas login
eas build --profile preview --platform android
eas build --profile production --platform android
eas build --profile production --platform ios
```

## Android Studio (after you move the folder)

Expo remains the app source. Generate native projects when you need Studio:

```bash
cd apps/mobile
npx expo prebuild
```

Open `android/` in Android Studio. Re-run `prebuild` after changing `app.config.ts` native settings.

## Project structure

```
apps/mobile/
├── app.config.ts
├── app/(auth)            # login, forgot password
├── app/parent            # parent portal
├── app/student           # student portal
├── app/teacher           # teacher portal
├── screens/              # shared screen implementations
├── components/
└── lib/                  # api, auth, theme, push, query cache
```
