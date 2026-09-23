"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { btnPrimary, input } from "@/components/ui";
import { createAnnouncement, type PostState } from "./actions";

export default function NewPost({ brands }: { brands: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PostState, FormData>(createAnnouncement, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.ok]);

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} className={btnPrimary}>
        <Plus className="h-4 w-4" /> New Post
      </button>

      {open && (
        <form
          ref={formRef}
          action={action}
          className="order-last flex w-full flex-col gap-3 rounded-xl border bg-card p-5"
        >
          <input name="title" placeholder="Title" required className={input + " text-base font-semibold"} />
          <textarea
            name="body"
            placeholder="Write your announcement…"
            rows={4}
            required
            className={input + " resize-y"}
          />
          <div className="flex flex-wrap gap-3">
            <select name="brand_id" defaultValue="" className={input}>
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 px-2 text-sm">
              <input type="checkbox" name="pinned" /> Pin to top
            </label>
          </div>
          {state.error && <p className="text-sm text-primary">{state.error}</p>}
          <button type="submit" disabled={pending} className={btnPrimary + " self-start"}>
            {pending ? "Posting…" : "Post Announcement"}
          </button>
        </form>
      )}
    </>
  );
}
