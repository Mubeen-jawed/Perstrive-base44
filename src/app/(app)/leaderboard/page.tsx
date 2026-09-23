import Link from "next/link";
import { ArrowUpDown, Trophy } from "lucide-react";
import FilterSelect from "@/components/FilterSelect";
import RowLink from "@/components/RowLink";
import { PageHeader, StatusDot, thead } from "@/components/ui";
import { query } from "@/lib/db";
import { dec, LP1K_TARGET, money, num } from "@/lib/format";
import { metricsByLocation, type LocationRow } from "@/lib/metrics";
import { daysAgo, isoDay } from "@/lib/range";

const COLUMNS = [
  { key: "name", label: "Location", align: "left" },
  { key: "spend", label: "Spend", align: "right" },
  { key: "leads", label: "Leads", align: "right" },
  { key: "cost_per_lead", label: "CPL", align: "right" },
  { key: "leads_per_1k", label: "Leads / $1k", align: "right" },
  { key: "booked_appointments", label: "Bookings", align: "right" },
  { key: "status", label: "Status", align: "left" },
] as const;

type SortKey = (typeof COLUMNS)[number]["key"];
type SP = Promise<{ sort?: string; dir?: string; brand?: string; state?: string }>;

export default async function LeaderboardPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const sort: SortKey = COLUMNS.some((c) => c.key === sp.sort) ? (sp.sort as SortKey) : "spend";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const brand = /^[0-9a-f-]{36}$/i.test(sp.brand ?? "") ? sp.brand! : "";
  const state = sp.state ?? "";

  const [brands, states, rows] = await Promise.all([
    query<{ id: string; name: string }>("SELECT id, name FROM brands ORDER BY name"),
    query<{ state: string }>(
      "SELECT DISTINCT state FROM locations WHERE state IS NOT NULL AND state <> '' ORDER BY state",
    ),
    metricsByLocation(daysAgo(29), isoDay(new Date()), { brandId: brand, state }),
  ]);

  rows.sort((a, b) => {
    const x = a[sort as keyof LocationRow];
    const y = b[sort as keyof LocationRow];
    const cmp =
      typeof x === "string" || typeof y === "string"
        ? String(x ?? "").localeCompare(String(y ?? ""))
        : Number(x) - Number(y);
    return dir === "asc" ? cmp : -cmp;
  });

  const sortHref = (key: SortKey) => {
    const params = new URLSearchParams();
    if (brand) params.set("brand", brand);
    if (state) params.set("state", state);
    params.set("sort", key);
    params.set("dir", sort === key ? (dir === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc");
    return `/leaderboard?${params}`;
  };

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <PageHeader
        title="Location Leaderboard"
        icon={Trophy}
        subtitle={`Last 30 days · green = leads per $1,000 ≥ ${LP1K_TARGET}`}
      >
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            param="brand"
            value={brand}
            options={[{ value: "", label: "All brands" }, ...brands.map((b) => ({ value: b.id, label: b.name }))]}
          />
          <FilterSelect
            param="state"
            value={state}
            options={[{ value: "", label: "All states" }, ...states.map((s) => ({ value: s.state, label: s.state }))]}
          />
        </div>
      </PageHeader>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={thead}>
                <th className="w-10 px-4 py-3 font-semibold">#</th>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={"px-4 py-3 font-semibold " + (c.align === "right" ? "text-right" : "text-left")}
                  >
                    <Link
                      href={sortHref(c.key)}
                      scroll={false}
                      className={
                        "inline-flex items-center gap-1 select-none hover:text-foreground " +
                        (c.align === "right" ? "flex-row-reverse" : "") +
                        (sort === c.key ? " text-foreground" : "")
                      }
                    >
                      {c.label}
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                    No locations found.
                  </td>
                </tr>
              ) : (
                rows.map((l, i) => {
                  const good = l.leads_per_1k >= LP1K_TARGET;
                  return (
                    <RowLink key={l.id} href={`/location/${l.id}`} className="border-t hover:bg-muted/40">
                      <td className="px-4 py-3 font-semibold text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Link href={`/location/${l.id}`} className="font-semibold hover:text-primary">
                          {l.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {l.brand || "—"}
                          {l.city ? ` · ${l.city}, ${l.state ?? ""}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{money(l.spend)}</td>
                      <td className="px-4 py-3 text-right">{num(l.leads)}</td>
                      <td className="px-4 py-3 text-right">{money(l.cost_per_lead)}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className="inline-flex items-center gap-2 font-bold"
                          style={{ color: good ? "#1F9D55" : "#E8151B" }}
                        >
                          <span
                            className={"inline-block h-2 w-2 rounded-full " + (good ? "bg-emerald-500" : "bg-primary")}
                          />
                          {dec(l.leads_per_1k)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{num(l.booked_appointments)}</td>
                      <td className="px-4 py-3">
                        <StatusDot status={l.status} />
                      </td>
                    </RowLink>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
