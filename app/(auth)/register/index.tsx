import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, View, type TextInputInstance } from "react-native";
import Svg, { Path } from "react-native-svg";
import { RedirectIfSignedIn } from "@/components/auth/RedirectIfSignedIn";
import { AuthCard, AuthHeading, AuthScreen, ErrorNotice, inputRef } from "@/components/auth/AuthScreen";
import { authErrorMessage, useAuth } from "@/lib/auth";
import { AppText, Button, Field, Input } from "@/components/ui/primitives";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { fonts, px, radius, space, useColors } from "@/lib/theme";

export default function RegisterPage() {
  const { register } = useAuth();
  const c = useColors();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<TextInputInstance | null>(null);
  const passwordRef = useRef<TextInputInstance | null>(null);

  // What the browser's required / minLength checks did on the web.
  const canSubmit = Boolean(email.trim()) && password.length >= 8 && acceptedTerms;

  async function handleSubmit() {
    if (submitting || !canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await register(email.trim(), password, displayName, acceptedTerms);
      // RequireAuth routes a not-yet-onboarded account to /welcome from
      // here; the tour starts when those questions are finished or skipped.
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

  const linkStyle = { fontFamily: fonts.regular, color: c.brand };

  return (
    <AuthScreen>
      <RedirectIfSignedIn />
      <AuthCard>
        <AuthHeading title="Create an account" subtitle="Takes about a minute." />

        <Field
          label={
            <>
              Name <AppText tone="muted">(optional)</AppText>
            </>
          }
        >
          <Input
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => emailRef.current?.focus()}
            value={displayName}
            onChangeText={setDisplayName}
          />
        </Field>

        <Field label="Email">
          <Input
            {...inputRef(emailRef)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={email}
            onChangeText={setEmail}
          />
        </Field>

        <Field label="Password" hint="At least 8 characters.">
          <PasswordInput
            ref={passwordRef}
            autoComplete="new-password"
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
          />
        </Field>

        {/* Unticked by default and required to submit. A pre-ticked box is
            not consent in any jurisdiction that has thought about it, and
            the two links open the documents rather than describing them -
            pushed over this screen, so Back returns to the form as it was. */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space(2.5) }}>
          <Pressable
            onPress={() => setAcceptedTerms((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            accessibilityLabel="I agree to the Terms of Service and the Privacy Policy"
            hitSlop={12}
            style={{
              marginTop: px(3),
              height: px(18),
              width: px(18),
              borderRadius: radius.base,
              borderWidth: 1.5,
              borderColor: acceptedTerms ? c.brand : c.hairlineStrong,
              backgroundColor: acceptedTerms ? c.brand : c.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {acceptedTerms && (
              <Svg viewBox="0 0 16 16" width={px(12)} height={px(12)} fill="none" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3.5 8.5l3 3 6-7" />
              </Svg>
            )}
          </Pressable>
          <AppText tone="secondary" style={{ flex: 1 }} onPress={() => setAcceptedTerms((v) => !v)}>
            I agree to the{" "}
            <Link href="/terms" style={linkStyle}>
              Terms of Service
            </Link>{" "}
            and the{" "}
            <Link href="/privacy" style={linkStyle}>
              Privacy Policy
            </Link>
            .
          </AppText>
        </View>

        {error && <ErrorNotice>{error}</ErrorNotice>}

        <Button variant="primary" onPress={() => void handleSubmit()} disabled={submitting || !canSubmit}>
          {submitting ? "Creating account…" : "Sign up"}
        </Button>

        <GoogleSignInButton label="signup_with" />

        <AppText tone="muted" style={{ textAlign: "center" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ fontFamily: fonts.medium, color: c.brand }}>
            Log in
          </Link>
        </AppText>
      </AuthCard>
    </AuthScreen>
  );
}
