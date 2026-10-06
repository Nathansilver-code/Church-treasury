import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";

type Props = { disabled?: boolean; onPdf: () => Promise<void>; onExcel: () => Promise<void> };

/** PDF and Excel download buttons. Shows a message if making the file fails. */
export default function ExportButtons({ disabled, onPdf, onExcel }: Props) {
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "pdf" | "xlsx", fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch {
      setError("The file could not be made. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const btn = "inline-flex items-center gap-2 rounded-md border border-brand px-4 py-2 font-medium text-brand hover:bg-brand-tint disabled:opacity-50";
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={btn} disabled={disabled || busy !== null} onClick={() => void run("pdf", onPdf)}>
          <FileText size={18} aria-hidden /> {busy === "pdf" ? "Making PDF..." : "Download PDF"}
        </button>
        <button type="button" className={btn} disabled={disabled || busy !== null} onClick={() => void run("xlsx", onExcel)}>
          <FileSpreadsheet size={18} aria-hidden /> {busy === "xlsx" ? "Making Excel..." : "Download Excel"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
