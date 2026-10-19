import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { apiFetch } from "@/lib/apiClient";
import { authErrorMessage } from "@/lib/auth";
import { lastWorkspaceId, rememberWorkspace } from "@/lib/lastWorkspace";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { AppText, Button } from "@/components/ui/primitives";
import { space } from "@/lib/theme";

type Bootstrap = {
  active_workspace_id: string;
  conversation_id: string;
};

/** The way in after signing in or finishing the welcome questions: straight
 *  to a chat, in a mode, ready to type. Nobody is asked to make a workspace
 *  first or to pick a mode before the box unlocks.
 *
 *  Both of those rules - make a workspace if there is none, reuse an empty
 *  chat rather than stacking another "Untitled chat" at every sign-in - now
 *  live in the /bootstrap endpoint, because they were three round trips
 *  here and are one query there. */
export function StartChat() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // One run per attempt, and no cancellation on cleanup: StrictMode mounts
  // twice, and cancelling the first run while the ref blocks the second
  // left the page on the spinner forever. A run that outlives the component
  // is harmless - router.replace works from anywhere, and the ref stops a
  // second run from making a second chat.
  const started = useRef<number>(-1);

  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;

    async function go() {
      try {
        /* One round trip. This used to be three in a row - the workspace
           list, that workspace's chats, and sometimes a chat to create -
           each waiting on an id from the one before it, each about 783ms
           against a container that may have been asleep.

           None of it was sequential because it had to be; it was sequential
           because the ids lived on the client. /bootstrap does the same
           chain server-side, where they are already in hand, and answers
           with the chat to open. The remembered workspace is still sent,
           now as a hint the server honours or ignores. */
        const entry = await apiFetch<Bootstrap>("/bootstrap", {
          method: "POST",
          body: { workspace_id: lastWorkspaceId() },
        });
        rememberWorkspace(entry.active_workspace_id);
        router.replace(`/chat/${entry.conversation_id}`);
      } catch (err) {
        setError(authErrorMessage(err));
      }
    }

    void go();
  }, [attempt, router]);

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: space(3),
          paddingHorizontal: space(4),
          paddingVertical: space(24),
        }}
      >
        <AppText tone="low" style={{ textAlign: "center" }}>
          {error}
        </AppText>
        <Button variant="primary" onPress={() => setAttempt((n) => n + 1)}>
          Try again
        </Button>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: space(4),
        paddingVertical: space(24),
      }}
    >
      <ThinkingIndicator label="Opening your chat" />
    </View>
  );
}
