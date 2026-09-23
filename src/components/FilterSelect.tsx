"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** A <select> bound to one URL search param. Empty value removes the param. */
export default function FilterSelect({
  param,
  value,
  options,
}: {
  param: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  return (
    <select
      value={value}
      onChange={(e) => {
        const params = new URLSearchParams(search.toString());
        if (e.target.value) params.set(param, e.target.value);
        else params.delete(param);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      }}
      className="rounded-lg border bg-card px-3 py-2 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
