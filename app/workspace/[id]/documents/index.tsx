import { Redirect, useLocalSearchParams } from "expo-router";
import { RequireAuth } from "@/components/system/RequireAuth";
import { isUuid } from "@/lib/routeIds";
import { WorkspaceDocuments } from "@/components/workspace/WorkspaceDocuments";

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // A malformed link goes home rather than into an API path.
  if (!isUuid(id)) return <Redirect href="/start" />;

  return (
    <RequireAuth>
      <WorkspaceDocuments workspaceId={id} />
    </RequireAuth>
  );
}
