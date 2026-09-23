import { Megaphone, Pin } from "lucide-react";
import ConfirmButton from "@/components/ConfirmButton";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { deleteAnnouncement } from "./actions";
import NewPost from "./NewPost";

type Row = {
  id: string;
  title: string;
  body: string;
  author: string | null;
  pinned: boolean;
  created_at: Date;
  brand: string | null;
};

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const [rows, brands] = await Promise.all([
    query<Row>(
      `SELECT a.id, a.title, a.body, a.author, a.pinned, a.created_at, b.name AS brand
         FROM announcements a LEFT JOIN brands b ON b.id = a.brand_id
        ORDER BY a.pinned DESC, a.created_at DESC
        LIMIT 200`,
    ),
    isAdmin ? query<{ id: string; name: string }>("SELECT id, name FROM brands ORDER BY name") : [],
  ]);

  // Viewing the page marks everything as read (clears the sidebar count).
  await query(
    `INSERT INTO announcement_reads (user_id, announcement_id)
     SELECT $1, id FROM announcements ON CONFLICT DO NOTHING`,
    [user.id],
  );

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      {/* NewPost renders its button here and its form full-width on the next row. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Megaphone className="h-6 w-6 text-primary" /> Announcements
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Updates from your corporate team</p>
        </div>
        {isAdmin && <NewPost brands={brands} />}
      </div>

      {rows.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">No announcements yet.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((a) => (
            <article
              key={a.id}
              className={"rounded-xl border bg-card p-5 " + (a.pinned ? "border-primary/40" : "")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg leading-tight font-bold">{a.title}</h3>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {a.author ? `by ${a.author} · ` : ""}
                    {new Date(a.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {a.brand ? ` · ${a.brand}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.pinned && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      <Pin className="h-3 w-3" /> Pinned
                    </span>
                  )}
                  {isAdmin && (
                    <form action={deleteAnnouncement}>
                      <input type="hidden" name="id" value={a.id} />
                      <ConfirmButton message="Delete this announcement?" />
                    </form>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">{a.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
