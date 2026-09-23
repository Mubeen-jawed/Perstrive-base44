"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const field = "w-full rounded-lg border bg-white px-3 py-2.5 text-sm";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          defaultValue={state.email}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className={field} />
      </label>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-primary">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
