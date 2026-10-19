import { RequireAuth } from "@/components/system/RequireAuth";
import { SettingsView } from "@/components/settings/SettingsView";

/** How the app behaves and what happens to the account - as distinct from
 *  /profile, which is what the app has worked out about the person using it. */

export default function Page() {
  return (
    <RequireAuth>
      <SettingsView />
    </RequireAuth>
  );
}
