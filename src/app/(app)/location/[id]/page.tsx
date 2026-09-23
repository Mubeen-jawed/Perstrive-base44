import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { LeadsPer1kChart, LeadsSpendChart } from "@/components/Charts";
import RangePicker from "@/components/RangePicker";
import { EmptyChart, Panel, StatCard, StatusDot, th, thead } from "@/components/ui";
import { query } from "@/lib/db";
import { dec, LP1K_TARGET, money, num } from "@/lib/format";
import { metricsByDay, sumDays } from "@/lib/metrics";
import { resolveRange } from "@/lib/range";

type Params = Promise<{ id: string }>;
type SP = Promise<{ range?: string; from?: string; to?: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LocationPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [loc] = await query<{
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    status: string;
    brand: string | null;
    last_synced_at: Date | null;
  }>(
    `SELECT l.id, l.name, l.city, l.state, l.status, l.last_synced_at, b.name AS brand
       FROM locations l LEFT JOIN brands b ON b.id = l.brand_id
      WHERE l.id = $1`,
    [id],
  );
  if (!loc) notFound();

  const r = resolveRange(await searchParams, "30");
  const days = await metricsByDay(r.from, r.to, id);
  const t = sumDays(days);
  const lastSync = loc.last_synced_at ? new Date(loc.last_synced_at).toLocaleString("en-US") : "Never";

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <Link
        href="/leaderboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Leaderboard
      </Link>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{loc.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loc.brand || "—"}
            {loc.city ? ` · ${loc.city}, ${loc.state ?? ""}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <StatusDot status={loc.status} />
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" /> Last sync: {lastSync}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <RangePicker range={r.key} from={r.from} to={r.to} variant="buttons" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        <StatCard label="Spend" value={money(t.spend)} />
        <StatCard label="Leads" value={num(t.leads)} />
        <StatCard label="CPL" value={money(t.cost_per_lead)} />
        <StatCard label="Leads / $1k" value={dec(t.leads_per_1k)} good={t.leads_per_1k >= LP1K_TARGET} />
        <StatCard label="Bookings" value={num(t.booked_appointments)} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Leads & Spend">
          {days.length === 0 ? <EmptyChart height={260} /> : <LeadsSpendChart data={days} height={260} />}
        </Panel>
        <Panel title={`Leads per $1,000 (target: ${LP1K_TARGET})`}>
          {days.length === 0 ? <EmptyChart height={260} /> : <LeadsPer1kChart data={days} />}
        </Panel>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-4 md:px-6">
          <h2 className="text-sm font-bold tracking-wider text-muted-foreground uppercase">Daily Metrics</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={thead}>
                <th className="px-4 py-3 font-semibold md:px-6">Date</th>
                <th className={th + " text-right"}>Spend</th>
                <th className={th + " text-right"}>Impressions</th>
                <th className={th + " text-right"}>Clicks</th>
                <th className={th + " text-right"}>Leads</th>
                <th className={th + " text-right"}>CPL</th>
                <th className={th + " text-right"}>Leads / $1k</th>
                <th className="px-4 py-3 text-right font-semibold md:px-6">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {days.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    No metrics for this range.
                  </td>
                </tr>
              ) : (
                [...days].reverse().map((d) => (
                  <tr key={d.date} className="border-t">
                    <td className="px-4 py-3 font-medium md:px-6">{d.date}</td>
                    <td className="px-4 py-3 text-right">{money(d.spend)}</td>
                    <td className="px-4 py-3 text-right">{num(d.impressions)}</td>
                    <td className="px-4 py-3 text-right">{num(d.clicks)}</td>
                    <td className="px-4 py-3 text-right">{num(d.leads)}</td>
                    <td className="px-4 py-3 text-right">{money(d.cost_per_lead)}</td>
                    <td
                      className="px-4 py-3 text-right font-bold"
                      style={{ color: d.leads_per_1k >= LP1K_TARGET ? "#1F9D55" : "#E8151B" }}
                    >
                      {dec(d.leads_per_1k)}
                    </td>
                    <td className="px-4 py-3 text-right md:px-6">{num(d.booked_appointments)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
