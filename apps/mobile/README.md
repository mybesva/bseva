# BSeva mobile (Customer + Pujari)

One Expo app. Admin remains web-only.

## Run (Expo Go)

```bash
cd apps/mobile
cp .env.example .env
# set EXPO_PUBLIC_API_URL if FastAPI is not on localhost:8000
pnpm install
pnpm start
```

On Android 15+ emulators you may see a **16 KB page size** warning from Expo Go. Tap **OK** or **Don't Show Again**. The app still runs.

This project is on **Expo SDK 53** (16 KB-aligned native builds). Use the Expo Go build for SDK 53 from https://expo.dev/go — the Play Store Expo Go may be a newer SDK.

A production APK (`eas build --profile preview`) does not include Expo Go’s extra libraries (Skia, ML Kit, Crashlytics) and is the path that actually satisfies 16 KB page size.

A physical phone cannot reach `localhost`. Use your computer LAN IP (`http://192.168.x.x:8000`) for local API testing, or the deployed HTTPS origin for an APK.

Session tokens are stored in Expo SecureStore (`bseva_token`). Role after login always comes from `GET /api/v1/auth/me`.

## Android APK (no Expo account)

Expo login is **only** for Expo’s cloud builders (`eas build` without `--local`). A local Gradle APK does not need an Expo account.

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=https://bseva.vercel.app pnpm android:local
```

That installs `com.bseva.app` on the emulator (native BSeva, not Expo Go), so the Expo Go 16 KB dialog should not appear.

Standalone release APK (talks to production `https://bseva.vercel.app`; no Metro, no Expo Go):

```bash
cd apps/mobile
pnpm apk:local
# output: android/app/build/outputs/apk/release/app-release.apk
```

`EXPO_PUBLIC_API_URL` defaults to `https://bseva.vercel.app`. Override only if you need a different origin.

## Cloud EAS (optional)

Needs a free [expo.dev](https://expo.dev/signup) account. Browser login (`eas login`) can 400; use email/password: `npx eas-cli@latest login --no-browser`.

```bash
npx eas-cli@latest build --platform android --profile preview
```
