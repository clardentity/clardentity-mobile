import { Redirect, useLocalSearchParams } from "expo-router";
import { RequireAuth } from "@/components/system/RequireAuth";
import { isRouteId } from "@/lib/routeIds";
import { WorkspaceDetail } from "@/components/workspace/WorkspaceDetail";

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // A malformed link goes home rather than into an API path.
  if (!isRouteId(id)) return <Redirect href="/start" />;

  return (
    <RequireAuth>
      <WorkspaceDetail workspaceId={id} />
    </RequireAuth>
  );
}
