import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { useAuth, useHasStoredSession } from "@/lib/auth";
import { RequireAuth } from "@/components/system/RequireAuth";
import { StartChat } from "@/components/chat/StartChat";
import { Spinner } from "@/components/ui/primitives";

/** The web's /launch, where the installed app opens.
 *
 *  Signed in: a new chat, by the same road sign-in takes (/start, which
 *  opens the workspace's empty chat or makes one). Signed out: the home
 *  screen, not the login form - someone opening the app without an account
 *  should see what it is, with the demo a tap away. /start alone could not
 *  do the second: it is behind RequireAuth, which sends a signed-out
 *  visitor to /login. */
export default function LaunchPage() {
  const { user, loading } = useAuth();
  const hasStoredSession = useHasStoredSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  // A stored token counts as signed in straight away, as on the home screen.
  if (user || (loading && hasStoredSession)) {
    return (
      <RequireAuth>
        <StartChat />
      </RequireAuth>
    );
  }
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Spinner />
    </View>
  );
}
