import "server-only";
import { query } from "./db";

export type Totals = {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  booked_appointments: number;
  cost_per_lead: number;
  leads_per_1k: number;
};

export type DayRow = Totals & { date: string };

export type LocationRow = Totals & {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  status: string;
  brand_id: string | null;
  brand: string | null;
};

function derive<T extends Omit<Totals, "cost_per_lead" | "leads_per_1k">>(r: T): T & Totals {
  return {
    ...r,
    cost_per_lead: r.leads ? r.spend / r.leads : 0,
    leads_per_1k: r.spend ? r.leads / (r.spend / 1000) : 0,
  };
}

const SUMS = `
  COALESCE(SUM(m.spend), 0)::float8               AS spend,
  COALESCE(SUM(m.impressions), 0)::float8         AS impressions,
  COALESCE(SUM(m.clicks), 0)::float8              AS clicks,
  COALESCE(SUM(m.leads), 0)::float8               AS leads,
  COALESCE(SUM(m.booked_appointments), 0)::float8 AS booked_appointments`;

/** Daily totals across the given locations (or all locations when omitted). */
export async function metricsByDay(from: string, to: string, locationId?: string) {
  const rows = await query<Omit<DayRow, "cost_per_lead" | "leads_per_1k">>(
    `SELECT m.date, ${SUMS}
       FROM daily_metrics m
      WHERE m.date BETWEEN $1 AND $2
        AND ($3::uuid IS NULL OR m.location_id = $3::uuid)
      GROUP BY m.date
      ORDER BY m.date`,
    [from, to, locationId ?? null],
  );
  return rows.map(derive);
}

export function sumDays(days: DayRow[]): Totals {
  const t = { spend: 0, impressions: 0, clicks: 0, leads: 0, booked_appointments: 0 };
  for (const d of days) {
    t.spend += d.spend;
    t.impressions += d.impressions;
    t.clicks += d.clicks;
    t.leads += d.leads;
    t.booked_appointments += d.booked_appointments;
  }
  return derive(t);
}

/** Per-location totals for the range, including locations with no data. */
export async function metricsByLocation(
  from: string,
  to: string,
  filters: { brandId?: string; state?: string } = {},
) {
  const rows = await query<Omit<LocationRow, "cost_per_lead" | "leads_per_1k">>(
    `SELECT l.id, l.name, l.city, l.state, l.status, l.brand_id, b.name AS brand, ${SUMS}
       FROM locations l
       LEFT JOIN brands b ON b.id = l.brand_id
       LEFT JOIN daily_metrics m
              ON m.location_id = l.id AND m.date BETWEEN $1 AND $2
      WHERE ($3::uuid IS NULL OR l.brand_id = $3::uuid)
        AND ($4::text IS NULL OR l.state = $4::text)
      GROUP BY l.id, b.name`,
    [from, to, filters.brandId || null, filters.state || null],
  );
  return rows.map(derive);
}
