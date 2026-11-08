import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Search, X } from "lucide-react";

/** Page title row used by every admin page. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-2 border-b border-solid border-border/80">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted-foreground font-medium mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <label className="sr-only">{placeholder}</label>
      <input
        type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-11 pl-11 pr-4 bg-card border border-border/50 rounded-full text-[13px] font-medium outline-none focus:ring-2 focus:ring-[#C56A30] shadow-sm"
      />
    </div>
  );
}

export interface TabDef<T extends string> { id: T; label: string; count?: number }

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: TabDef<T>[]; active: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="flex items-center gap-6 border-b border-border/50 overflow-x-auto hide-scrollbar">
      {tabs.map((t) => (
        <button
          key={t.id} role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)}
          className={`pb-3 font-extrabold text-[14px] relative whitespace-nowrap transition-colors cursor-pointer ${active === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {t.label}
          {t.count !== undefined && <span className="text-muted-foreground font-semibold text-xs ml-1.5">{t.count}</span>}
          {active === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C56A30] rounded-full" />}
        </button>
      ))}
    </div>
  );
}

const TONES = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  grey: "bg-muted text-muted-foreground",
  brand: "bg-[#FAF0E6] text-[#C56A30] dark:bg-[#C56A30]/15",
} as const;

export function Chip({ tone = "grey", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="bg-card border border-border/40 rounded-2xl p-10 text-center shadow-sm">
      <p className="text-[15px] font-extrabold text-foreground">{title}</p>
      {text && <p className="text-[13px] font-medium text-muted-foreground mt-1">{text}</p>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return <div role="alert" className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm font-bold text-red-700 dark:text-red-300">{message}</div>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{label}</p>;
}

/** Accessible dialog: Escape and backdrop close it, focus moves in, and page scroll is locked. */
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={`bg-card text-card-foreground w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-md"} max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl outline-none`}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border/50">
          <h2 className="text-[18px] font-extrabold tracking-tight text-foreground">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-muted hover:bg-accent flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/** Asks for a short reason before a consequential action (reject, suspend, delete). */
export function ReasonDialog({
  title, description, confirmLabel, minLength = 0, required = false, tone = "danger", onConfirm, onClose,
}: {
  title: string; description: string; confirmLabel: string; minLength?: number; required?: boolean;
  tone?: "danger" | "brand"; onConfirm: (reason: string) => Promise<void>; onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = required && reason.trim().length < minLength;

  const submit = async () => {
    if (tooShort) { setError(`Write at least ${minLength} characters.`); return; }
    setBusy(true); setError(null);
    try { await onConfirm(reason.trim()); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); setBusy(false); }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-[14px] font-medium text-muted-foreground mb-4">{description}</p>
      <label htmlFor="reason" className="text-[12px] font-bold text-foreground block mb-1.5">Reason{required ? "" : " (optional)"}</label>
      <textarea
        id="reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-[14px] font-medium resize-none focus:outline-none focus:ring-2 focus:ring-[#C56A30]/40"
      />
      {error && <p role="alert" className="text-[12px] font-bold text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end gap-3 mt-5">
        <button onClick={onClose} disabled={busy} className="h-11 px-6 rounded-full border border-border font-bold text-sm cursor-pointer">Cancel</button>
        <button
          onClick={submit} disabled={busy}
          className={`h-11 px-6 rounded-full text-white font-bold text-sm flex items-center gap-2 disabled:opacity-60 cursor-pointer ${tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-[#C56A30] hover:bg-[#b05b26]"}`}
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}{confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/** Label above a value, used in the detail dialogs. */
export function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-[14px] font-semibold text-foreground mt-0.5 break-words">{value || "—"}</dd>
    </div>
  );
}

/** A yes/no confirmation for destructive actions that need no reason. */
export function ConfirmDialog({ title, description, confirmLabel, onConfirm, onClose }: {
  title: string; description: string; confirmLabel: string; onConfirm: () => Promise<void>; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setError(null);
    try { await onConfirm(); onClose(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-[14px] font-medium text-muted-foreground">{description}</p>
      {error && <p role="alert" className="text-[12px] font-bold text-red-600 mt-3">{error}</p>}
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} disabled={busy} className="h-11 px-6 rounded-full border border-border font-bold text-sm cursor-pointer">Cancel</button>
        <button onClick={go} disabled={busy} className="h-11 px-6 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-60 cursor-pointer">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}{confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
