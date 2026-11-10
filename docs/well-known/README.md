# Deep-link files for clardentity.ai

These two files let `https://clardentity.ai/...` links open the app instead of
the browser: the password-reset email, `/start`, and chat and workspace links.
The app side is already configured in `app.json` (`ios.associatedDomains` and
`android.intentFilters`).

They belong on the website, not in the app. Copy them into the web app's
`frontend/public/.well-known/` so they are served at:

- `https://clardentity.ai/.well-known/apple-app-site-association` (no file
  extension, `Content-Type: application/json`, no redirect)
- `https://clardentity.ai/.well-known/assetlinks.json`

Fill in two values first:

| Placeholder | Where to get it |
|---|---|
| `TEAMID` | Apple Developer account → Membership → Team ID |
| `SHA256:FROM:PLAY:APP:SIGNING` | Play Console → Setup → App signing → SHA-256 certificate fingerprint (add the EAS upload key's too for internal builds: `eas credentials`) |

Temporary chats must not be deep-linkable; they have no `/chat/<id>` URL, so
nothing extra is needed.
