import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

// Server-side guard in addition to the middleware gate (defense in depth).
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/");
  }
  return <AdminDashboard currentUserId={session.user.id} />;
}
