# Expo / EAS log

Project: https://expo.dev/accounts/clardentity/projects/clardentity
Owner: `clardentity` · Project ID: `707ffbc6-abc7-49da-87b7-b71c9abee3f6`
Bundle / package ID: `ai.clardentity.app`

## Setup (done)

- `expo-updates` installed; `runtimeVersion` uses the `fingerprint` policy (app.config.js), so an over-the-air update only reaches builds with the same native code.
- Channels in eas.json: `development`, `preview`, `production`.
- GitHub secret `EXPO_TOKEN` is set. The CI job `deploy-update` (.github/workflows/ci.yml) publishes an OTA update to `production` on every push to `main` once the checks pass.
- EAS CLI logged in on this PC as `clardentity` (device login).
- Android upload keystore generated and stored on EAS (Build Credentials `ajLMuYm0S-`, default).

## Builds

### 2026-11-10 · Android production · versionCode 2 · FAILED

- Build: https://expo.dev/accounts/clardentity/projects/clardentity/builds/eb38996a-7644-4c22-8117-cebacba5d17c
- Commit: `d52a324`
- Error: `EAS_BUILD_UNKNOWN_GRADLE_ERROR`, task `:app:minifyReleaseWithR8` failed:
  ```
  ERROR: R8: Missing class org.webrtc.Dav1dDecoder$Natives
  (referenced from: org.webrtc.Dav1dDecoderJni.get() and 2 other contexts)
  ```
- Cause: react-native-webrtc references a class it does not ship; R8 (release minifier) stops on missing classes.
- Fix (commit `326fe5a`): added `expo-build-properties` with
  ```
  -keep class org.webrtc.** { *; }
  -dontwarn org.webrtc.**
  ```
  under `android.extraProguardRules` in app.json.

### 2026-11-11 · Android production · versionCode 3 · FINISHED

- Build: https://expo.dev/accounts/clardentity/projects/clardentity/builds/aac678e9-2f60-498c-8276-1ce710e24a09
- Commit: `326fe5a`
- Artifact (.aab, Play Store only, not directly installable): https://expo.dev/artifacts/eas/hrZJ-FkY4AW4YLgPNws3gpLQLsK-0NZoMdTx8toctlM.aab
- Channel: `production`

## OTA updates

- None published yet. Run when ready (PowerShell):
  ```
  $env:EXPO_PUBLIC_BACKEND_URL="https://clardentity-backend.onrender.com"; npx eas-cli update --channel production --platform android --message "Figma mobile design"
  ```
- After that, every push to `main` publishes automatically via GitHub Actions.

## Next steps

### Android (Google Play)
1. Create a Google Play developer account at https://play.google.com/console ($25 one-time) and create the app.
2. First upload is manual: download the .aab above, then Testing → Internal testing → Create new release.
3. Create a Google Cloud service account key with Play Console access (https://expo.fyi/creating-google-service-account) so EAS can submit.
4. From then on: `npm run submit:production` uploads new builds to the internal track.

### iOS (App Store)
- Needs an Apple Developer account ($99/year).
- Run in a real terminal (asks for Apple ID login; let EAS manage certificates):
  ```
  npx eas-cli build --profile production --platform ios
  ```

## Useful commands

| What | Command |
| --- | --- |
| Android store build | `npx eas-cli build --profile production --platform android` |
| iOS store build | `npx eas-cli build --profile production --platform ios` |
| Both | `npm run build:production` |
| Submit to stores | `npm run submit:production` |
| OTA to production | `npm run update:production` (set `EXPO_PUBLIC_BACKEND_URL` first) |
| OTA to preview | `npm run update:preview` |
| Build details | `npx eas-cli build:view <build-id> --json` |
| Build list | `npx eas-cli build:list` |
