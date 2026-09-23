"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { btnPrimary, input } from "@/components/ui";
import { addUser, runSync, type FormState, type SyncState } from "./actions";

export function SyncButton() {
  const [state, action, pending] = useActionState<SyncState>(runSync, {});
  const r = state.result;

  return (
    <div className="flex flex-col items-start gap-3 md:items-end">
      <form action={action}>
        <button type="submit" disabled={pending} className={btnPrimary + " gap-2"}>
          <RefreshCw className={"h-4 w-4 " + (pending ? "animate-spin" : "")} />
          {pending ? "Syncing…" : "Sync Now"}
        </button>
      </form>
      {state.error && <p className="text-sm text-primary">Error: {state.error}</p>}
      {r && (
        <p className="text-sm">
          <span className="font-semibold">Sync complete.</span> {r.synced} locations synced.
          {r.errors.length > 0 && (
            <span className="text-primary" title={r.errors.map((e) => `${e.location}: ${e.error}`).join("\n")}>
              {" "}
              · {r.errors.length} errors
            </span>
          )}
          <span className="text-muted-foreground">
            {" "}
            · {r.range.since} → {r.range.until}
          </span>
        </p>
      )}
    </div>
  );
}

export function StatusSelect({
  id,
  status,
  action,
}: {
  id: string;
  status: string;
  action: (f: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border bg-white px-2 py-1 text-sm capitalize"
      >
        {["active", "paused", "onboarding"].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </form>
  );
}

export function AddUserForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addUser, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={action} className="mb-6 rounded-xl border bg-card p-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
        <input name="full_name" placeholder="Full name" className={input} />
        <input name="email" type="email" placeholder="Email" required className={input} />
        <input name="password" type="password" placeholder="Temporary password" required minLength={8} className={input} />
        <select name="role" defaultValue="member" className={input}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={pending} className={btnPrimary + " justify-center"}>
          <Plus className="h-4 w-4" /> Add user
        </button>
      </div>
      {state.error && <p className="mt-2 text-sm text-primary">{state.error}</p>}
    </form>
  );
}
