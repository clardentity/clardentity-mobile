# Porting guide: PWA to the native app

This app is the Clardentity PWA (`clardentity-mvp-mv/frontend`, Next.js) rebuilt in
React Native with Expo. It keeps the PWA's structure on purpose, so a change made
on the web can be found and repeated here by path.

## Structure map

| PWA (`frontend/`) | App (this repo) | Notes |
|---|---|---|
| `app/<route>/page.tsx` | `app/<route>/index.tsx` | Expo Router; same URL paths |
| `app/<group>/layout.tsx` | `app/<group>/_layout.tsx` | |
| `app/layout.tsx` | `app/_layout.tsx` | fonts, storage hydration, providers, overlays |
| `app/error.tsx`, `app/global-error.tsx` | `ErrorBoundary` export in `app/_layout.tsx` | |
| `app/(legal)/legal.tsx` | `components/legal/legal.tsx` | every file under `app/` is a route in Expo Router |
| `app/manifest.ts`, `public/sw.js` | `app.json` | no service worker in a native app |
| `components/**` | `components/**` | same file names, same exported names and props |
| `lib/**` | `lib/**` | same modules; browser APIs swapped (below) |
| `public/ui/*.svg`, `public/landing/*.svg` | `assets/ui`, `assets/landing`, `components/ui/icons.ts` | `MaskIcon src="/ui/..."` works unchanged |
| `app/globals.css` tokens | `lib/theme.tsx` | `useColors()`, `fontSize`, `space()`, `px()`, `radius`, `fonts` |

## Web to native equivalents

| Web | Native |
|---|---|
| `localStorage` / `sessionStorage` | `lib/storage.ts` (sync, hydrated before first render; tokens in Keychain/Keystore) |
| `fetch` streaming (`ReadableStream`) | `expo/fetch` in `lib/sse.ts` |
| Tailwind classes | `StyleSheet` from `useThemedStyles(c => ...)` |
| CSS zoom 0.92 on phones | baked into `px()` / `fontSize` |
| `hover:` | `Pressable` pressed state |
| `title=` tooltip | `accessibilityLabel` |
| hover-only controls | long-press or always visible |
| fixed overlays, dialogs | `Modal` |
| `<select>`, dropdowns | a `Modal` sheet |
| file inputs | `expo-image-picker`, `expo-document-picker` |
| clipboard | `expo-clipboard` |
| new tab, `mailto:` | `expo-web-browser`, `Linking.openURL` |
| blob download | `expo-file-system` + `expo-sharing` |
| `window.confirm` | `Alert.alert` |
| `next/navigation` | `expo-router` (`router`, `usePathname`, `useLocalSearchParams`) |
| `next/link` | `Link` from `expo-router` |
| WebRTC, Web Audio | `react-native-webrtc` (development build) |
| MediaRecorder | `expo-audio` (m4a) |
| PostHog JS | `posthog-react-native` |
| nspell autocorrect | dropped; the OS keyboard corrects |

## Environment

| Variable | Default |
|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | `https://clardentity-backend.onrender.com` |
| `EXPO_PUBLIC_API_URL` | `${EXPO_PUBLIC_BACKEND_URL}/api/v1` |
| `EXPO_PUBLIC_POSTHOG_KEY` | unset (analytics off) |
| `EXPO_PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` |
