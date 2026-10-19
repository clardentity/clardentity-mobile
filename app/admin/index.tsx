import { RequireAuth } from "@/components/system/RequireAuth";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

/* The server decides who may see this, not the route: RequireAuth only gets
   you signed in, and /admin/overview returns 404 to anyone outside the
   configured admin list. */

export default function Page() {
  return (
    <RequireAuth>
      <AdminDashboard />
    </RequireAuth>
  );
}
