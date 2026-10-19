import { useLocalSearchParams } from "expo-router";
import { RequireAuth } from "@/components/system/RequireAuth";
import { WorkspaceDetail } from "@/components/workspace/WorkspaceDetail";

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <RequireAuth>
      <WorkspaceDetail workspaceId={id} />
    </RequireAuth>
  );
}
