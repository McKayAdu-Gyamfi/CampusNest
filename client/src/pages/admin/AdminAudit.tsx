import { useEffect, useState } from "react";
import { errorMessage, listAuditLog, type AuditEntry } from "@/lib/adminApi";
import { Chip, EmptyState, ErrorBanner, PageHeader, SearchBox, Spinner } from "@/components/admin/AdminUI";

const GROUPS = [["ALL", "Everything"], ["hostel", "Hostels"], ["user", "Users"], ["review", "Reviews"], ["school", "Schools"], ["settings", "Settings"]] as const;
const TONE: Record<string, "green" | "red" | "amber" | "blue" | "grey"> = { approved: "green", reactivated: "green", created: "green", rejected: "red", suspended: "red", removed: "red", deleted: "red" };
const toneFor = (action: string) => TONE[action.split(".")[1]?.split("_")[0] ?? ""] ?? "blue";

/** Who did what, newest first. Written by the server whenever an admin changes data. */
export default function AdminAudit() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<(typeof GROUPS)[number][0]>("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => { listAuditLog(300).then(setRows).catch((e) => setError(errorMessage(e))); }, []);

  const shown = (rows ?? []).filter((r) => {
    if (group !== "ALL" && !r.action.startsWith(group + ".")) return false;
    const q = query.trim().toLowerCase();
    return !q || [r.summary, r.actor?.name, r.actor?.email, r.action].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" subtitle="Every approval, suspension, removal and settings change." actions={<SearchBox value={query} onChange={setQuery} placeholder="Search action, admin…" />} />
      <ErrorBanner message={error} />
      <div className="flex gap-2 flex-wrap" role="group" aria-label="Type">
        {GROUPS.map(([id, label]) => (
          <button key={id} onClick={() => setGroup(id)} aria-pressed={group === id} className={`h-10 px-5 rounded-full text-[13px] font-bold cursor-pointer transition-colors ${group === id ? "bg-[#C56A30] text-white" : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"}`}>{label}</button>
        ))}
      </div>
      {!rows && !error && <Spinner />}
      {rows && shown.length === 0 && <EmptyState title="Nothing logged yet" text="Admin actions will appear here as they happen." />}
      {shown.length > 0 && (
        <ol className="bg-card border border-border/40 rounded-2xl shadow-sm divide-y divide-border/40 overflow-hidden">
          {shown.map((r) => (
            <li key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <time dateTime={r.created_at} className="text-[12px] font-medium text-muted-foreground w-44 shrink-0">{new Date(r.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
              <Chip tone={toneFor(r.action)}>{r.action}</Chip>
              <p className="flex-1 text-[14px] font-semibold text-foreground break-words">{r.summary}</p>
              <span className="text-[12px] font-bold text-muted-foreground shrink-0">{r.actor?.name || r.actor?.email || "Unknown admin"}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
