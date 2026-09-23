import Link from "next/link";
import { MapPin, Plus, Tag, UserRound } from "lucide-react";
import ConfirmButton from "@/components/ConfirmButton";
import { btnPrimary, input, PageHeader, thead } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  addBrand,
  addLocation,
  deleteBrand,
  deleteLocation,
  deleteUser,
  setLocationStatus,
} from "./actions";
import { AddUserForm, StatusSelect, SyncButton } from "./client";

const TABS = [
  { key: "locations", label: "Locations", icon: MapPin },
  { key: "brands", label: "Brands", icon: Tag },
  { key: "users", label: "User Access", icon: UserRound },
] as const;

type SP = Promise<{ tab?: string }>;

export default async function AdminPage({ searchParams }: { searchParams: SP }) {
  const me = await requireAdmin();
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t.key === raw)?.key ?? "locations";

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <PageHeader title="Admin Settings" subtitle="Manage brands, locations, and access">
        <SyncButton />
      </PageHeader>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin?tab=${t.key}`}
            className={
              "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap " +
              (tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </Link>
        ))}
      </div>

      {tab === "locations" && <LocationsTab />}
      {tab === "brands" && <BrandsTab />}
      {tab === "users" && <UsersTab meId={me.id} />}
    </div>
  );
}

async function LocationsTab() {
  const [brands, locations] = await Promise.all([
    query<{ id: string; name: string }>("SELECT id, name FROM brands ORDER BY name"),
    query<{
      id: string;
      name: string;
      city: string | null;
      state: string | null;
      status: string;
      meta_ad_account_id: string | null;
      brand: string | null;
      last_synced_at: Date | null;
    }>(
      `SELECT l.*, b.name AS brand FROM locations l
         LEFT JOIN brands b ON b.id = l.brand_id ORDER BY l.name`,
    ),
  ]);

  return (
    <div>
      <form action={addLocation} className="mb-6 grid grid-cols-1 gap-2 rounded-xl border bg-card p-4 md:grid-cols-3 lg:grid-cols-4">
        <input name="name" placeholder="Location name" required className={input} />
        <input name="city" placeholder="City" className={input} />
        <input name="state" placeholder="State" className={input} />
        <select name="brand_id" defaultValue={brands[0]?.id ?? ""} className={input}>
          <option value="">No brand</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input name="meta_ad_account_id" placeholder="Meta Ad Account ID" className={input} />
        <select name="status" defaultValue="onboarding" className={input + " capitalize"}>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="onboarding">Onboarding</option>
        </select>
        <button type="submit" className={btnPrimary + " justify-center"}>
          <Plus className="h-4 w-4" /> Add location
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={thead}>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Brand</th>
                <th className="px-4 py-3 font-semibold">Meta Ad Account</th>
                <th className="px-4 py-3 font-semibold">Last sync</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {locations.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{l.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[l.city, l.state].filter(Boolean).join(", ") || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{l.brand ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.meta_ad_account_id || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {l.last_synced_at ? new Date(l.last_synced_at).toLocaleString("en-US") : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelect id={l.id} status={l.status} action={setLocationStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteLocation}>
                      <input type="hidden" name="id" value={l.id} />
                      <ConfirmButton message={`Delete ${l.name} and all its metrics?`} />
                    </form>
                  </td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No locations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function BrandsTab() {
  const brands = await query<{ id: string; name: string; locations: number }>(
    `SELECT b.id, b.name, COUNT(l.id)::int AS locations
       FROM brands b LEFT JOIN locations l ON l.brand_id = b.id
      GROUP BY b.id ORDER BY b.name`,
  );

  return (
    <div>
      <form action={addBrand} className="mb-6 flex flex-wrap gap-2">
        <input name="name" placeholder="Brand name" required className={input + " min-w-[200px] flex-1"} />
        <button type="submit" className={btnPrimary}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className={thead}>
              <th className="px-4 py-3 font-semibold">Brand</th>
              <th className="px-4 py-3 font-semibold">Locations</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{b.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{b.locations}</td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteBrand}>
                    <input type="hidden" name="id" value={b.id} />
                    <ConfirmButton message={`Delete ${b.name}? Its locations will be kept without a brand.`} />
                  </form>
                </td>
              </tr>
            ))}
            {brands.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  No brands yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function UsersTab({ meId }: { meId: string }) {
  const users = await query<{ id: string; email: string; full_name: string | null; role: string; created_at: Date }>(
    "SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at",
  );

  return (
    <div>
      <AddUserForm />
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={thead}>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{u.full_name || u.email}</div>
                    {u.full_name && <div className="text-xs text-muted-foreground">{u.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{u.role}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("en-US")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== meId && (
                      <form action={deleteUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <ConfirmButton message={`Remove access for ${u.email}?`} />
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
