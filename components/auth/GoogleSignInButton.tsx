import { router } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { API_BASE_URL } from "@/lib/apiClient";
import { setTokens, useAuth } from "@/lib/auth";
import { AppText, Button } from "@/components/ui/primitives";
import { space, useColors } from "@/lib/theme";

/* Google sign-in.
 *
 * The web renders Google Identity Services' own button from a script tag; a
 * native app cannot. What it needs instead:
 *   - @react-native-google-signin/google-signin (not installed yet, needs a
 *     development build),
 *   - the backend accepting ID tokens minted for the app's iOS and Android
 *     OAuth client IDs, not only the web one,
 *   - Sign in with Apple beside it on iOS - App Store guideline 4.8 requires
 *     it of any app that offers a third-party sign-in.
 *
 * Until all three exist this renders nothing, which is also what the web does
 * when its client ID is unset: no button that can only fail. The token
 * exchange below is the web's, unchanged, so wiring it is a matter of calling
 * handleCredential with the ID token the SDK returns.
 *
 * TODO(google-signin): install the SDK, configure it with
 * EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (the backend verifies against the web
 * client's audience) and the iOS client ID, implement startSignIn, add Sign in
 * with Apple, then flip NATIVE_SIGN_IN_AVAILABLE. */

const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

/** Flipped once the native SDK is installed and wired (see above). */
const NATIVE_SIGN_IN_AVAILABLE: boolean = false;

type CredentialResponse = { credential?: string };

export function GoogleSignInButton({ label }: { label: "signin_with" | "signup_with" }) {
  const { refresh } = useAuth();
  const c = useColors();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCredential = useCallback(
    async (response: CredentialResponse) => {
      if (!response.credential) return;
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/auth/oauth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: response.credential }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail ?? `Sign-in failed (${res.status})`);
        }
        const tokens = await res.json();
        setTokens(tokens.access_token, tokens.refresh_token);
        await refresh();
        // replace, not push - see the note in the login screen.
        router.replace("/start");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Google sign-in failed");
      }
    },
    [refresh],
  );

  async function startSignIn() {
    setBusy(true);
    try {
      // TODO(google-signin): GoogleSignin.signIn(), then
      // handleCredential({ credential: result.data?.idToken ?? undefined }).
      await handleCredential({});
    } finally {
      setBusy(false);
    }
  }

  if (!CLIENT_ID || !NATIVE_SIGN_IN_AVAILABLE) return null;

  return (
    <View style={{ gap: space(3) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
        <View style={{ height: 1, flex: 1, backgroundColor: c.hairline }} />
        <AppText size="xs" tone="muted">
          or
        </AppText>
        <View style={{ height: 1, flex: 1, backgroundColor: c.hairline }} />
      </View>

      <Button onPress={() => void startSignIn()} disabled={busy} style={{ borderRadius: 9999 }}>
        {label === "signup_with" ? "Sign up with Google" : "Sign in with Google"}
      </Button>

      {error && (
        <AppText tone="low" accessibilityRole="alert" style={{ textAlign: "center" }}>
          {error}
        </AppText>
      )}
    </View>
  );
}
