export type RangeKey = "today" | "7" | "30" | "custom";

export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "today", label: "Today", days: 0 },
  { key: "7", label: "7 days", days: 6 },
  { key: "30", label: "30 days", days: 29 },
  { key: "custom", label: "Custom", days: null },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
}

export type ResolvedRange = { key: RangeKey; from: string; to: string };

export function resolveRange(
  params: { range?: string; from?: string; to?: string },
  fallback: RangeKey = "7",
): ResolvedRange {
  const key = (RANGES.find((r) => r.key === params.range)?.key ?? fallback) as RangeKey;
  const today = isoDay(new Date());
  if (key === "custom") {
    let from = params.from && ISO_DATE.test(params.from) ? params.from : today;
    let to = params.to && ISO_DATE.test(params.to) ? params.to : today;
    if (from > to) [from, to] = [to, from];
    return { key, from, to };
  }
  const days = RANGES.find((r) => r.key === key)!.days!;
  return { key, from: daysAgo(days), to: today };
}
