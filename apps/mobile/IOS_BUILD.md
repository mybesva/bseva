# iOS builds: B-Seva (Customer) and B-Seva Pujari

One codebase builds two iOS apps. `app.config.ts` reads `app.json` (the Customer base) and applies the variant from the `BSEVA_APP` environment variable. The JS bundle picks the role at runtime from the bundle id (`src/config/appVariant.ts`).

| | Customer | Pujari |
|---|---|---|
| `BSEVA_APP` | unset or `customer` | `pujari` |
| Name | B-Seva | B-Seva Pujari |
| Bundle id | `com.bseva.app` | `com.bseva.pujari` |
| Icon | `assets/icon.png` | `assets/icon-pujari.png` |
| Location | When In Use only | When In Use + Always |
| `UIBackgroundModes` | `remote-notification` | `remote-notification`, `location` |
| Firebase plist | `GoogleService-Info.plist` | `GoogleService-Info.pujari.plist`, used only when the file exists |

Android is not affected. It still builds `com.bseva.app` by default and `com.bseva.pujari` with the Gradle flag `-PbsevaApp=pujari` (`plugins/withBsevaAndroid.js`, `android-variants/`). Do not set `BSEVA_APP` for Android builds.

## EAS profiles (`eas.json`)

| Profile | Variant | API | Distribution |
|---|---|---|---|
| `preview-customer` | Customer | https://qa.b-seva.com | internal (ad hoc) |
| `preview-pujari` | Pujari | https://qa.b-seva.com | internal (ad hoc) |
| `production-customer` | Customer | https://b-seva.com | App Store |
| `production-pujari` | Pujari | https://b-seva.com | App Store |

Each profile sets `BSEVA_APP` and `BSEVA_IOS_BUNDLE_ID` and uses the `Release` build configuration. The original `development`, `preview` and `production` profiles are unchanged.

Check the resolved config before building:

```sh
cd apps/mobile
BSEVA_APP=customer npx expo config --type public
BSEVA_APP=pujari   npx expo config --type public
```

## One-time setup (account owner only)

These steps need the owner's Apple Developer account (Account Holder or Admin role). No credentials are stored in this repository.

### 1. Register both bundle ids

In the Apple Developer portal, under Certificates, Identifiers & Profiles → Identifiers:

1. Confirm `com.bseva.app` exists. If not, create an App ID with that bundle id.
2. Create an App ID for `com.bseva.pujari`.
3. On both, enable the **Push Notifications** capability. Background location needs no capability; it comes from `UIBackgroundModes`.

### 2. Create both apps in App Store Connect

In App Store Connect → Apps → "+" → New App:

1. Create **B-Seva** with bundle id `com.bseva.app`. Skip this if it already exists.
2. Create **B-Seva Pujari** with bundle id `com.bseva.pujari`.
3. Note each app's Apple ID (the numeric `ascAppId` on the App Information page). Add it to `eas.json` under `submit.production-customer.ios.ascAppId` and `submit.production-pujari.ios.ascAppId`.

### 3. APNs key (push notifications)

1. Go to Certificates, Identifiers & Profiles → Keys → "+". Create a key with **Apple Push Notifications service (APNs)** enabled. One key works for every app in the team.
2. Download the `.p8` file. It can be downloaded only once. Note the Key ID and the Team ID.
3. Give it to EAS (step 4), or let `eas credentials` create one.
4. If the backend sends pushes through Firebase Cloud Messaging, also upload the same `.p8` in the Firebase console → Project settings → Cloud Messaging → Apple app configuration, for each iOS app.

### 4. EAS credentials

Run these from `apps/mobile`, signed in as a member of the Expo account that owns the `bseva` project:

```sh
npx eas-cli login

# Customer
BSEVA_APP=customer npx eas-cli credentials --platform ios
#   choose the production-customer profile (bundle id com.bseva.app)
#   -> "Build Credentials": let EAS create or reuse the Distribution Certificate
#   -> create the App Store provisioning profile
#   -> "Push Notifications": upload or create the APNs key from step 3

# Pujari
BSEVA_APP=pujari npx eas-cli credentials --platform ios
#   choose the production-pujari profile (bundle id com.bseva.pujari)
#   -> same steps; the Distribution Certificate and APNs key can be shared

# Ad hoc (preview-*) builds install only on registered devices:
npx eas-cli device:create
```

### 5. Firebase for the Pujari app (blocked until done)

`GoogleService-Info.plist` belongs to `com.bseva.app` only.

1. In the Firebase console, add an iOS app with bundle id `com.bseva.pujari` to the same project.
2. Download its `GoogleService-Info.plist` and save it as `apps/mobile/GoogleService-Info.pujari.plist`.

`app.config.ts` picks it up automatically. Until then, the Pujari iOS build has no Firebase config.

## Build and submit

```sh
cd apps/mobile
npx eas-cli build --platform ios --profile preview-customer
npx eas-cli build --platform ios --profile preview-pujari

npx eas-cli build --platform ios --profile production-customer
npx eas-cli build --platform ios --profile production-pujari
npx eas-cli submit --platform ios --profile production-customer --latest
npx eas-cli submit --platform ios --profile production-pujari --latest
```

Before each store upload, raise `ios.buildNumber` in `app.json`, because `appVersionSource` is `local`.

## App Review notes

- **Pujari:** explain the Always-location use: live tracking only during the pre-puja travel window of an accepted booking. An in-app disclosure is shown first. Provide a demo pujari account that has an accepted booking.
- **Customer:** uses When In Use location only, to find nearby pujaris and fill in an address.
- **Both:** account deletion is in More → Account → Delete Account, with a web alternative at `/delete-account`. Reporting is on the booking detail screen ("Report"), with My Reports under More → Account.
