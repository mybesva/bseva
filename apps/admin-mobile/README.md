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

## Push notifications (FCM) — same Firebase project as Customer/Pujari

All apps use Firebase project **`b-seva-61ab7`**. The backend sends pushes with **one** Firebase Admin SDK service account (`backend/secrets/b-seva-61ab7-firebase-adminsdk-*.json` or `GOOGLE_APPLICATION_CREDENTIALS`). Customer/Pujari and Admin each register **their own device tokens** via `POST /api/v1/notifications/fcm/token` after login (`src/services/push.ts` → `SessionEffects`).

Native builds need a **Firebase client config per package name** (not a second Firebase project):

| App | Package / bundle | Client files (in this app directory) |
|-----|------------------|--------------------------------------|
| Customer/Pujari | `com.bseva.app` | `apps/mobile/google-services.json`, `GoogleService-Info.plist` |
| Admin | `com.bseva.admin` | `apps/admin-mobile/google-services.json`, `GoogleService-Info.plist` |

The committed Customer files only list `com.bseva.app`. **You cannot reuse them for Admin** — Android/iOS require a separate app registration inside the **same** Firebase project.

### One-time Firebase Console (project `b-seva-61ab7`)

1. Project settings → **Add app** → Android, package **`com.bseva.admin`** → download `google-services.json`.
2. **Add app** → iOS, bundle **`com.bseva.admin`** → download `GoogleService-Info.plist`.
3. Store copies under `backend/secrets/` as `google-services-admin.json` and `GoogleService-Info-admin.plist` (gitignored), then from repo root:

   ```bash
   bash scripts/sync-firebase-clients.sh
   ```

4. Rebuild native projects (`expo prebuild` / release APK). `app.json` already sets `googleServicesFile` for both platforms.

5. iOS: upload APNs key to Firebase Cloud Messaging for **`com.bseva.admin`** (same project; can share the key used for `com.bseva.app`).

Do **not** commit service-account JSON into this app. Do **not** hard-code FCM registration tokens.

### Verify

1. Admin login on a device build (not Expo Go for production FCM).
2. Allow notifications → token registers on the server.
3. Admin → Notifications → **Send test push** (or backend `POST /notifications/fcm/test`).
