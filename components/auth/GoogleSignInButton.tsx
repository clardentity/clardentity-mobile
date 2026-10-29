import * as AppleAuthentication from "expo-apple-authentication";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { API_BASE_URL, serverDetail } from "@/lib/apiClient";
import { setTokens, useAuth } from "@/lib/auth";
import { AppText, Button } from "@/components/ui/primitives";
import { space, useColors, useTheme } from "@/lib/theme";

/* Google sign-in, and Sign in with Apple beside it on iOS.
 *
 * The web renders Google Identity Services' own button from a script tag; a
 * native app uses @react-native-google-signin/google-signin instead. The SDK
 * is configured with the web client ID as `webClientId`, so the ID token it
 * returns carries the audience the backend already verifies; the iOS client
 * ID is what the phone itself signs in with.
 *
 * App Store guideline 4.8 requires Sign in with Apple of any app that offers
 * a third-party sign-in, so on iOS the Google button only shows once the
 * Apple one can too.
 *
 * Each provider renders nothing until it is configured, which is also what
 * the web does when its client ID is unset: no button that can only fail.
 *   - Google: EXPO_PUBLIC_GOOGLE_CLIENT_ID (web) and, on iOS,
 *     EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (also adds the config plugin, see
 *     app.config.js). Needs a development build; Expo Go lacks the module.
 *   - Apple: EXPO_PUBLIC_APPLE_SIGN_IN=1, once the backend has
 *     POST /auth/oauth/apple (Transition.md 9.3). Works in Expo Go. */

const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const APPLE_ENABLED = process.env.EXPO_PUBLIC_APPLE_SIGN_IN === "1";

type GoogleSDK = typeof import("@react-native-google-signin/google-signin");

/* Loaded lazily: the module throws at import when its native half is missing
 * (Expo Go, or a build made without the iOS client ID). */
let googleSdk: GoogleSDK | null | undefined;
function loadGoogle(): GoogleSDK | null {
  if (googleSdk !== undefined) return googleSdk;
  googleSdk = null;
  if (!CLIENT_ID || (Platform.OS === "ios" && !IOS_CLIENT_ID)) return null;
  if (Platform.OS === "web") return null;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require("@react-native-google-signin/google-signin") as GoogleSDK;
    sdk.GoogleSignin.configure({ webClientId: CLIENT_ID, iosClientId: IOS_CLIENT_ID });
    googleSdk = sdk;
  } catch {
    googleSdk = null;
  }
  return googleSdk;
}

function useAppleAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!APPLE_ENABLED || Platform.OS !== "ios") return;
    let cancelled = false;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (!cancelled) setAvailable(ok);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return available;
}

async function exchange(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(serverDetail(body, res.status, `Sign-in failed (${res.status})`));
  }
  return (await res.json()) as { access_token: string; refresh_token: string };
}

export function GoogleSignInButton({ label }: { label: "signin_with" | "signup_with" }) {
  const { refresh } = useAuth();
  const c = useColors();
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const appleAvailable = useAppleAvailable();
  const google = loadGoogle();

  // On iOS, Google waits for Apple (guideline 4.8).
  const showGoogle = !!google && (Platform.OS !== "ios" || appleAvailable);
  const showApple = appleAvailable;

  const finish = useCallback(
    async (tokens: { access_token: string; refresh_token: string }) => {
      setTokens(tokens.access_token, tokens.refresh_token);
      await refresh();
      // replace, not push - see the note in the login screen.
      router.replace("/start");
    },
    [refresh],
  );

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  const signInWithGoogle = () =>
    run(async () => {
      if (!google) return;
      const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = google;
      try {
        await GoogleSignin.hasPlayServices();
        const result = await GoogleSignin.signIn();
        if (!isSuccessResponse(result)) return; // cancelled
        const idToken = result.data.idToken;
        if (!idToken) throw new Error("Google didn't return a sign-in token.");
        await finish(await exchange("/auth/oauth/google", { id_token: idToken }));
      } catch (err) {
        if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) return;
        throw err;
      }
    });

  const signInWithApple = () =>
    run(async () => {
      const apple = AppleAuthentication;
      // Apple puts the SHA-256 of this nonce into the identity token; the
      // server hashes the raw one we send and compares, so a token lifted
      // from another sign-in can't be replayed here.
      const nonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
      try {
        const credential = await apple.signInAsync({
          requestedScopes: [
            apple.AppleAuthenticationScope.FULL_NAME,
            apple.AppleAuthenticationScope.EMAIL,
          ],
          nonce: hashedNonce,
        });
        if (!credential.identityToken) throw new Error("Apple didn't return a sign-in token.");
        // Apple sends the name only on the very first sign-in, so it goes
        // along every time and the server keeps the first one it sees.
        const name = [credential.fullName?.givenName, credential.fullName?.familyName]
          .filter(Boolean)
          .join(" ");
        await finish(
          await exchange("/auth/oauth/apple", {
            identity_token: credential.identityToken,
            nonce,
            full_name: name || undefined,
          }),
        );
      } catch (err) {
        if (err && typeof err === "object" && (err as { code?: string }).code === "ERR_REQUEST_CANCELED") return;
        throw err;
      }
    });

  if (!showGoogle && !showApple) return null;

  const verb = label === "signup_with" ? "Sign up" : "Sign in";

  return (
    <View style={{ gap: space(3) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
        <View style={{ height: 1, flex: 1, backgroundColor: c.hairline }} />
        <AppText size="xs" tone="muted">
          or
        </AppText>
        <View style={{ height: 1, flex: 1, backgroundColor: c.hairline }} />
      </View>

      {showApple && (
        // Apple's own button: App Review expects its HIG look, not ours.
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            label === "signup_with"
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
          }
          buttonStyle={
            theme === "dark"
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={9999}
          style={{ height: 44, opacity: busy ? 0.5 : 1 }}
          onPress={() => {
            if (!busy) void signInWithApple();
          }}
        />
      )}

      {showGoogle && (
        <Button onPress={() => void signInWithGoogle()} disabled={busy} style={{ borderRadius: 9999 }}>
          {`${verb} with Google`}
        </Button>
      )}

      {error && (
        <AppText tone="low" accessibilityRole="alert" style={{ textAlign: "center" }}>
          {error}
        </AppText>
      )}
    </View>
  );
}
