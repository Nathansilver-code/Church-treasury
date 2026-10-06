import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { ApiError } from "../api";
import type { Catalog, LineView, ReceiptInput } from "../api";
import { formatMoney, parseMoney, splitOffering, toPlain } from "../lib/money";
import { useSettings } from "../hooks/useSettings";
import NameInput from "./NameInput";

export const OFFERING = "offering"; // virtual choice: entered once, split between the two funds
const TRUST_FUND_ID = 1;

export type FormLine = { id: number; itemKey: string; subgroupId: string; amount: string };
export type FormValues = { number: string; date: string; name: string; lines: FormLine[] };

let lineCounter = 1;
export const blankLine = (): FormLine => ({ id: lineCounter++, itemKey: "", subgroupId: "", amount: "" });

/** Turns a saved receipt's lines back into form lines, so it can be edited. */
export function linesFromDetail(lines: LineView[]): FormLine[] {
  return lines.map((l) => ({
    id: lineCounter++,
    itemKey: l.offering ? OFFERING : String(l.itemId),
    subgroupId: l.subgroupId ? String(l.subgroupId) : "",
    amount: toPlain(l.amountHundredths),
  }));
}

type Props = {
  catalog: Catalog;
  initial: FormValues;
  title: string;
  submitLabel: string;
  onSubmit: (body: ReceiptInput) => Promise<void>;
  onDateChange?: (date: string) => void;
  onCancel?: () => void;
  banner?: ReactNode;
  aside?: ReactNode;
};

