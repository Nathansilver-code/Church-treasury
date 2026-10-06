// Dates use the computer's local day (not UTC), so a receipt entered late in the evening gets the right date.
const pad = (n: number) => String(n).padStart(2, "0");

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthStartLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}
