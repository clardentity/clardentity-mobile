import { RequireAuth } from "@/components/system/RequireAuth";
import { ProfileView } from "@/components/profile/ProfileView";

export default function Page() {
  return (
    <RequireAuth>
      <ProfileView />
    </RequireAuth>
  );
}
