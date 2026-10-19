import { useLocalSearchParams } from "expo-router";
import { RequireAuth } from "@/components/system/RequireAuth";
import { WorkspaceSearch } from "@/components/workspace/WorkspaceSearch";

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <RequireAuth>
      <WorkspaceSearch workspaceId={id} />
    </RequireAuth>
  );
}
