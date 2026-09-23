"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { syncMeta, type SyncResult } from "@/lib/meta";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = () => revalidatePath("/", "layout");

export async function addBrand(f: FormData) {
  await requireAdmin();
  const name = str(f, "name");
  if (name) await query("INSERT INTO brands (name) VALUES ($1)", [name]);
  done();
}

export async function deleteBrand(f: FormData) {
  await requireAdmin();
  await query("DELETE FROM brands WHERE id = $1", [str(f, "id")]);
  done();
}

export async function addLocation(f: FormData) {
  await requireAdmin();
  const name = str(f, "name");
  if (!name) return;
  await query(
    `INSERT INTO locations (name, city, state, brand_id, meta_ad_account_id, status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      name,
      str(f, "city") || null,
      str(f, "state") || null,
      str(f, "brand_id") || null,
      str(f, "meta_ad_account_id") || null,
      str(f, "status") || "onboarding",
    ],
  );
  done();
}

export async function setLocationStatus(f: FormData) {
  await requireAdmin();
  await query("UPDATE locations SET status = $2 WHERE id = $1", [str(f, "id"), str(f, "status")]);
  done();
}

export async function deleteLocation(f: FormData) {
  await requireAdmin();
  await query("DELETE FROM locations WHERE id = $1", [str(f, "id")]);
  done();
}

export type FormState = { error?: string; ok?: number };

export async function addUser(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const email = str(f, "email").toLowerCase();
  const password = str(f, "password");
  const role = str(f, "role") === "admin" ? "admin" : "member";
  if (!email || password.length < 8) return { error: "Email and a password of 8+ characters are required." };

  const hash = await bcrypt.hash(password, 12);
  try {
    await query("INSERT INTO users (email, full_name, password_hash, role) VALUES ($1, $2, $3, $4)", [
      email,
      str(f, "full_name") || null,
      hash,
      role,
    ]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "A user with that email already exists." };
    throw e;
  }
  done();
  return { ok: Date.now() };
}

export async function deleteUser(f: FormData) {
  const me = await requireAdmin();
  const id = str(f, "id");
  if (id === me.id) return; // don't let an admin lock themselves out
  await query("DELETE FROM users WHERE id = $1", [id]);
  done();
}

export type SyncState = { result?: SyncResult; error?: string };

export async function runSync(): Promise<SyncState> {
  await requireAdmin();
  try {
    const result = await syncMeta();
    done();
    return { result };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
