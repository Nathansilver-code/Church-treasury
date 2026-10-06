// Date ranges for reports. All dates are local calendar days written as yyyy-mm-dd.
const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** The most recent Sabbath (Saturday): today if today is Saturday. */
export function lastSabbath(today: string): string {
  const d = parse(today);
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return iso(d);
}

export function monthRange(today: string, monthsBack = 0): { from: string; to: string } {
  const d = parse(today);
  const first = new Date(d.getFullYear(), d.getMonth() - monthsBack, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return { from: iso(first), to: iso(last) };
}

export function yearRange(today: string): { from: string; to: string } {
  const y = parse(today).getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export type PeriodKey = "sabbath" | "month" | "lastMonth" | "year" | "custom";

export function periodFor(key: Exclude<PeriodKey, "custom">, today: string): { from: string; to: string } {
  if (key === "sabbath") {
    const s = lastSabbath(today);
    return { from: s, to: s };
  }
  if (key === "month") return monthRange(today);
  if (key === "lastMonth") return monthRange(today, 1);
  return yearRange(today);
}
