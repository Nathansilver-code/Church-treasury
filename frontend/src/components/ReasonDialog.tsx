import { useEffect, useId, useRef, useState } from "react";

type Props = {
  title: string;
  message?: string;
  confirmLabel: string;
  error?: string | null;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

/** Asks why something is being deleted. The reason is saved in the history. */
export default function ReasonDialog({ title, message, confirmLabel, error, busy, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState("");
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 id={`${id}-t`} className="text-lg font-semibold">{title}</h2>
        {message && <p className="mt-1 text-sm text-muted">{message}</p>}
        <label htmlFor={id} className="mt-4 block text-sm font-medium">Reason</label>
        <textarea id={id} ref={ref} className="field mt-1" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: entered by mistake" />
        <p className="mt-2 text-xs text-muted">It stays in the history and can be restored later from the Deleted tab.</p>
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-md border border-line px-4 py-2 font-medium hover:bg-surface">Cancel</button>
          <button type="button" disabled={busy || reason.trim() === ""} onClick={() => onConfirm(reason.trim())} className="rounded-md bg-danger px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
