import { useState } from "react";
import { MessageCircleQuestion, TriangleAlert, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/adminApi";
import { answerComplaint, STATUS_LABEL, type Complaint, type ComplaintStatus } from "@/lib/complaints";
import { timeAgo } from "@/lib/notificationIcon";

const statusCls: Record<ComplaintStatus, string> = {
  OPEN: "bg-amber-100 text-amber-800", IN_PROGRESS: "bg-blue-100 text-blue-800", RESOLVED: "bg-emerald-100 text-emerald-800",
};

/** One enquiry or complaint with its reply box and status buttons. Used by the manager and admin inboxes. */
export default function MessageCard({ c, onChanged }: { c: Complaint; onChanged: () => void }) {
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
    <li className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isEnquiry ? "bg-[#F1E8DC] text-[#A84A1A]" : "bg-red-50 text-red-600"}`}><Icon className="w-5 h-5" /></span>
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold text-[#463C38] dark:text-foreground truncate">{c.subject || (isEnquiry ? "Enquiry" : "Complaint")}</p>
            <p className="text-[12px] font-medium text-[#8C8279] dark:text-muted-foreground">{c.USERS?.name || c.USERS?.email} · {c.HOSTEL?.hostel_name} · {timeAgo(c.created_at)}</p>
          </div>
        </div>
        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${statusCls[c.status]}`}>{STATUS_LABEL[c.status]}</span>
      </div>

      <p className="text-[14px] font-medium text-[#5C4538] dark:text-foreground/90 mt-3 whitespace-pre-wrap break-words">{c.content}</p>

      {c.reply && (
        <div className="mt-3 rounded-xl bg-[#F8F6F3] dark:bg-muted p-3">
          <p className="text-[11px] font-extrabold text-[#A84A1A] mb-1">Your reply{c.replied_at ? ` · ${timeAgo(c.replied_at)}` : ""}</p>
          <p className="text-[13px] font-medium text-[#463C38] dark:text-foreground whitespace-pre-wrap break-words">{c.reply}</p>
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
              className="h-10 px-5 rounded-full border border-[#E5E0D8] bg-card hover:bg-accent disabled:opacity-50 text-[#5C4538] dark:text-foreground/90 font-bold text-[13px] cursor-pointer"
            >Reply, keep open</button>
            {c.status === "OPEN" && (
              <button
                disabled={busy} onClick={() => act({ status: "IN_PROGRESS" }, "Marked in progress.")}
                className="h-10 px-5 rounded-full text-[#A84A1A] hover:bg-[#F1E8DC]/60 font-bold text-[13px] cursor-pointer"
              >Mark in progress</button>
            )}
            <button
              disabled={busy} onClick={() => act({ status: "RESOLVED" }, "Marked resolved.")}
              className="h-10 px-5 rounded-full text-[#8C8279] dark:text-muted-foreground hover:bg-[#F1E8DC]/60 font-bold text-[13px] cursor-pointer"
            >Resolve without reply</button>
          </div>
        </div>
      )}
    </li>
  );
}
