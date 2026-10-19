import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import { View, type TextInputInstance } from "react-native";
import { RedirectIfSignedIn } from "@/components/auth/RedirectIfSignedIn";
import { AuthCard, AuthHeading, AuthScreen, ErrorNotice } from "@/components/auth/AuthScreen";
import { authErrorMessage, useAuth } from "@/lib/auth";
import { AppText, Button, Field, Input } from "@/components/ui/primitives";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { fonts, fontSize, space, useColors } from "@/lib/theme";

export default function LoginPage() {
  const { login } = useAuth();
  const c = useColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance | null>(null);

  async function handleSubmit() {
    if (submitting || !email || !password) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // Whether this account still owes the welcome questions (and then the
      // tour) is the server's call - RequireAuth reads it and redirects.
      // replace, not push: the form is a step they have completed, and
      // leaving it in the history means one press of Back puts a sign-in
      // screen in front of someone who never signed out.
      router.replace("/start");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen>
      <RedirectIfSignedIn />
      <AuthCard>
        <AuthHeading title="Log in" subtitle="Welcome back." />

        {/* Not an email-only field: the administrator signs in as a username.
            The email keyboard keeps the phone the same for everyone else, and
            the server still decides what matches. */}
        <Field label="Email or username">
          <Input
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={email}
            onChangeText={setEmail}
          />
        </Field>

        <Field label="Password">
          <PasswordInput
            ref={passwordRef}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void handleSubmit()}
            value={password}
            onChangeText={setPassword}
          />
        </Field>

        <View style={{ marginTop: -space(2), alignItems: "flex-end" }}>
          <Link href="/forgot-password" style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkMuted }}>
            Forgot your password?
          </Link>
        </View>

        {error && <ErrorNotice>{error}</ErrorNotice>}

        <Button variant="primary" onPress={() => void handleSubmit()} disabled={submitting || !email || !password}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>

        <GoogleSignInButton label="signin_with" />

        <AppText tone="muted" style={{ textAlign: "center" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ fontFamily: fonts.medium, color: c.brand }}>
            Sign up
          </Link>
        </AppText>
      </AuthCard>
    </AuthScreen>
  );
}
