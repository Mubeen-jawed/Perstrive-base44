import Sidebar from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [{ count }] = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM announcements a
      WHERE NOT EXISTS (
        SELECT 1 FROM announcement_reads r WHERE r.announcement_id = a.id AND r.user_id = $1
      )`,
    [user.id],
  );

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        isAdmin={user.role === "admin"}
        unread={count}
        userLabel={user.full_name || user.email}
      />
      <main className="min-h-screen md:pl-60">{children}</main>
    </div>
  );
}
