import { useLocalSearchParams } from "expo-router";
import { RequireAuth } from "@/components/system/RequireAuth";
import { WorkspaceDocuments } from "@/components/workspace/WorkspaceDocuments";

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <RequireAuth>
      <WorkspaceDocuments workspaceId={id} />
    </RequireAuth>
  );
}
