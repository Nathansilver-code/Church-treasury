import { useCallback, useEffect, useState } from "react";
import { ArchiveRestore, ShieldCheck, ShieldAlert } from "lucide-react";
import { getDeleted, restoreItem, restoreReceipt, restoreSubgroup, searchAudit, verifyAudit } from "../api";
import type { AuditCheck, AuditEntry, DeletedEntry } from "../api";
import { errorText } from "../lib/errors";

const ACTIONS = ["CREATE", "UPDATE", "DELETE", "RESTORE"];
const when = (iso: string) => iso.replace("T", " ").slice(0, 19);

function AuditTab() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<AuditCheck | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      searchAudit({ from, to, action, q })
        .then((r) => { setRows(r); setError(null); })
        .catch((e) => setError(errorText(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [from, to, action, q]);

  async function runCheck() {
    setChecking(true);
    try {
      setCheck(await verifyAudit());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-[160px_160px_160px_1fr]">
        <label className="block text-sm font-medium">From<input className="field mt-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="block text-sm font-medium">To<input className="field mt-1" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="block text-sm font-medium">Action
          <select className="field mt-1" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a.charAt(0) + a.slice(1).toLowerCase()}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">Search<input className="field mt-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Words in the details or reason" /></label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={checking} onClick={() => void runCheck()} className="inline-flex items-center gap-2 rounded-md border border-brand px-4 py-2 font-medium text-brand hover:bg-brand-tint disabled:opacity-60">
          <ShieldCheck size={18} aria-hidden /> {checking ? "Checking..." : "Check the log is untouched"}
        </button>
        {check && check.ok && (
          <p role="status" className="inline-flex items-center gap-2 text-sm text-ok"><ShieldCheck size={18} aria-hidden /> All {check.entries} entries are intact.</p>
        )}
        {check && !check.ok && (
          <p role="alert" className="inline-flex items-center gap-2 text-sm text-danger"><ShieldAlert size={18} aria-hidden /> Problem at entry {check.brokenAtId}: {check.problem}</p>
        )}
      </div>

      {error && <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-tint text-brand">
            <tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">What</th><th className="px-4 py-2">Details</th></tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Nothing matches these filters.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="num whitespace-nowrap px-4 py-2">{when(r.ts)}</td>
                <td className="px-4 py-2 font-medium">{r.action}</td>
                <td className="px-4 py-2">{r.entityType}{r.entityId != null ? ` #${r.entityId}` : ""}</td>
                <td className="px-4 py-2">
                  {r.oldValue && <p className="text-muted">Before: {r.oldValue}</p>}
                  {r.newValue && <p>{r.oldValue ? "After: " : ""}{r.newValue}</p>}
                  {r.reason && <p className="text-muted">Reason: {r.reason}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Showing the newest 500 matching entries. The log can be read here but never changed.</p>
    </div>
  );
}

function DeletedTab() {
  const [rows, setRows] = useState<DeletedEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await getDeleted());
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(e: DeletedEntry) {
    const key = `${e.type}-${e.id}`;
    setBusyId(key);
    setError(null);
    setNotice(null);
    try {
      if (e.type === "receipt") await restoreReceipt(e.id);
      else if (e.type === "item") await restoreItem(e.id);
      else await restoreSubgroup(e.id);
      setNotice(`Restored: ${e.label}`);
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {notice && <p role="status" className="mb-4 rounded-md bg-brand-tint px-4 py-3 text-sm text-brand">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-muted">Nothing has been deleted.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {rows.map((r) => (
            <li key={`${r.type}-${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">{r.label}</p>
                <p className="text-sm text-muted">Deleted {when(r.deletedAt)}. Reason: {r.reason}</p>
              </div>
              <button type="button" disabled={busyId === `${r.type}-${r.id}`} onClick={() => void restore(r)} className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60">
                <ArchiveRestore size={16} aria-hidden /> Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AuditLog() {
  const [tab, setTab] = useState<"audit" | "deleted">("audit");
  const tabBtn = (key: "audit" | "deleted", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => setTab(key)}
      className={"border-b-2 px-4 py-2 font-medium " + (tab === key ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink")}
    >
      {label}
    </button>
  );
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-brand">Audit log and deleted</h1>
      <div role="tablist" className="mt-4 flex gap-2 border-b border-line">
        {tabBtn("audit", "Audit log")}
        {tabBtn("deleted", "Deleted")}
      </div>
      <div className="mt-6">{tab === "audit" ? <AuditTab /> : <DeletedTab />}</div>
    </div>
  );
}
