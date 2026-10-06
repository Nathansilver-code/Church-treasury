import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { getCatalog, getPersonStatement } from "../api";
import type { Catalog, PersonStatement } from "../api";
import ExportButtons from "../components/ExportButtons";
import NameInput from "../components/NameInput";
import PeriodPicker from "../components/PeriodPicker";
import { PDF_MIME, XLSX_MIME, downloadFile, loadLogo, slug } from "../exports/common";
import { useSettings } from "../hooks/useSettings";
import { todayLocal } from "../lib/dates";
import { errorText } from "../lib/errors";
import { formatMoney } from "../lib/money";
import { monthRange } from "../lib/periods";

export default function Statements() {
  const month = monthRange(todayLocal());
  const [name, setName] = useState("");
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);
  const [item, setItem] = useState("");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [statement, setStatement] = useState<PersonStatement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { settings } = useSettings();

  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog(null));
  }, []);

  const itemLabel = item === "" ? "All items" : item === "offering" ? "Offering" : catalog?.items.find((i) => String(i.id) === item)?.name ?? "One item";

  async function show() {
    if (!name.trim()) {
      setError("Type the person's name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatement(await getPersonStatement(name.trim(), from, to, item));
    } catch (e) {
      setStatement(null);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const fileName = statement ? `statement_${slug(statement.personName)}_${slug(statement.from)}_to_${slug(statement.to)}` : "statement";

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-brand">Person statements</h1>
      <p className="mt-1 text-sm text-muted">What one person gave in a day, a month, a year or any period, in total and on each item.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="text-sm font-medium">
          <label htmlFor="statement-name">Name of person</label>
          <NameInput id="statement-name" value={name} onChange={setName} />
        </div>
        <label className="block text-sm font-medium">
          Item
          <select className="field mt-1" value={item} onChange={(e) => setItem(e.target.value)}>
            <option value="">All items</option>
            {catalog?.funds.map((f) => (
              <optgroup key={f.id} label={f.name}>
                {catalog.items.filter((i) => i.fundId === f.id && !i.systemKey).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </optgroup>
            ))}
            <optgroup label="Split between both funds"><option value="offering">Offering</option></optgroup>
          </select>
        </label>
      </div>
      <div className="mt-4">
        <PeriodPicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>
      <button type="button" disabled={busy} onClick={() => void show()} className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60">
        <Search size={18} aria-hidden /> {busy ? "Looking..." : "Show statement"}
      </button>

      {error && <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>}

      {statement && (
        <div className="mt-6">
          <div className="rounded-lg border border-line bg-white p-5">
            <p className="text-sm text-muted">{statement.personName} · {statement.from === statement.to ? statement.from : `${statement.from} to ${statement.to}`} · {itemLabel}</p>
            <p className="num mt-1 text-3xl font-semibold text-brand">{settings.currency} {formatMoney(statement.totalHundredths)}</p>
            {statement.byItem.length > 0 && (
              <ul className="mt-4 divide-y divide-line text-sm">
                {statement.byItem.map((i) => (
                  <li key={i.itemKey} className="flex justify-between py-1.5"><span>{i.itemName}</span><span className="num">{formatMoney(i.totalHundredths)}</span></li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4">
            <ExportButtons
              disabled={statement.receipts.length === 0}
              onPdf={async () => {
                const { buildStatementPdf } = await import("../exports/statementExport");
                downloadFile(buildStatementPdf(statement, settings, await loadLogo(), itemLabel), `${fileName}.pdf`, PDF_MIME);
              }}
              onExcel={async () => {
                const { buildStatementXlsx } = await import("../exports/statementExport");
                downloadFile(await buildStatementXlsx(statement, settings, await loadLogo(), itemLabel), `${fileName}.xlsx`, XLSX_MIME);
              }}
            />
          </div>

          {statement.receipts.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-line bg-white p-8 text-center text-muted">No receipts for this person in this period.</p>
          ) : (
            <ul className="mt-6 space-y-3">
              {statement.receipts.map((r) => (
                <li key={r.receiptId} className="rounded-lg border border-line bg-white p-4">
                  <div className="flex justify-between font-medium"><span>Receipt {r.receiptNumber} · <span className="num font-normal text-muted">{r.date}</span></span><span className="num">{formatMoney(r.totalHundredths)}</span></div>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {r.lines.map((l, i) => (
                      <li key={i} className="flex justify-between"><span>{l.subgroupName ? `${l.itemName}: ${l.subgroupName}` : l.itemName}</span><span className="num">{formatMoney(l.amountHundredths)}</span></li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
