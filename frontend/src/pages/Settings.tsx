import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { saveSettings } from "../api";
import type { Settings as SettingsData } from "../api";
import { emptySettings, useSettings } from "../hooks/useSettings";
import { errorText } from "../lib/errors";

export default function Settings() {
  const { settings, loaded } = useSettings();
  const [form, setForm] = useState<SettingsData>(emptySettings);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loaded) setForm(settings);
  }, [loaded, settings]);

  const set = (k: keyof SettingsData) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      setForm(await saveSettings(form));
      setMessage({ kind: "ok", text: "Settings saved. They now appear on receipts and reports." });
    } catch (e) {
      setMessage({ kind: "error", text: errorText(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-brand">Settings</h1>
      <p className="mt-1 text-sm text-muted">These details are printed at the top of receipts, reports and statements (PDF and Excel).</p>

      <div className="mt-6 space-y-4 rounded-lg border border-line bg-white p-6">
        <label className="block text-sm font-medium">
          Church name
          <input className="field mt-1" maxLength={120} value={form.churchName} onChange={set("churchName")} placeholder="The name to print on every report" />
        </label>
        <label className="block text-sm font-medium">
          Address or location <span className="font-normal text-muted">(optional)</span>
          <input className="field mt-1" maxLength={160} value={form.address} onChange={set("address")} />
        </label>
        <label className="block text-sm font-medium">
          Treasurer's name <span className="font-normal text-muted">(optional, printed above a signature line)</span>
          <input className="field mt-1" maxLength={80} value={form.treasurerName} onChange={set("treasurerName")} />
        </label>
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <label className="block text-sm font-medium">
            Currency
            <input className="field mt-1 uppercase" maxLength={8} value={form.currency} onChange={set("currency")} />
          </label>
          <label className="block text-sm font-medium">
            Note at the bottom of receipts <span className="font-normal text-muted">(optional)</span>
            <input className="field mt-1" maxLength={200} value={form.receiptFooter} onChange={set("receiptFooter")} placeholder="For example: Thank you for giving" />
          </label>
        </div>

        {message && (
          <p role={message.kind === "error" ? "alert" : "status"} className={"rounded-md px-4 py-3 text-sm " + (message.kind === "error" ? "border border-danger/30 bg-red-50 text-danger" : "bg-brand-tint text-brand")}>
            {message.text}
          </p>
        )}
        <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60">
          <Save size={18} aria-hidden /> {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
}
