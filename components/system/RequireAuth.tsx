import { router } from "expo-router";
import { useEffect, useRef, type ReactNode } from "react";
import { View } from "react-native";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/system/AppShell";
import { Spinner } from "@/components/ui/primitives";

/** Gates a route on an authenticated session and wraps it in the app shell,
 *  so every signed-in screen gets the top bar and drawer while signed-out
 *  screens (landing, login, register) stay full-bleed.
 *
 *  A signed-in account that hasn't been through the first-run welcome
 *  questions yet is sent there first, whichever way it arrived - password
 *  login, Google, a deep link - so /welcome doesn't depend on any one
 *  sign-in screen remembering to redirect. The check is `=== null` rather
 *  than falsy on purpose: a backend that predates the field returns nothing,
 *  and that must mean "don't gate", not "gate everyone". */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const needsWelcome = !!user && user.onboarding_completed_at === null;
  // One redirect per mount. In development React runs this effect twice
  // (StrictMode), and two identical replace() calls back to back left the
  // router with a navigation it never committed. Refs survive StrictMode's
  // simulated remount, so this collapses it to one call; in production it
  // changes nothing.
  const redirected = useRef(false);

  useEffect(() => {
    if (loading || redirected.current) return;
    if (!user) {
      redirected.current = true;
      router.replace("/login");
    } else if (needsWelcome) {
      redirected.current = true;
      router.replace("/welcome");
    }
  }, [loading, user, needsWelcome]);

  if (loading || !user || needsWelcome) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Spinner />
      </View>
    );
  }

  return <AppShell>{children}</AppShell>;
}
