import { useEffect, useState } from "react";
import { getSummary } from "../api";
import type { SummaryReport } from "../api";
import ExportButtons from "../components/ExportButtons";
import PeriodPicker from "../components/PeriodPicker";
import { PDF_MIME, XLSX_MIME, downloadFile, loadLogo, slug } from "../exports/common";
import { useSettings } from "../hooks/useSettings";
import { todayLocal } from "../lib/dates";
import { errorText } from "../lib/errors";
import { formatMoney } from "../lib/money";
import { lastSabbath } from "../lib/periods";

export default function Reports() {
  const sabbath = lastSabbath(todayLocal());
  const [from, setFrom] = useState(sabbath);
  const [to, setTo] = useState(sabbath);
  const [report, setReport] = useState<SummaryReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSettings();

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    getSummary(from, to)
      .then((r) => { if (!cancelled) { setReport(r); setError(null); } })
      .catch((e) => { if (!cancelled) setError(errorText(e)); });
    return () => { cancelled = true; };
  }, [from, to]);

  const name = `collections_${slug(from)}_to_${slug(to)}`;
  const trust = report?.funds.find((f) => f.fundId === 1)?.totalHundredths ?? 0;
  const local = report?.funds.find((f) => f.fundId === 2)?.totalHundredths ?? 0;
  const share = report && report.grandTotalHundredths > 0 ? (trust / report.grandTotalHundredths) * 100 : 50;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-brand">Reports</h1>
      <p className="mt-1 text-sm text-muted">Totals per item, per fund and overall. Pick one Sabbath, a month, a year or any dates.</p>

      <div className="mt-6">
        <PeriodPicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {error && <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>}

      {report && !error && (
        <>
          <div className="mt-6 rounded-lg border border-line bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-muted">{report.receiptCount} receipt{report.receiptCount === 1 ? "" : "s"} · {report.from === report.to ? report.from : `${report.from} to ${report.to}`}</p>
              <p className="num text-3xl font-semibold text-brand">{settings.currency} {formatMoney(report.grandTotalHundredths)}</p>
            </div>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-surface" role="img" aria-label={`Trust Fund ${formatMoney(trust)}, Local Fund ${formatMoney(local)}`}>
              <div className="bg-trust" style={{ width: `${share}%` }} />
              <div className="bg-local" style={{ width: `${100 - share}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border-l-4 border-trust bg-surface px-3 py-2"><p className="text-muted">Trust Fund</p><p className="num font-medium">{formatMoney(trust)}</p></div>
              <div className="rounded-md border-l-4 border-local bg-surface px-3 py-2"><p className="text-muted">Local Fund</p><p className="num font-medium">{formatMoney(local)}</p></div>
            </div>
          </div>

          <div className="mt-4">
            <ExportButtons
              disabled={report.receiptCount === 0}
              onPdf={async () => {
                const { buildReportPdf } = await import("../exports/reportExport");
                downloadFile(buildReportPdf(report, settings, await loadLogo()), `${name}.pdf`, PDF_MIME);
              }}
              onExcel={async () => {
                const { buildReportXlsx } = await import("../exports/reportExport");
                downloadFile(await buildReportXlsx(report, settings, await loadLogo()), `${name}.xlsx`, XLSX_MIME);
              }}
            />
          </div>

          {report.funds.every((f) => f.items.length === 0) ? (
            <p className="mt-6 rounded-lg border border-dashed border-line bg-white p-8 text-center text-muted">No money was recorded in this period.</p>
          ) : (
            <div className="mt-6 space-y-6">
              {report.funds.filter((f) => f.items.length > 0).map((fund) => (
                <section key={fund.fundId} className={"overflow-hidden rounded-lg border border-line bg-white border-l-4 " + (fund.fundId === 1 ? "border-l-trust" : "border-l-local")}>
                  <h2 className="bg-brand-tint px-4 py-2 font-semibold text-brand">{fund.fundName}</h2>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-line">
                      {fund.items.map((item) => (
                        <FragmentRows key={item.itemId} item={item} />
                      ))}
                      <tr className="bg-surface font-semibold">
                        <td className="px-4 py-2">{fund.fundName} total</td>
                        <td className="num px-4 py-2 text-right">{formatMoney(fund.totalHundredths)}</td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              ))}
              <p className="flex justify-between rounded-lg bg-brand px-4 py-3 font-semibold text-white">
                <span>Grand total</span>
                <span className="num">{formatMoney(report.grandTotalHundredths)}</span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FragmentRows({ item }: { item: SummaryReport["funds"][number]["items"][number] }) {
  return (
    <>
      <tr>
        <td className="px-4 py-2">{item.itemName}</td>
        <td className="num px-4 py-2 text-right">{formatMoney(item.totalHundredths)}</td>
      </tr>
      {item.subgroups.map((s) => (
        <tr key={`${item.itemId}-${s.subgroupId ?? "none"}`} className="text-muted">
          <td className="py-1.5 pl-10 pr-4">{s.name}</td>
          <td className="num px-4 py-1.5 text-right">{formatMoney(s.totalHundredths)}</td>
        </tr>
      ))}
    </>
  );
}
