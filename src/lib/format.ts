// Same formatting rules as the reference dashboard.

export function money(v: number | null | undefined) {
  if (v == null || isNaN(v)) return "$0";
  return "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function num(v: number | null | undefined) {
  if (v == null || isNaN(v)) return "0";
  return Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function dec(v: number | null | undefined, digits = 2) {
  if (v == null || isNaN(v)) return "0";
  return Number(v).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// Leads per $1,000 at or above this is "good" (green), below is red.
export const LP1K_TARGET = 20;
