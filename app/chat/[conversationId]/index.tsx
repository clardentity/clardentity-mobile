import { Redirect, useLocalSearchParams } from "expo-router";
import { RequireAuth } from "@/components/system/RequireAuth";
import { isUuid } from "@/lib/routeIds";
import { ChatView } from "@/components/chat/ChatView";

export default function Page() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();

  // A malformed link goes home rather than into an API path.
  if (!isUuid(conversationId)) return <Redirect href="/start" />;

  return (
    <RequireAuth>
      <ChatView conversationId={conversationId} />
    </RequireAuth>
  );
}
