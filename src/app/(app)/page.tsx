import { Activity, CalendarCheck, DollarSign, TrendingDown, Users } from "lucide-react";
import { LeadsSpendChart } from "@/components/Charts";
import RangePicker from "@/components/RangePicker";
import RowLink from "@/components/RowLink";
import { EmptyChart, KpiCard, PageHeader, Panel, th, thead } from "@/components/ui";
import { dec, LP1K_TARGET, money, num } from "@/lib/format";
import { metricsByDay, metricsByLocation, sumDays } from "@/lib/metrics";
import { resolveRange } from "@/lib/range";

type SP = Promise<{ range?: string; from?: string; to?: string }>;

export default async function OverviewPage({ searchParams }: { searchParams: SP }) {
  const r = resolveRange(await searchParams, "7");
  const [days, locations] = await Promise.all([
    metricsByDay(r.from, r.to),
    metricsByLocation(r.from, r.to),
  ]);
  const t = sumDays(days);
  locations.sort((a, b) => b.spend - a.spend);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <PageHeader title="Overview" subtitle="Live marketing performance across your locations">
        <RangePicker range={r.key} from={r.from} to={r.to} />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        <KpiCard label="Total Spend" value={money(t.spend)} icon={DollarSign} />
        <KpiCard label="Leads" value={num(t.leads)} icon={Users} />
        <KpiCard
          label="Cost Per Lead"
          value={money(t.cost_per_lead)}
          icon={TrendingDown}
          accent={t.cost_per_lead > 0 && t.cost_per_lead < 50}
        />
        <KpiCard
          label="Leads / $1,000"
          value={dec(t.leads_per_1k)}
          icon={Activity}
          accent={t.leads_per_1k >= LP1K_TARGET}
        />
        <KpiCard label="Booked Appts" value={num(t.booked_appointments)} icon={CalendarCheck} />
      </div>

      <div className="mb-6">
        <Panel title="Leads & Spend Over Time">
          {days.length === 0 ? <EmptyChart /> : <LeadsSpendChart data={days} />}
        </Panel>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-4 md:px-6">
          <h2 className="text-sm font-bold tracking-wider text-muted-foreground uppercase">
            Location Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={thead}>
                <th className="px-4 py-3 font-semibold md:px-6">Location</th>
                <th className={th}>Market</th>
                <th className={th + " text-right"}>Spend</th>
                <th className={th + " text-right"}>Leads</th>
                <th className={th + " text-right"}>CPL</th>
                <th className={th + " text-right"}>Leads / $1k</th>
                <th className={th + " text-right"}>Booked</th>
                <th className="px-4 py-3 text-right font-semibold md:px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    No data.
                  </td>
                </tr>
              ) : (
                locations.map((l) => (
                  <RowLink key={l.id} href={`/location/${l.id}`} className="border-t hover:bg-muted/40">
                    <td className="px-4 py-3 font-semibold md:px-6">{l.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[l.city, l.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{money(l.spend)}</td>
                    <td className="px-4 py-3 text-right">{num(l.leads)}</td>
                    <td className="px-4 py-3 text-right">{money(l.cost_per_lead)}</td>
                    <td
                      className="px-4 py-3 text-right font-bold"
                      style={{ color: l.leads_per_1k >= LP1K_TARGET ? "#1F9D55" : "#E8151B" }}
                    >
                      {dec(l.leads_per_1k)}
                    </td>
                    <td className="px-4 py-3 text-right">{num(l.booked_appointments)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground capitalize md:px-6">
                      {l.status}
                    </td>
                  </RowLink>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
