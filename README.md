# Clardentity mobile

The Clardentity app for iOS and Android, built with Expo (React Native,
TypeScript). It mirrors the PWA (`clardentity-mvp-mv/frontend`) file for file:
the same routes under `app/`, the same components under `components/`, the
same modules under `lib/`. [PORTING.md](PORTING.md) maps one to the other and
lists the native equivalent of each browser feature.

## Run it on your iPhone today (Expo Go)

No Mac or Apple Developer account needed.

1. Install **Expo Go** from the App Store.
2. On the computer:
   ```bash
   npm install
   npm run go
   ```
   (`expo start --go --tunnel`: `--go` targets Expo Go rather than a dev
   build, `--tunnel` works across networks. On the same Wi-Fi,
   `npx expo start --go` is faster.)
3. Open the iPhone Camera, point it at the QR code in the terminal, tap the
   banner. The app opens inside Expo Go.

Everything runs in Expo Go except live voice calls and Google sign-in, which
need native modules Expo Go doesn't have; the call button says so instead of
crashing.

## The full app (development build)

Live calls (WebRTC) and native Google sign-in need a development build. On
Windows, build in the cloud with EAS; this needs an Apple Developer account
to install on a real iPhone:

```bash
npx eas-cli@latest login
npx eas-cli@latest init                       # then set EAS_PROJECT_ID
npx eas-cli@latest device:create              # register your iPhone
npx eas-cli@latest build --profile development --platform ios
npx expo start --dev-client
```

Android: `npx eas-cli@latest build --profile development --platform android`,
or `npx expo run:android` with Android Studio installed.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run check      # all three
```

CI (`.github/workflows/ci.yml`) runs these plus an iOS and Android bundle on
every pull request.

## Configuration

Copy `.env.example` to `.env.local`. The app talks to the production backend
by default; release builds only accept an `https://` backend. Analytics stay
off unless `EXPO_PUBLIC_POSTHOG_KEY` is set. Google sign-in appears once its
client IDs are set, Sign in with Apple once `EXPO_PUBLIC_APPLE_SIGN_IN=1`.

Deep links (`https://clardentity.ai/reset-password`, `/chat/*`, ...) need the
two files in [docs/well-known](docs/well-known/README.md) hosted on the site.

## Layout

```
app/          routes (Expo Router), same paths as the web
components/   same folders and file names as the web
lib/          API client, auth, streaming, theme tokens, stores
assets/       icons, landing marks, app icon and splash
docs/         deep-link files for the website
__tests__/    Jest unit tests
```
