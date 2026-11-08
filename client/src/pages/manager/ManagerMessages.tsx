import { useCallback, useEffect, useState } from "react";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { useToast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/adminApi";
import { answerComplaint, fetchComplaints, STATUS_LABEL, type Complaint, type ComplaintStatus } from "@/lib/complaints";
import { timeAgo } from "@/lib/notificationIcon";
import { MessageCircleQuestion, TriangleAlert, Loader2, Inbox } from "lucide-react";

const FILTERS: { id: "ACTIVE" | "RESOLVED" | "ALL"; label: string }[] = [
  { id: "ACTIVE", label: "Needs attention" }, { id: "RESOLVED", label: "Resolved" }, { id: "ALL", label: "All" },
];
const statusCls: Record<ComplaintStatus, string> = {
  OPEN: "bg-amber-100 text-amber-800", IN_PROGRESS: "bg-blue-100 text-blue-800", RESOLVED: "bg-emerald-100 text-emerald-800",
};

function MessageCard({ c, onChanged }: { c: Complaint; onChanged: () => void }) {
  const { toast } = useToast();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const isEnquiry = c.kind === "ENQUIRY";
  const Icon = isEnquiry ? MessageCircleQuestion : TriangleAlert;

  const act = async (patch: { reply?: string; status?: ComplaintStatus }, done: string) => {
    setBusy(true);
    try {
      await answerComplaint(c.id, patch);
      setReply("");
      toast(done);
      onChanged();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isEnquiry ? "bg-[#F1E8DC] text-[#A84A1A]" : "bg-red-50 text-red-600"}`}><Icon className="w-5 h-5" /></span>
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold text-[#463C38] truncate">{c.subject || (isEnquiry ? "Enquiry" : "Complaint")}</p>
            <p className="text-[12px] font-medium text-[#8C8279]">{c.USERS?.name || c.USERS?.email} · {c.HOSTEL?.hostel_name} · {timeAgo(c.created_at)}</p>
          </div>
        </div>
        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${statusCls[c.status]}`}>{STATUS_LABEL[c.status]}</span>
      </div>

      <p className="text-[14px] font-medium text-[#5C4538] mt-3 whitespace-pre-wrap break-words">{c.content}</p>

      {c.reply && (
        <div className="mt-3 rounded-xl bg-[#F8F6F3] p-3">
          <p className="text-[11px] font-extrabold text-[#A84A1A] mb-1">Your reply{c.replied_at ? ` · ${timeAgo(c.replied_at)}` : ""}</p>
          <p className="text-[13px] font-medium text-[#463C38] whitespace-pre-wrap break-words">{c.reply}</p>
        </div>
      )}

      {c.status !== "RESOLVED" && (
        <div className="mt-4 space-y-3">
          <label className="sr-only" htmlFor={`reply-${c.id}`}>Reply</label>
          <textarea
            id={`reply-${c.id}`} value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={2000}
            placeholder="Write a reply to the student…"
            className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] text-[14px] font-medium resize-none focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/30"
          />
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy || !reply.trim()} onClick={() => act({ reply: reply.trim(), status: "RESOLVED" }, "Reply sent. Marked resolved.")}
              className="h-10 px-5 rounded-full bg-[#A84A1A] hover:bg-[#8F3E15] disabled:opacity-50 text-white font-bold text-[13px] flex items-center gap-2 cursor-pointer"
            >{busy && <Loader2 className="w-4 h-4 animate-spin" />}Reply &amp; resolve</button>
            <button
              disabled={busy || !reply.trim()} onClick={() => act({ reply: reply.trim(), status: "IN_PROGRESS" }, "Reply sent.")}
              className="h-10 px-5 rounded-full border border-[#E5E0D8] bg-white hover:bg-[#F8F6F3] disabled:opacity-50 text-[#5C4538] font-bold text-[13px] cursor-pointer"
            >Reply, keep open</button>
            {c.status === "OPEN" && (
              <button
                disabled={busy} onClick={() => act({ status: "IN_PROGRESS" }, "Marked in progress.")}
                className="h-10 px-5 rounded-full text-[#A84A1A] hover:bg-[#F1E8DC]/60 font-bold text-[13px] cursor-pointer"
              >Mark in progress</button>
            )}
            <button
              disabled={busy} onClick={() => act({ status: "RESOLVED" }, "Marked resolved.")}
              className="h-10 px-5 rounded-full text-[#8C8279] hover:bg-[#F1E8DC]/60 font-bold text-[13px] cursor-pointer"
            >Resolve without reply</button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function ManagerMessages() {
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("ACTIVE");

  const load = useCallback(() => {
    fetchComplaints().then((rows) => { setItems(rows.sort((a, b) => b.created_at.localeCompare(a.created_at))); setError(null); })
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    const poll = setInterval(load, 15000);
    return () => { clearTimeout(t); clearInterval(poll); };
  }, [load]);

  const shown = (items ?? []).filter((c) => filter === "ALL" || (filter === "RESOLVED" ? c.status === "RESOLVED" : c.status !== "RESOLVED"));
  const active = (items ?? []).filter((c) => c.status !== "RESOLVED").length;

  return (
    <div className="flex flex-col min-h-screen pb-6 lg:pb-12 bg-[#F0EFEA]">
      <div className="px-5 lg:px-8 pt-10 pb-6 sticky top-0 bg-[#F0EFEA]/90 backdrop-blur-md z-40 flex items-center justify-between border-b border-solid border-[#E5D0BA]/50 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-[#463C38]">Enquiries &amp; complaints</h1>
          <p className="text-[13px] font-medium text-[#8C8279] mt-0.5">{active} need{active === 1 ? "s" : ""} your attention</p>
        </div>
        <NotificationsDropdown />
      </div>

      <div className="px-5 lg:px-8 w-full max-w-4xl">
        <div role="tablist" className="inline-flex p-1 bg-white rounded-full shadow-sm mb-6">
          {FILTERS.map((f) => (
            <button
              key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
              className={`h-10 px-5 rounded-full text-[13px] font-bold transition-colors cursor-pointer ${filter === f.id ? "bg-[#A84A1A] text-white" : "text-[#8C8279] hover:text-[#463C38]"}`}
            >{f.label}</button>
          ))}
        </div>

        {error && <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm font-bold text-red-700 mb-4">{error}</div>}
        {!items && !error && <p className="text-sm font-medium text-[#8C8279]">Loading…</p>}
        {items && shown.length === 0 && (
          <div className="bg-white rounded-2xl p-10 flex flex-col items-center text-center shadow-sm">
            <Inbox className="w-10 h-10 text-[#C8B09A] mb-3" />
            <p className="text-[15px] font-extrabold text-[#463C38]">{filter === "ACTIVE" ? "You're all caught up" : "Nothing here yet"}</p>
            <p className="text-[13px] font-medium text-[#8C8279] mt-1">Questions and complaints from your residents will show up here.</p>
          </div>
        )}
        <ul className="space-y-4">{shown.map((c) => <MessageCard key={c.id} c={c} onChanged={load} />)}</ul>
      </div>
    </div>
  );
}
