import { useEffect, useState } from "react";
import { View } from "react-native";
import { apiFetch } from "@/lib/apiClient";
import { authErrorMessage } from "@/lib/auth";
import { HistorySearch } from "@/components/workspace/HistorySearch";
import { Spinner } from "@/components/ui/primitives";
import { ErrorNotice } from "@/components/auth/AuthScreen";
import { px, space } from "@/lib/theme";

type Workspace = { id: string; name: string };

export function WorkspaceSearch({ workspaceId }: { workspaceId: string }) {
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
    // No page title here: the design gives this screen the search box and
    // its results and nothing else, and the breadcrumb above already says
    // which workspace is being searched.
    <View style={{ flex: 1, paddingHorizontal: space(5), paddingTop: px(106) }}>
      <HistorySearch workspaceId={workspaceId} />
    </View>
  );
}
