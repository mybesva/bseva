# BSeva Admin (Admin + Super Admin)

Separate Expo React Native app. Customer and Pujari accounts are rejected after backend authentication.

## Run

```bash
cd apps/admin-mobile
cp .env.example .env
pnpm install
pnpm start
```

Android: `pnpm android`  
iOS: `pnpm ios`

`EXPO_PUBLIC_API_URL` must point at the same FastAPI backend as web and the Customer/Pujari app.

## Firebase (manual)

This app uses package/bundle id `com.bseva.admin`. The files in `backend/secrets/` are for `com.bseva.app` (Customer/Pujari).

1. Firebase Console → project `b-seva-61ab7` → add Android app `com.bseva.admin` and iOS app `com.bseva.admin`.
2. Download `google-services.json` and `GoogleService-Info.plist` into `apps/admin-mobile/`.
3. Register an APNs key/certificate for iOS pushes.

Do not place Firebase Admin SDK JSON in this app.
