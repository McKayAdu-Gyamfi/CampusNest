import { useCallback, useEffect, useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { deleteReview, errorMessage, listAdminReviews, type AdminReview } from "@/lib/adminApi";
import { EmptyState, ErrorBanner, PageHeader, ReasonDialog, SearchBox, Spinner } from "@/components/admin/AdminUI";
import { useToast } from "@/components/ui/toaster";
import { timeAgo } from "@/lib/notificationIcon";

/** Review moderation: remove spam or abusive reviews. Removals are written to the audit log. */
export default function AdminReviews() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState<"ALL" | "LOW" | "HIGH">("ALL");
  const [target, setTarget] = useState<AdminReview | null>(null);

  const load = useCallback(() => {
    listAdminReviews().then((r) => { setRows(r.sort((a, b) => b.created_at.localeCompare(a.created_at))); setError(null); }).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  const shown = (rows ?? []).filter((r) => {
    if (rating === "LOW" && r.rating > 2) return false;
    if (rating === "HIGH" && r.rating < 4) return false;
    const q = query.trim().toLowerCase();
    return !q || [r.comment, r.USERS?.name, r.USERS?.email, r.HOSTEL?.hostel_name].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Reviews" subtitle={rows ? `${rows.length} reviews` : "Loading…"} actions={<SearchBox value={query} onChange={setQuery} placeholder="Search hostel, student, text…" />} />
      <ErrorBanner message={error} />
      <div className="flex gap-2" role="group" aria-label="Rating filter">
        {([["ALL", "All ratings"], ["LOW", "1–2 stars"], ["HIGH", "4–5 stars"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setRating(id)} aria-pressed={rating === id} className={`h-10 px-5 rounded-full text-[13px] font-bold cursor-pointer transition-colors ${rating === id ? "bg-[#C56A30] text-white" : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"}`}>{label}</button>
        ))}
      </div>
      {!rows && !error && <Spinner />}
      {rows && shown.length === 0 && <EmptyState title="No reviews match" />}
      <ul className="space-y-3 max-w-4xl">
        {shown.map((r) => (
          <li key={r.id} className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex" role="img" aria-label={`${r.rating} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-4 h-4 ${n <= r.rating ? "fill-[#E8A33D] text-[#E8A33D]" : "text-border"}`} />)}</span>
                <span className="font-extrabold text-[14px] text-foreground">{r.HOSTEL?.hostel_name ?? "Hostel"}</span>
                <span className="text-[12px] text-muted-foreground font-medium">{r.USERS?.name || r.USERS?.email || "Anonymous"} · {timeAgo(r.created_at)}</span>
              </div>
              <p className="text-[14px] font-medium text-foreground/80 mt-2 whitespace-pre-wrap break-words">{r.comment || <span className="text-muted-foreground italic">No comment</span>}</p>
            </div>
            <button onClick={() => setTarget(r)} aria-label="Remove review" className="w-10 h-10 rounded-full border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center shrink-0 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
          </li>
        ))}
      </ul>
      {target && (
        <ReasonDialog
          title="Remove this review?" description="It disappears from the hostel page and its rating. This can't be undone, but the removal is logged."
          confirmLabel="Remove review"
          onConfirm={async (reason) => { await deleteReview(target.id, reason || undefined); toast("Review removed."); load(); }}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}
