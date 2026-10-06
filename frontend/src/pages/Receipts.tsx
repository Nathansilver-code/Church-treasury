import { useCallback, useEffect, useMemo, useState } from "react";
import { ArchiveRestore, Eye, FileText, Pencil, Search, Trash2 } from "lucide-react";
import { deleteReceipt, getCatalog, getReceipt, restoreReceipt, searchReceipts, updateReceipt } from "../api";
import type { Catalog, ReceiptDetail, ReceiptInput, ReceiptSummary } from "../api";
import ReceiptForm, { linesFromDetail } from "../components/ReceiptForm";
import { PDF_MIME, downloadFile, loadLogo } from "../exports/common";
import { useSettings } from "../hooks/useSettings";
import { monthStartLocal, todayLocal } from "../lib/dates";
import { errorText } from "../lib/errors";
import { formatMoney } from "../lib/money";


export default function Receipts() {
  const [from, setFrom] = useState(monthStartLocal());
  const [to, setTo] = useState(todayLocal());
  const [q, setQ] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [rows, setRows] = useState<ReceiptSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reason, setReason] = useState("");
  const [panelError, setPanelError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { settings } = useSettings();

  const refresh = useCallback(async () => {
    try {
      setRows(await searchReceipts({ from, to, q, includeDeleted }));
      setListError(null);
    } catch (e) {
      setListError(errorText(e));
    }
  }, [from, to, q, includeDeleted]);

  // Search as the filters change (a short pause while typing).
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 250);
    return () => clearTimeout(t);
  }, [refresh]);

  const shownTotal = useMemo(() => rows.filter((r) => !r.deleted).reduce((sum, r) => sum + r.totalHundredths, 0), [rows]);
  const activeCount = rows.filter((r) => !r.deleted).length;

  async function open(id: number) {
    setPanelError(null);
    setNotice(null);
    setConfirmingDelete(false);
    setReason("");
    setEditing(false);
    try {
      setDetail(await getReceipt(id));
    } catch (e) {
      setDetail(null);
      setPanelError(errorText(e));
    }
  }

  async function startEdit() {
    setPanelError(null);
    try {
      if (!catalog) setCatalog(await getCatalog());
      setEditing(true);
    } catch (e) {
      setPanelError(errorText(e));
    }
  }

  async function saveEdit(body: ReceiptInput) {
    if (!detail) return;
    const updated = await updateReceipt(detail.id, body);
    setDetail(updated);
    setEditing(false);
    setNotice(`Receipt ${updated.receiptNumber} was updated.`);
    void refresh();
  }

  async function runAction(action: () => Promise<ReceiptDetail>, message: (d: ReceiptDetail) => string) {
    setBusy(true);
    setPanelError(null);
    try {
      const updated = await action();
      setDetail(updated);
      setNotice(message(updated));
      setConfirmingDelete(false);
      setReason("");
      void refresh();
    } catch (e) {
      setPanelError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (editing && detail && catalog) {
    return (
      <ReceiptForm
        catalog={catalog}
        initial={{ number: String(detail.receiptNumber), date: detail.date, name: detail.personName, lines: linesFromDetail(detail.lines) }}
        title={`Edit receipt ${detail.receiptNumber}`}
        submitLabel="Save changes"
        onSubmit={saveEdit}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <h1 className="text-2xl font-semibold text-brand">Receipts</h1>

        <div className="mt-6 grid gap-4 sm:grid-cols-[170px_170px_1fr]">
          <label className="block text-sm font-medium">
            From
            <input className="field mt-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            To
            <input className="field mt-1" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Name or receipt number
            <span className="relative mt-1 block">
              <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="field pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
            </span>
          </label>
        </div>
        <label className="mt-3 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} className="h-4 w-4 accent-[#00504c]" />
          Show deleted receipts
        </label>

        {listError && <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">{listError}</p>}

        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-tint text-brand">
              <tr>
                <th className="px-4 py-2 font-semibold">No.</th>
                <th className="px-4 py-2 font-semibold">Date</th>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 text-right font-semibold">Total</th>
                <th className="px-4 py-2"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No receipts match these filters.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className={(detail?.id === r.id ? "bg-brand-tint/50 " : "") + (r.deleted ? "text-muted" : "")}>
                  <td className="num px-4 py-2">{r.receiptNumber}</td>
                  <td className="num px-4 py-2">{r.date}</td>
                  <td className="px-4 py-2">
                    {r.personName}
                    {r.deleted && <span className="ml-2 rounded bg-red-50 px-2 py-0.5 text-xs text-danger">Deleted</span>}
                  </td>
                  <td className={"num px-4 py-2 text-right " + (r.deleted ? "line-through" : "")}>{formatMoney(r.totalHundredths)}</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" onClick={() => void open(r.id)} aria-label={`Open receipt ${r.receiptNumber}`} className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 hover:border-brand hover:text-brand">
                      <Eye size={16} aria-hidden /> Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">
          {activeCount} receipt{activeCount === 1 ? "" : "s"}, total <span className="num font-medium text-ink">{formatMoney(shownTotal)}</span>
          {includeDeleted && " (deleted receipts are not counted)"}
        </p>
      </section>

      <aside aria-label="Receipt details" className="xl:sticky xl:top-8">
        {!detail && !panelError && (
          <div className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-muted">Open a receipt to see its items.</div>
        )}
        {panelError && <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">{panelError}</p>}
        {notice && <p role="status" className="mb-4 rounded-md bg-brand-tint px-4 py-3 text-sm text-brand">{notice}</p>}

        {detail && (
          <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
            <div className="h-1.5 bg-brand" />
            <div className="h-px bg-gold" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">Receipt {detail.receiptNumber}</p>
                  <p className="num text-sm text-muted">{detail.date}</p>
                </div>
                <img src="./logo.png" alt="" className="h-12 w-12" />
              </div>
              <p className="mt-4 text-sm text-muted">Received from</p>
              <p className="font-medium">{detail.personName}</p>

              {detail.deleted && (
                <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">
                  Deleted. Reason: {detail.deleteReason}
                </p>
              )}

              <ul className="mt-5 space-y-2 border-t border-dashed border-line pt-4">
                {detail.lines.map((l, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-4">
                    <span>
                      {l.itemName}
                      {l.subgroupName && `: ${l.subgroupName}`}
                      <span className="block text-xs text-muted">{l.fundName}</span>
                    </span>
                    <span className="num">{formatMoney(l.amountHundredths)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
                <span className="font-semibold">Total</span>
                <span className="num text-2xl font-semibold text-brand">{formatMoney(detail.totalHundredths)}</span>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {!detail.deleted && (
                  <>
                    <button type="button" onClick={() => void startEdit()} className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
                      <Pencil size={18} aria-hidden /> Edit
                    </button>
                    <button type="button" onClick={() => setConfirmingDelete(true)} className="inline-flex items-center gap-2 rounded-md border border-danger px-4 py-2 font-medium text-danger hover:bg-red-50">
                      <Trash2 size={18} aria-hidden /> Delete
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void (async () => {
                    try {
                      const { buildReceiptPdf } = await import("../exports/receiptPdf");
                      downloadFile(buildReceiptPdf(detail, settings, await loadLogo()), `receipt_${detail.receiptNumber}.pdf`, PDF_MIME);
                    } catch {
                      setPanelError("The PDF could not be made. Try again.");
                    }
                  })()}
                  className="inline-flex items-center gap-2 rounded-md border border-brand px-4 py-2 font-medium text-brand hover:bg-brand-tint"
                >
                  <FileText size={18} aria-hidden /> PDF
                </button>
                {detail.deleted && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction(() => restoreReceipt(detail.id), (d) => `Receipt ${d.receiptNumber} was restored.`)}
                    className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
                  >
                    <ArchiveRestore size={18} aria-hidden /> Restore
                  </button>
                )}
              </div>

              {confirmingDelete && !detail.deleted && (
                <div className="mt-5 rounded-md border border-danger/30 bg-red-50 p-4">
                  <label className="block text-sm font-medium" htmlFor="delete-reason">Why is this receipt being deleted?</label>
                  <textarea id="delete-reason" className="field mt-2" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: entered twice" />
                  <p className="mt-2 text-xs text-muted">The receipt stays in the history and can be restored later.</p>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      disabled={busy || reason.trim() === ""}
                      onClick={() => void runAction(() => deleteReceipt(detail.id, reason.trim()), (d) => `Receipt ${d.receiptNumber} was deleted.`)}
                      className="rounded-md bg-danger px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Delete receipt
                    </button>
                    <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-md border border-line bg-white px-4 py-2 font-medium hover:bg-surface">
                      Keep it
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
