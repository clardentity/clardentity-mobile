import { Redirect, useLocalSearchParams } from "expo-router";
import { RequireAuth } from "@/components/system/RequireAuth";
import { isRouteId } from "@/lib/routeIds";
import { WorkspaceSearch } from "@/components/workspace/WorkspaceSearch";

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // A malformed link goes home rather than into an API path.
  if (!isRouteId(id)) return <Redirect href="/start" />;

  return (
    <RequireAuth>
      <WorkspaceSearch workspaceId={id} />
    </RequireAuth>
  );
}
