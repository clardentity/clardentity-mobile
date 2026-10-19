import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/lib/apiClient";
import { authErrorMessage } from "@/lib/auth";
import { DocumentUploader } from "@/components/upload/DocumentUploader";
import { AttachmentSearch } from "@/components/workspace/AttachmentSearch";
import { Spinner } from "@/components/ui/primitives";
import { ErrorNotice } from "@/components/auth/AuthScreen";
import { px, space, useColors } from "@/lib/theme";

type Workspace = { id: string; name: string };

export function WorkspaceDocuments({ workspaceId }: { workspaceId: string }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Workspace>(`/workspaces/${workspaceId}`)
      .then((w) => {
        if (!cancelled) setWorkspace(w);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (error) {
    return (
      <View style={{ paddingHorizontal: space(4), paddingVertical: space(8) }}>
        <ErrorNotice>{error}</ErrorNotice>
      </View>
    );
  }

  if (!workspace) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: space(24) }}>
        <Spinner />
      </View>
    );
  }

  return (
    // The same frame as the rest of the design's pages, at phone width.
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ paddingHorizontal: space(5), paddingTop: px(69), paddingBottom: insets.bottom + space(16) }}
    >
      <DocumentUploader workspaceId={workspaceId} description={`Files added to ${workspace.name} for use across chats.`} />

      {/* Not in the design, and not droppable: finding the line you half
          remember inside a document is the reason to have put it here. */}
      <View style={{ marginTop: space(12), borderTopWidth: 1, borderTopColor: c.hairline, paddingTop: space(8) }}>
        <AttachmentSearch workspaceId={workspaceId} />
      </View>
    </ScrollView>
  );
}
