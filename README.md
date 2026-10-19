# Clardentity mobile

The Clardentity app for iOS and Android, built with Expo (React Native,
TypeScript). It mirrors the PWA (`clardentity-mvp-mv/frontend`) file for file:
the same routes under `app/`, the same components under `components/`, the
same modules under `lib/`. [PORTING.md](PORTING.md) maps one to the other and
lists the native equivalent of each browser feature.

## Run it

```bash
npm install
npx expo start
```

The app uses native modules that Expo Go doesn't include (WebRTC for live
calls), so run it in a development build:

```bash
npx expo run:android
npx expo run:ios
```

or build one in the cloud with `npx eas-cli@latest build --profile development`.

Checks:

```bash
npm run typecheck
```

## Configuration

The app talks to the production backend by default. Point it elsewhere with
`EXPO_PUBLIC_BACKEND_URL` (and optionally `EXPO_PUBLIC_API_URL`) in a `.env`
file. Analytics stay off unless `EXPO_PUBLIC_POSTHOG_KEY` is set.

## Layout

```
app/          routes (Expo Router), same paths as the web
components/   same folders and file names as the web
lib/          API client, auth, streaming, theme tokens, stores
assets/       icons, landing marks, app icon and splash
```
