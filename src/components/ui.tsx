import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          {Icon && <Icon className="h-6 w-6 text-primary" />}
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <span
        className={
          "text-3xl font-extrabold tracking-tight " + (accent ? "text-primary" : "text-foreground")
        }
      >
        {value}
      </span>
    </div>
  );
}

/** Compact stat used on the location detail page. good=true/false colors the value green/red. */
export function StatCard({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </div>
      <div
        className="mt-1 text-2xl font-extrabold tracking-tight"
        style={good == null ? undefined : { color: good ? "#1F9D55" : "#E8151B" }}
      >
        {value}
      </div>
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 md:p-6">
      <h2 className="mb-4 text-sm font-bold tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

export function EmptyChart({ height = 288 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
      No metrics for this range.
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  const color =
    { active: "bg-emerald-500", paused: "bg-amber-500", onboarding: "bg-slate-400" }[status] ??
    "bg-slate-400";
  return (
    <span className="inline-flex items-center gap-2">
      <span className={"inline-block h-2 w-2 rounded-full " + color} />
      <span className="text-sm text-muted-foreground capitalize">{status}</span>
    </span>
  );
}

export const th = "px-4 py-3 font-semibold";
export const thead = "text-left text-xs tracking-wider text-muted-foreground uppercase";
export const input = "rounded-lg border bg-white px-3 py-2 text-sm";
export const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";
