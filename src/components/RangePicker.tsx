"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RANGES, type RangeKey } from "@/lib/range";

type Props = {
  range: RangeKey;
  from: string;
  to: string;
  /** "segmented" = joined control (Overview); "buttons" = separate buttons (Location page). */
  variant?: "segmented" | "buttons";
};

export default function RangePicker({ range, from, to, variant = "segmented" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function go(next: Record<string, string>) {
    const params = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(next)) params.set(k, v);
    if (next.range && next.range !== "custom") {
      params.delete("from");
      params.delete("to");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const pick = (key: RangeKey) =>
    key === "custom" ? go({ range: "custom", from, to }) : go({ range: key });

  const custom = range === "custom" && (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={from}
        max={to}
        onChange={(e) => e.target.value && go({ range: "custom", from: e.target.value, to })}
        className="rounded-lg border bg-card px-2 py-1.5 text-sm"
      />
      <span className="text-sm text-muted-foreground">to</span>
      <input
        type="date"
        value={to}
        min={from}
        onChange={(e) => e.target.value && go({ range: "custom", from, to: e.target.value })}
        className="rounded-lg border bg-card px-2 py-1.5 text-sm"
      />
    </div>
  );

  if (variant === "buttons") {
    return (
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => pick(r.key)}
            className={
              "rounded-lg border px-3 py-1.5 text-sm font-semibold " +
              (range === r.key
                ? "border-primary bg-primary text-white"
                : "bg-card text-muted-foreground")
            }
          >
            {r.label}
          </button>
        ))}
        {custom}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-lg border bg-card">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => pick(r.key)}
            className={
              "px-3 py-1.5 text-sm font-semibold transition-colors " +
              (range === r.key
                ? "bg-primary text-white"
                : "bg-card text-muted-foreground hover:text-foreground")
            }
          >
            {r.label}
          </button>
        ))}
      </div>
      {custom}
    </div>
  );
}
