import { useCallback, useEffect, useState } from "react";
import { Check, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createItem, createSubgroup, deleteItem, deleteSubgroup, getAdminCatalog, renameItem, renameSubgroup,
} from "../api";
import type { AdminCatalog, FundAdmin, ItemAdmin, SubAdmin } from "../api";
import ReasonDialog from "../components/ReasonDialog";
import { errorText } from "../lib/errors";

type Deleting = { kind: "item" | "sub"; id: number; name: string } | null;

function InlineName({ initial, label, onSave, onCancel }: { initial: string; label: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSave(value.trim());
      }}
    >
      <input autoFocus aria-label={label} className="field py-1" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onCancel()} />
      <button type="submit" aria-label="Save name" className="grid h-9 w-9 place-items-center rounded-md bg-brand text-white hover:bg-brand-dark"><Check size={16} aria-hidden /></button>
      <button type="button" aria-label="Cancel" onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-md border border-line hover:bg-surface"><X size={16} aria-hidden /></button>
    </form>
  );
}

const iconBtn = "grid h-8 w-8 place-items-center rounded-md border border-line text-muted hover:border-brand hover:text-brand";

export default function Items() {
  const [data, setData] = useState<AdminCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [newFund, setNewFund] = useState("");
  const [renamingItem, setRenamingItem] = useState<number | null>(null);
  const [renamingSub, setRenamingSub] = useState<number | null>(null);
  const [addingSubTo, setAddingSubTo] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Deleting>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getAdminCatalog());
      setLoadError(null);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<AdminCatalog>, okText: string, onDone?: () => void) {
    setBusy(true);
    setMessage(null);
    try {
      setData(await action());
      setMessage({ kind: "ok", text: okText });
      onDone?.();
    } catch (e) {
      setMessage({ kind: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete(reason: string) {
    if (!deleting) return;
    setBusy(true);
    setDialogError(null);
    try {
      setData(deleting.kind === "item" ? await deleteItem(deleting.id, reason) : await deleteSubgroup(deleting.id, reason));
      setMessage({ kind: "ok", text: `"${deleting.name}" was deleted. You can restore it from the Deleted tab.` });
      setDeleting(null);
    } catch (e) {
      setDialogError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <section className="max-w-xl">
        <h1 className="text-2xl font-semibold text-brand">Items and sub-groups</h1>
        <p role="alert" className="mt-6 rounded-md border border-danger/30 bg-red-50 p-4 text-danger">{loadError}</p>
        <button type="button" onClick={() => void load()} className="mt-4 rounded-md border border-brand px-4 py-2 font-medium text-brand hover:bg-brand-tint">Try again</button>
      </section>
    );
  }
  if (!data) return <p className="text-muted">Loading...</p>;

  const renderSub = (s: SubAdmin) => (
    <li key={s.id} className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-1.5">
      {renamingSub === s.id ? (
        <InlineName
          initial={s.name}
          label="Sub-group name"
          onCancel={() => setRenamingSub(null)}
          onSave={(name) => void run(() => renameSubgroup(s.id, name), "Sub-group renamed.", () => setRenamingSub(null))}
        />
      ) : (
        <>
          <span>{s.name}</span>
          <span className="flex gap-1.5">
            <button type="button" className={iconBtn} aria-label={`Rename ${s.name}`} onClick={() => setRenamingSub(s.id)}><Pencil size={14} aria-hidden /></button>
            <button type="button" className={iconBtn + " hover:!border-danger hover:!text-danger"} aria-label={`Delete ${s.name}`} onClick={() => { setDialogError(null); setDeleting({ kind: "sub", id: s.id, name: s.name }); }}><Trash2 size={14} aria-hidden /></button>
          </span>
        </>
      )}
    </li>
  );

  const renderItem = (item: ItemAdmin) => (
    <li key={item.id} className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {renamingItem === item.id ? (
          <InlineName
            initial={item.name}
            label="Item name"
            onCancel={() => setRenamingItem(null)}
            onSave={(name) => void run(() => renameItem(item.id, name), "Item renamed.", () => setRenamingItem(null))}
          />
        ) : (
          <p className="font-medium">
            {item.name}
            {item.systemKey && (
              <span className="ml-2 inline-flex items-center gap-1 rounded bg-brand-tint px-2 py-0.5 text-xs font-normal text-brand">
                <Lock size={12} aria-hidden /> Built in (Offering split)
              </span>
            )}
          </p>
        )}
        {!item.systemKey && renamingItem !== item.id && (
          <span className="flex gap-1.5">
            <button type="button" className={iconBtn} aria-label={`Rename ${item.name}`} onClick={() => setRenamingItem(item.id)}><Pencil size={14} aria-hidden /></button>
            <button type="button" className={iconBtn + " hover:!border-danger hover:!text-danger"} aria-label={`Delete ${item.name}`} onClick={() => { setDialogError(null); setDeleting({ kind: "item", id: item.id, name: item.name }); }}><Trash2 size={14} aria-hidden /></button>
          </span>
        )}
      </div>

      {!item.systemKey && (
        <div className="mt-3">
          {item.subgroups.length > 0 && <ul className="mb-3 space-y-2">{item.subgroups.map(renderSub)}</ul>}
          {addingSubTo === item.id ? (
            <InlineName
              initial=""
              label={`New sub-group for ${item.name}`}
              onCancel={() => setAddingSubTo(null)}
              onSave={(name) => void run(() => createSubgroup(item.id, name), `Sub-group added to ${item.name}.`, () => setAddingSubTo(null))}
            />
          ) : (
            <button type="button" onClick={() => setAddingSubTo(item.id)} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
              <Plus size={16} aria-hidden /> Add sub-group
            </button>
          )}
        </div>
      )}
    </li>
  );

  const renderFund = (fund: FundAdmin, color: string) => (
    <section key={fund.id} className={"rounded-lg border-l-4 bg-white/0 pl-4 " + color}>
      <h2 className="text-lg font-semibold">{fund.name}</h2>
      <ul className="mt-3 space-y-3">{fund.items.map(renderItem)}</ul>
    </section>
  );

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-brand">Items and sub-groups</h1>
      <p className="mt-1 text-sm text-muted">
        The two funds are fixed. Add items to a fund, and sub-groups to an item (for example Lunch or Kanisa Ku Mutima).
        Deleting something only stops it being chosen on new receipts; past receipts and reports keep it.
      </p>

      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={"mt-4 rounded-md px-4 py-3 text-sm " + (message.kind === "error" ? "border border-danger/30 bg-red-50 text-danger" : "bg-brand-tint text-brand")}>
          {message.text}
        </p>
      )}

      <form
        className="mt-6 grid items-end gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-[1fr_180px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim() || !newFund) {
            setMessage({ kind: "error", text: "Type the item name and choose its fund." });
            return;
          }
          void run(() => createItem(newName.trim(), Number(newFund)), `"${newName.trim()}" was added.`, () => setNewName(""));
        }}
      >
        <label className="block text-sm font-medium">
          New item
          <input className="field mt-1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name of the item" />
        </label>
        <label className="block text-sm font-medium">
          Fund
          <select className="field mt-1" value={newFund} onChange={(e) => setNewFund(e.target.value)}>
            <option value="">Choose a fund</option>
            {data.funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-5 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60">
          <Plus size={18} aria-hidden /> Add item
        </button>
      </form>

      <div className="mt-8 space-y-8">
        {data.funds.map((f, i) => renderFund(f, i === 0 ? "border-trust" : "border-local"))}
      </div>

      {deleting && (
        <ReasonDialog
          title={`Delete "${deleting.name}"?`}
          message={deleting.kind === "item" ? "It will no longer appear when entering receipts. Past receipts are not changed." : "It will no longer appear when entering receipts. Past receipts are not changed."}
          confirmLabel="Delete"
          busy={busy}
          error={dialogError}
          onConfirm={(r) => void confirmDelete(r)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
