import { useLocalSearchParams } from "expo-router";
import { RequireAuth } from "@/components/system/RequireAuth";
import { ChatView } from "@/components/chat/ChatView";

export default function Page() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();

  return (
    <RequireAuth>
      <ChatView conversationId={conversationId} />
    </RequireAuth>
  );
}
