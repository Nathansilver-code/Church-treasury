// Money is handled as whole hundredths (500.50 -> 50050), mirroring the Java backend.

/** Parses typed text like "1,001.50". Returns hundredths, or null if invalid. */
export function parseMoney(text: string): number | null {
  const t = text.trim().replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [whole, dec = ""] = t.split(".");
  const value = Number(whole) * 100 + Number(dec.padEnd(2, "0"));
  return Number.isSafeInteger(value) ? value : null;
}

/** Formats hundredths for display, e.g. 100100 -> "1,001.00". */
export function formatMoney(hundredths: number): string {
  const abs = Math.abs(hundredths);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  return `${hundredths < 0 ? "-" : ""}${whole}.${String(abs % 100).padStart(2, "0")}`;
}

/** 50/50 offering split. An odd hundredth goes to the Local Fund. */
export function splitOffering(hundredths: number): { trust: number; local: number } {
  const trust = Math.floor(hundredths / 2);
  return { trust, local: hundredths - trust };
}

/** Plain text for an input box, e.g. 100100 -> "1001.00", 50050 -> "500.50". */
export function toPlain(hundredths: number): string {
  const abs = Math.abs(hundredths);
  return `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
