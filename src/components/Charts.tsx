"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dec, money, num, LP1K_TARGET } from "@/lib/format";

type Day = { date: string; leads: number; spend: number; leads_per_1k: number };

const tick = { fontSize: 11, fill: "#5B6270" };
const grid = <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" vertical={false} />;
const tooltipStyle = { borderRadius: 8, border: "1px solid #E4E7EC", fontSize: 12 };

export function LeadsSpendChart({ data, height = 300 }: { data: Day[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        {grid}
        <XAxis dataKey="date" tick={tick} tickLine={false} axisLine={{ stroke: "#E4E7EC" }} />
        <YAxis yAxisId="left" tick={tick} tickLine={false} axisLine={false} />
        <YAxis yAxisId="right" orientation="right" tick={tick} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number, name: string) => (name === "Spend" ? money(v) : num(v))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line yAxisId="left" type="monotone" dataKey="leads" name="Leads" stroke="#E8151B" strokeWidth={2.5} dot={false} />
        <Line yAxisId="right" type="monotone" dataKey="spend" name="Spend" stroke="#0A0C10" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LeadsPer1kChart({ data, height = 260 }: { data: Day[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 28, left: 0, bottom: 5 }}>
        {grid}
        <XAxis dataKey="date" tick={tick} tickLine={false} axisLine={{ stroke: "#E4E7EC" }} />
        <YAxis tick={tick} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => dec(v)} />
        <ReferenceLine
          y={LP1K_TARGET}
          stroke="#1F9D55"
          strokeDasharray="4 4"
          label={{ value: String(LP1K_TARGET), fill: "#1F9D55", fontSize: 11, position: "right" }}
        />
        <Line type="monotone" dataKey="leads_per_1k" name="Leads / $1k" stroke="#E8151B" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
