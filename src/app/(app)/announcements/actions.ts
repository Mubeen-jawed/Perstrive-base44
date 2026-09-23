"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export type PostState = { error?: string; ok?: number };

export async function createAnnouncement(_: PostState, form: FormData): Promise<PostState> {
  const user = await requireAdmin();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const brandId = String(form.get("brand_id") ?? "") || null;
  const pinned = form.get("pinned") === "on";
  if (!title || !body) return { error: "Title and message are required." };

  await query(
    "INSERT INTO announcements (title, body, brand_id, author, pinned) VALUES ($1, $2, $3, $4, $5)",
    [title, body, brandId, user.full_name || user.email, pinned],
  );
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

export async function deleteAnnouncement(form: FormData) {
  await requireAdmin();
  await query("DELETE FROM announcements WHERE id = $1", [String(form.get("id"))]);
  revalidatePath("/", "layout");
}
