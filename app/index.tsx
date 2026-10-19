import { useAuth, useHasStoredSession } from "@/lib/auth";
import { LandingPage } from "@/components/marketing/LandingPage";

export default function Home() {
  // Deliberately not gated on `loading`, as on the web: signed-out is the
  // right default, and a stored token counts as signed in straight away;
  // /auth/me only ever downgrades it (by clearing the token) if it is dead.
  const { user } = useAuth();
  const hasStoredSession = useHasStoredSession();

  return <LandingPage signedIn={Boolean(user) || hasStoredSession} />;
}
