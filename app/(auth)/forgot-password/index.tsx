import { Link } from "expo-router";
import { useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { authErrorMessage } from "@/lib/auth";
import { AuthCard, AuthHeading, AuthScreen, ErrorNotice } from "@/components/auth/AuthScreen";
import { AppText, Button, Field, Input } from "@/components/ui/primitives";
import { fonts, fontSize, useColors } from "@/lib/theme";

export default function ForgotPasswordPage() {
  const c = useColors();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting || !email.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/auth/password-reset/request", {
        method: "POST",
        body: { email: email.trim() },
      });
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const brandLink = { fontFamily: fonts.medium, color: c.brand };

  return (
    <AuthScreen>
      {sent ? (
        // Deliberately not "we sent it to that address" - the API doesn't
        // say whether an account exists, and neither should this screen.
        <AuthCard gap={4}>
          <AuthHeading title="Check your email" />
          <AppText tone="muted">
            If <AppText weight="medium">{email.trim()}</AppText> has an account, a link to choose a new
            password is on its way. It works once and expires in 30 minutes.
          </AppText>
          <AppText tone="muted">
            Nothing arriving? Check the spam folder, then{" "}
            <AppText weight="medium" tone="brand" accessibilityRole="button" onPress={() => setSent(false)}>
              try another address
            </AppText>
            .
          </AppText>
          <Link href="/login" style={[brandLink, { fontSize: fontSize.sm, textAlign: "center" }]}>
            Back to log in
          </Link>
        </AuthCard>
      ) : (
        <AuthCard>
          <AuthHeading
            title="Forgot your password?"
            subtitle="Enter your email and we'll send you a link to choose a new one."
          />

          <Field label="Email">
            <Input
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              autoFocus
              returnKeyType="send"
              onSubmitEditing={() => void handleSubmit()}
              value={email}
              onChangeText={setEmail}
            />
          </Field>

          {error && <ErrorNotice>{error}</ErrorNotice>}

          <Button variant="primary" onPress={() => void handleSubmit()} disabled={submitting || !email.trim()}>
            {submitting ? "Sending…" : "Send reset link"}
          </Button>

          <AppText tone="muted" style={{ textAlign: "center" }}>
            Remembered it?{" "}
            <Link href="/login" style={brandLink}>
              Log in
            </Link>
          </AppText>
        </AuthCard>
      )}
    </AuthScreen>
  );
}
