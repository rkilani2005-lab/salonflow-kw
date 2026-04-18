# Phase C — Native (Android) setup

This document is for the person provisioning the native build and
release infrastructure.  The **app code** is complete — Capacitor is
configured, the Android platform is generated, native features
(biometric, camera, push) are wired, and GitHub Actions produces a
debug APK on every push to `main`.

## Build a debug APK right now

1. Push a commit to `main` (or open a PR).
2. Actions tab → pick the latest `Android APK build` run.
3. Scroll to `Artifacts` → download `zaina-debug-apk`.
4. Unzip, copy `zaina-debug.apk` to a test Android device.
5. Tap to install (you may need to allow "Install from unknown sources").

The debug APK will let you exercise every screen, loyalty, POS,
refunds, calendar — everything Phase B stabilized.

## What is NOT yet set up (and what each blocks)

### 1. Firebase project + `google-services.json`

**Blocks:** actual push notification delivery.  The app registers,
asks permission, and saves the device token to Supabase — but no
server is pushing to those tokens yet, and without a Firebase config
file the token registration itself will fail on device.

**To set up:**

1. Go to https://console.firebase.google.com → create project `zaina`.
2. Add an Android app with package name `ai.zaina.app`.
3. Download the generated `google-services.json`.
4. Place it at `android/app/google-services.json` in this repo.
5. Commit it — **yes, it belongs in version control.**  It contains
   no secrets; Firebase guards are on the token + cert fingerprint.
6. Add the Firebase Cloud Messaging Service Account key as a GitHub
   Actions secret named `FIREBASE_SERVICE_ACCOUNT` — the future push
   edge function will use it.

### 2. Release signing keystore

**Blocks:** Play Store upload.  Debug APKs are signed with a shared
debug key that Play Console rejects for production.

**To set up:**

1. Generate a release keystore:
   ```sh
   keytool -genkey -v -keystore zaina-release.jks -keyalg RSA \
     -keysize 2048 -validity 10000 -alias zaina
   ```
2. **Back this file up.**  Losing it means you can never publish an
   update to the same Play Store listing — you'd have to publish a
   new app under a new package name.
3. Store the keystore as a base64-encoded GitHub Actions secret
   `ANDROID_KEYSTORE_B64`.  Also add `ANDROID_KEY_ALIAS`,
   `ANDROID_KEY_PASSWORD`, `ANDROID_STORE_PASSWORD`.
4. A separate workflow `android-release.yml` (to be added when
   Play Console is provisioned) will consume these to produce a
   signed AAB for Play upload.

### 3. Play Console listing

**Blocks:** public distribution.  Needed for closed beta, open beta,
and production release tracks.

**To set up:**

1. Enroll in Google Play Console ($25 one-time, personal or org
   account).  Complete the identity verification — takes a few days.
2. Create the app listing with package name `ai.zaina.app`.
3. Upload store icon (512×512), feature graphic (1024×500), at least
   2 screenshots per device class.
4. Fill out the data-safety form.  The relevant answers: collects
   location (approximate), email, phone; data is encrypted in transit
   (yes, HTTPS/TLS); data is shared with third parties (Supabase,
   Anthropic — yes, as service providers).
5. Submit the release via the signed AAB workflow above.

### 4. Pending database migration

**Blocks:** push token persistence.  Without this, the app attempts
to register tokens but the upsert silently fails (table doesn't
exist), and pushes never target devices correctly.

Run migration `20260418000002_c1_device_push_tokens.sql` against the
deployed Supabase database.

## Local development on Android

If you want to iterate on the native build locally (not just through
CI), install Android Studio + the platform-tools, then:

```sh
# One-time: generate the Android project if this is a fresh clone.
npm install
npm run build
npx cap sync android

# Run on a connected device (adb devices must show one).
npx cap run android
```

For live-reload against your dev machine, uncomment the `server:` block
in `capacitor.config.ts`, rebuild, and `npm run dev` at the same time.
The app on the phone will hot-reload from your dev server rather than
the bundled `dist/`.

## What changes when you do / don't apply these

| Setup step                   | APK builds | APK installs | Push works | Play Store |
|------------------------------|:----------:|:------------:|:----------:|:----------:|
| Nothing (current state)      | ✅         | ✅           | ❌         | ❌         |
| + google-services.json       | ✅         | ✅           | ✅ (via backend) | ❌ |
| + Release keystore           | ✅         | ✅           | ✅         | 🟡 (need Play Console) |
| + Play Console + AAB release | ✅         | ✅           | ✅         | ✅         |

## Native feature coverage

Currently wired in the app:
- **Biometric login** (`src/lib/native/biometric.ts`) — fingerprint
  / Face ID unlock.  Credentials stored in Android KeyStore, not in
  JavaScript memory or localStorage.
- **Camera capture** (`src/lib/native/camera.ts`) — receipts,
  product photos.  Falls back to web `<input type="file" capture>`
  on desktop so the same calling code works everywhere.
- **Push notifications** (`src/lib/native/push.ts`) — permission
  request, token registration to Supabase, foreground banner, tap
  routing via window events.

Deferred:
- **Offline POS** — not in scope for v1.
- **Barcode / QR scanning** — camera picker currently handles it
  via manual capture; dedicated live-scanner can be added later.
- **Share sheet** — web share API is sufficient for current use cases.
