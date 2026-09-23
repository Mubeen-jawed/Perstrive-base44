"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { query } from "@/lib/db";

export type LoginState = { error?: string; email?: string };

// Compared against when the email doesn't exist, so response time doesn't reveal valid emails.
const DUMMY_HASH = "$2b$12$X.xPSMI0Hh1TPzW9thKwhuiJh7Wd2GHXn5.B1GwPw56aCG/.Q721C";

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const [user] = await query<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [email],
  );
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "Incorrect email or password.", email };

  await query("DELETE FROM sessions WHERE user_id = $1 AND expires_at < now()", [user.id]);
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