export default function ReceiptForm({ catalog, initial, title, submitLabel, onSubmit, onDateChange, onCancel, banner, aside }: Props) {
  const [number, setNumber] = useState(initial.number);
  const [date, setDate] = useState(initial.date);
  const [name, setName] = useState(initial.name);
  const [lines, setLines] = useState<FormLine[]>(initial.lines);
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { settings } = useSettings();

  const items = catalog.items;
  const pickable = items.filter((i) => !i.systemKey);
  const numberValue = Number.parseInt(number, 10);

  // Everything on the preview is calculated from the lines, never typed in.
  const slip = useMemo(() => {
    let trust = 0;
    let local = 0;
    const rows: { key: number; label: string; amount: number; note?: string }[] = [];
    for (const l of lines) {
      const amount = parseMoney(l.amount);
      if (!l.itemKey || amount === null || amount <= 0) continue;
      if (l.itemKey === OFFERING) {
        const s = splitOffering(amount);
        trust += s.trust;
        local += s.local;
        rows.push({ key: l.id, label: "Offering", amount, note: `${formatMoney(s.trust)} Trust, ${formatMoney(s.local)} Local` });
        continue;
      }
      const item = items.find((i) => i.id === Number(l.itemKey));
      if (!item) continue;
      const sub = item.subgroups.find((s) => s.id === Number(l.subgroupId));
      if (item.fundId === TRUST_FUND_ID) trust += amount;
      else local += amount;
      rows.push({ key: l.id, label: sub ? `${item.name}: ${sub.name}` : item.name, amount });
    }
    return { rows, trust, local, total: trust + local };
  }, [lines, items]);

  const update = (id: number, patch: Partial<FormLine>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  async function submit() {
    const found: string[] = [];
    if (!name.trim()) found.push("Enter the person's name.");
    if (!Number.isInteger(numberValue) || numberValue < 1) found.push("Enter a valid receipt number.");
    const filled = lines.filter((l) => l.itemKey || l.amount.trim());
    if (filled.length === 0) found.push("Add at least one item with an amount.");
    for (const l of filled) {
      const item = items.find((i) => i.id === Number(l.itemKey));
      const label = l.itemKey === OFFERING ? "Offering" : item?.name ?? "A line";
      if (!l.itemKey) found.push("Choose an item for every line that has an amount.");
      else if ((parseMoney(l.amount) ?? 0) <= 0) found.push(`${label}: enter an amount greater than zero, with up to two decimals.`);
      else if (item && item.subgroups.length > 0 && !l.subgroupId) found.push(`${label}: choose a sub-group.`);
    }
    setProblems([...new Set(found)]);
    if (found.length > 0) return;

    setSaving(true);
    try {
      await onSubmit({
        receiptNumber: numberValue,
        date,
        personName: name.trim(),
        lines: filled.map((l) => ({
          itemId: l.itemKey === OFFERING ? null : Number(l.itemKey),
          offering: l.itemKey === OFFERING,
          subgroupId: l.subgroupId ? Number(l.subgroupId) : null,
          amount: l.amount.trim(),
        })),
      });
    } catch (e) {
      setProblems([e instanceof ApiError ? e.message : "The receipt could not be saved."]);
      setSaving(false);
    }
  }

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <h1 className="text-2xl font-semibold text-brand">{title}</h1>
        {banner}

        <div className="mt-6 grid gap-4 sm:grid-cols-[140px_180px_1fr]">
          <label className="block text-sm font-medium">
            Receipt number
            <input className="field num mt-1" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Date
            <input
              className="field mt-1"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                onDateChange?.(e.target.value);
              }}
            />
          </label>
          <div className="text-sm font-medium">
            <label htmlFor="person-name">Name of person</label>
            <NameInput id="person-name" value={name} onChange={setName} />
          </div>
        </div>

        <h2 className="mt-8 text-lg font-semibold">What was paid</h2>
        <div className="mt-3 space-y-3">
          {lines.map((l) => {
            const item = items.find((i) => i.id === Number(l.itemKey));
            return (
              <div key={l.id} className="grid items-end gap-3 rounded-lg border border-line bg-white p-3 sm:grid-cols-[1fr_auto_44px]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    Item
                    <select className="field mt-1" value={l.itemKey} onChange={(e) => update(l.id, { itemKey: e.target.value, subgroupId: "" })}>
                      <option value="">Choose an item</option>
                      {catalog.funds.map((f) => (
                        <optgroup key={f.id} label={f.name}>
                          {pickable.filter((i) => i.fundId === f.id).map((i) => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))}
                        </optgroup>
                      ))}
                      <optgroup label="Split between both funds">
                        <option value={OFFERING}>Offering (50% Trust, 50% Local)</option>
                      </optgroup>
                    </select>
                  </label>
                  {item && item.subgroups.length > 0 && (
                    <label className="block text-sm font-medium">
                      Sub-group
                      <select className="field mt-1" value={l.subgroupId} onChange={(e) => update(l.id, { subgroupId: e.target.value })}>
                        <option value="">Choose a sub-group</option>
                        {item.subgroups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                <label className="block text-sm font-medium sm:w-40">
                  Amount
                  <input className="field num mt-1 text-right" inputMode="decimal" value={l.amount} onChange={(e) => update(l.id, { amount: e.target.value })} placeholder="0.00" />
                </label>
                <button
                  type="button"
                  aria-label="Remove this line"
                  disabled={lines.length === 1}
                  onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}
                  className="grid h-[42px] w-[44px] place-items-center rounded-md border border-line text-muted hover:border-danger hover:text-danger disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => setLines((ls) => [...ls, blankLine()])} className="inline-flex items-center gap-2 rounded-md border border-brand px-4 py-2 font-medium text-brand hover:bg-brand-tint">
            <Plus size={18} aria-hidden /> Add another item
          </button>
          <button type="button" disabled={saving} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60">
            <Save size={18} aria-hidden /> {saving ? "Saving..." : submitLabel}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 font-medium hover:bg-surface">
              <X size={18} aria-hidden /> Cancel
            </button>
          )}
        </div>

        {problems.length > 0 && (
          <ul role="alert" className="mt-4 list-disc space-y-1 rounded-md border border-danger/30 bg-red-50 py-3 pl-8 pr-4 text-sm text-danger">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </section>

      <aside aria-label="Receipt preview" className="xl:sticky xl:top-8">
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
          <div className="h-1.5 bg-brand" />
          <div className="h-px bg-gold" />
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted">{settings.churchName || "Church name (set in Settings)"}</p>
                <p className="mt-1 font-semibold">Receipt {Number.isInteger(numberValue) ? numberValue : ""}</p>
                <p className="num text-sm text-muted">{date}</p>
              </div>
              <img src="./logo.png" alt="" className="h-14 w-14" />
            </div>
            <p className="mt-4 text-sm text-muted">Received from</p>
            <p className="font-medium">{name.trim() || "Name of person"}</p>

            <div className="mt-5 border-t border-dashed border-line pt-4">
              {slip.rows.length === 0 ? (
                <p className="text-sm text-muted">Items appear here as you add amounts. Items with no money are left out.</p>
              ) : (
                <ul className="space-y-2">
                  {slip.rows.map((r) => (
                    <li key={r.key} className="flex items-baseline justify-between gap-4">
                      <span>
                        {r.label}
                        {r.note && <span className="block text-xs text-muted">{r.note}</span>}
                      </span>
                      <span className="num">{formatMoney(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
              <span className="font-semibold">Total</span>
              <span className="num text-2xl font-semibold text-brand">{formatMoney(slip.total)}</span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border-l-4 border-trust bg-surface px-3 py-2">
                <dt className="text-muted">Trust Fund</dt>
                <dd className="num font-medium">{formatMoney(slip.trust)}</dd>
              </div>
              <div className="rounded-md border-l-4 border-local bg-surface px-3 py-2">
                <dt className="text-muted">Local Fund</dt>
                <dd className="num font-medium">{formatMoney(slip.local)}</dd>
              </div>
            </dl>
          </div>
        </div>
        {aside}
      </aside>
    </div>
  );
}
