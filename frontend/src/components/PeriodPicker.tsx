import { useState } from "react";
import { periodFor } from "../lib/periods";
import type { PeriodKey } from "../lib/periods";
import { todayLocal } from "../lib/dates";

type Props = { from: string; to: string; onChange: (from: string, to: string) => void };

const PRESETS: { key: Exclude<PeriodKey, "custom">; label: string }[] = [
  { key: "sabbath", label: "Last Sabbath" },
  { key: "month", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "year", label: "This year" },
];

/** Quick periods (Sabbath, month, year) plus any custom dates. */
export default function PeriodPicker({ from, to, onChange }: Props) {
  const [active, setActive] = useState<PeriodKey>("custom");

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick periods">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={active === p.key}
            onClick={() => {
              const r = periodFor(p.key, todayLocal());
              setActive(p.key);
              onChange(r.from, r.to);
            }}
            className={"rounded-full border px-4 py-1.5 text-sm font-medium " + (active === p.key ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand hover:text-brand")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-[170px_170px]">
        <label className="block text-sm font-medium">
          From
          <input className="field mt-1" type="date" value={from} onChange={(e) => { setActive("custom"); onChange(e.target.value, to); }} />
        </label>
        <label className="block text-sm font-medium">
          To
          <input className="field mt-1" type="date" value={to} onChange={(e) => { setActive("custom"); onChange(from, e.target.value); }} />
        </label>
      </div>
    </div>
  );
}
