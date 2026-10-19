import { Link, router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { authErrorMessage, useAuth } from "@/lib/auth";
import { AuthCard, AuthHeading, AuthScreen, ErrorNotice } from "@/components/auth/AuthScreen";
import { AppText, Button, Field } from "@/components/ui/primitives";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { fonts, fontSize, useColors } from "@/lib/theme";

/* The link in the email is https://clardentity.ai/reset-password?token=...;
 * once universal / app links are configured it opens this screen with the
 * token as a search param, exactly as the web page reads it. */

function ResetPasswordForm() {
  const { completePasswordReset } = useAuth();
  const c = useColors();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = (Array.isArray(params.token) ? params.token[0] : params.token) || null;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirmRef = useRef<TextInputInstance | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;
  const disabled = submitting || mismatch || password.length < 8 || confirm.length === 0;

  async function handleSubmit() {
    if (!token || disabled) return;
    setError(null);
    setSubmitting(true);
    try {
      await completePasswordReset(token, password);
      // Straight in, rather than back to a login form to retype what was just
      // chosen. The reset endpoint returns tokens for exactly this reason.
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

  const brandLink = { fontFamily: fonts.medium, color: c.brand, fontSize: fontSize.sm, textAlign: "center" as const };

  if (!token) {
    return (
      <AuthCard gap={4}>
        <AuthHeading title="This link is incomplete" />
        <AppText tone="muted">
          Reset links carry a token that isn&apos;t in this one - it was probably clipped by an email
          client. Requesting a fresh one takes a moment.
        </AppText>
        <Link href="/forgot-password" style={brandLink}>
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthHeading title="Choose a new password" subtitle="You'll be signed in once it's saved." />

      <Field label="New password" hint="At least 8 characters.">
        <PasswordInput
          autoComplete="new-password"
          textContentType="newPassword"
          autoFocus
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
          value={password}
          onChangeText={setPassword}
        />
      </Field>

      <Field label="Confirm new password">
        <PasswordInput
          ref={confirmRef}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void handleSubmit()}
          value={confirm}
          onChangeText={setConfirm}
        />
      </Field>

      {mismatch && (
        // Said while typing rather than on submit: the whole point of a
        // confirm field is to catch the typo before it becomes a lockout.
        <AppText tone="low">These two don&apos;t match yet.</AppText>
      )}

      {error && <ErrorNotice>{error}</ErrorNotice>}

      <Button variant="primary" onPress={() => void handleSubmit()} disabled={disabled}>
        {submitting ? "Saving…" : "Save and sign in"}
      </Button>

      <Link href="/login" style={brandLink}>
        Back to log in
      </Link>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthScreen>
      <ResetPasswordForm />
    </AuthScreen>
  );
}
