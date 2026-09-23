import "server-only";
import { query } from "./db";
import { daysAgo, isoDay } from "./range";

// Pulls daily account-level insights from the Meta Marketing API for every
// location that has a meta_ad_account_id, and upserts them into daily_metrics.
// booked_appointments is left untouched (it comes from your CRM, not Meta).

type InsightRow = {
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
};

// Checked in order; the first one present is used so leads aren't double counted.
const LEAD_ACTIONS = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];

function leadsFrom(actions: InsightRow["actions"]) {
  if (!actions) return 0;
  for (const type of LEAD_ACTIONS) {
    const hit = actions.find((a) => a.action_type === type);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

async function fetchInsights(accountId: string, since: string, until: string) {
  const token = process.env.META_ACCESS_TOKEN!;
  const version = process.env.META_API_VERSION || "v23.0";
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const params = new URLSearchParams({
    level: "account",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    fields: "spend,impressions,clicks,actions",
    limit: "500",
    access_token: token,
  });

  const rows: InsightRow[] = [];
  let url: string | undefined = `https://graph.facebook.com/${version}/${id}/insights?${params}`;
  while (url) {
    const res: Response = await fetch(url, { cache: "no-store" });
    const json: {
      data?: InsightRow[];
      paging?: { next?: string };
      error?: { message?: string };
    } = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `Meta API ${res.status}`);
    rows.push(...(json.data ?? []));
    url = json.paging?.next;
  }
  return rows;
}

export type SyncResult = {
  synced: number;
  errors: { location: string; error: string }[];
  range: { since: string; until: string };
};

export async function syncMeta(): Promise<SyncResult> {
  if (!process.env.META_ACCESS_TOKEN) throw new Error("META_ACCESS_TOKEN is not set.");

  const days = Number(process.env.META_SYNC_DAYS || 7);
  const since = daysAgo(Math.max(0, days - 1));
  const until = isoDay(new Date());
  const locations = await query<{ id: string; name: string; meta_ad_account_id: string }>(
    `SELECT id, name, meta_ad_account_id FROM locations
      WHERE meta_ad_account_id IS NOT NULL AND meta_ad_account_id <> ''`,
  );

  const result: SyncResult = { synced: 0, errors: [], range: { since, until } };

  for (const loc of locations) {
    try {
      const rows = await fetchInsights(loc.meta_ad_account_id.trim(), since, until);
      for (const r of rows) {
        await query(
          `INSERT INTO daily_metrics (location_id, date, spend, impressions, clicks, leads)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (location_id, date) DO UPDATE SET
             spend = EXCLUDED.spend,
             impressions = EXCLUDED.impressions,
             clicks = EXCLUDED.clicks,
             leads = EXCLUDED.leads,
             updated_at = now()`,
          [
            loc.id,
            r.date_start,
            Number(r.spend || 0),
            Number(r.impressions || 0),
            Number(r.clicks || 0),
            leadsFrom(r.actions),
          ],
        );
      }
      await query("UPDATE locations SET last_synced_at = now() WHERE id = $1", [loc.id]);
      result.synced++;
    } catch (e) {
      result.errors.push({ location: loc.name, error: (e as Error).message });
    }
  }
  return result;
}
