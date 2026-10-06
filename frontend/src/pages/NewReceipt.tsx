import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { ApiError, createReceipt, getCatalog, getNextNumber, listReceipts } from "../api";
import type { Catalog, ReceiptInput, ReceiptSummary } from "../api";
import ReceiptForm, { blankLine } from "../components/ReceiptForm";
import type { FormValues } from "../components/ReceiptForm";
import { todayLocal } from "../lib/dates";
import { formatMoney } from "../lib/money";

export default function NewReceipt() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [initial, setInitial] = useState<FormValues | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listDate, setListDate] = useState(todayLocal());
  const [savedOnDate, setSavedOnDate] = useState<ReceiptSummary[]>([]);
  const [justSaved, setJustSaved] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [cat, next] = await Promise.all([getCatalog(), getNextNumber()]);
      setCatalog(cat);
      setInitial((cur) => cur ?? { number: String(next), date: todayLocal(), name: "", lines: [blankLine()] });
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Could not load the receipt form.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The list comes from the database, so it survives tab changes and restarts.
  const refreshList = useCallback(async (date: string) => {
    try {
      setSavedOnDate(await listReceipts(date));
    } catch {
      setSavedOnDate([]);
    }
  }, []);

  useEffect(() => {
    void refreshList(listDate);
  }, [listDate, refreshList]);

  async function save(body: ReceiptInput) {
    const saved = await createReceipt(body);
    setJustSaved(saved.receiptNumber);
    // next number is +1 (the treasurer can still change it); a fresh form replaces the old one
    setInitial({ number: String(saved.receiptNumber + 1), date: body.date, name: "", lines: [blankLine()] });
    setFormKey((k) => k + 1);
    if (body.date === listDate) void refreshList(body.date);
    else setListDate(body.date);
  }

  if (loadError) {
    return (
      <section className="max-w-xl">
        <h1 className="text-2xl font-semibold text-brand">New receipt</h1>
        <div role="alert" className="mt-6 rounded-lg border border-danger/30 bg-red-50 p-6">
          <p className="text-danger">{loadError}</p>
          <button type="button" onClick={() => void load()} className="mt-4 inline-flex items-center gap-2 rounded-md border border-brand px-4 py-2 font-medium text-brand hover:bg-brand-tint">
            <RefreshCw size={18} aria-hidden /> Try again
          </button>
        </div>
      </section>
    );
  }

  if (!catalog || !initial) return <p className="text-muted">Loading the receipt form...</p>;

  return (
    <ReceiptForm
      key={formKey}
      catalog={catalog}
      initial={initial}
      title="New receipt"
      submitLabel="Save receipt"
      onSubmit={save}
      onDateChange={setListDate}
      banner={
        justSaved !== null && (
          <p role="status" className="mt-4 flex items-center gap-2 rounded-md bg-brand-tint px-4 py-3 text-brand">
            <CheckCircle2 size={18} aria-hidden /> Receipt {justSaved} saved. The next number is {initial.number}.
          </p>
        )
      }
      aside={
        <div className="mt-6">
          <h2 className="text-sm font-semibold">Saved on {listDate}</h2>
          {savedOnDate.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No receipts saved for this date yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-white text-sm">
              {savedOnDate.map((s) => (
                <li key={s.id} className="flex justify-between gap-4 px-4 py-2">
                  <span>#{s.receiptNumber} {s.personName}</span>
                  <span className="num">{formatMoney(s.totalHundredths)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      }
    />
  );
}
