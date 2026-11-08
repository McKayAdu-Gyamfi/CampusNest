import { useCallback, useEffect, useState } from "react";
import { MessageCircleQuestion, TriangleAlert, Send, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/adminApi";
import { createComplaint, fetchComplaints, STATUS_LABEL, type Complaint, type ComplaintKind } from "@/lib/complaints";
import { timeAgo } from "@/lib/notificationIcon";

const MAX = 1000;
const statusCls = {
  OPEN: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  RESOLVED: "bg-emerald-100 text-emerald-800",
} as const;

/** Lets a student send the hostel manager an enquiry or a complaint about their booking, and see the replies. */
export default function HelpDesk({ hostelId, bookingId, hostelName }: { hostelId: string; bookingId: string; hostelName: string }) {
  const { toast } = useToast();
  const [kind, setKind] = useState<ComplaintKind>("ENQUIRY");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<Complaint[] | null>(null);

  const load = useCallback(() => {
    fetchComplaints(hostelId).then((rows) => setItems(rows.sort((a, b) => b.created_at.localeCompare(a.created_at)))).catch(() => setItems([]));
  }, [hostelId]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    const poll = setInterval(load, 15000); // pick up manager replies
    return () => { clearTimeout(t); clearInterval(poll); };
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) { toast("Write your message first.", "error"); return; }
    setSending(true);
    try {
      await createComplaint({ hostel_id: hostelId, booking_id: bookingId, kind, subject: subject.trim() || undefined, content: content.trim() });
      setSubject(""); setContent("");
      toast(kind === "ENQUIRY" ? "Enquiry sent to the hostel manager." : "Complaint sent to the hostel manager.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  };

  const tab = (k: ComplaintKind, label: string, Icon: typeof TriangleAlert) => (
    <button
      type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
      className={`flex-1 h-11 rounded-lg font-bold text-[13px] flex items-center justify-center gap-2 transition-colors cursor-pointer ${kind === k ? "bg-card text-[#A84A1A] shadow-sm border border-[#E5D0BA]" : "text-[#8C8279] dark:text-muted-foreground hover:text-[#463C38]"}`}
    >
      <Icon className="w-4 h-4" />{label}
    </button>
  );

  return (
    <div className="bg-card rounded-2xl shadow-sm p-5 lg:p-6">
      <h2 className="text-[16px] font-extrabold text-[#463C38] dark:text-foreground">Enquiry or complaint</h2>
      <p className="text-[12px] font-medium text-[#8C8279] dark:text-muted-foreground mt-0.5 mb-4">Message the manager of {hostelName} directly.</p>

      <form onSubmit={submit} className="space-y-3">
        <div role="tablist" className="flex p-1 bg-[#F8F6F3] dark:bg-muted rounded-xl">
          {tab("ENQUIRY", "Enquiry", MessageCircleQuestion)}
          {tab("COMPLAINT", "Complaint", TriangleAlert)}
        </div>
        <div>
          <label htmlFor="hd-subject" className="text-[12px] font-bold text-[#463C38] dark:text-foreground block mb-1.5">Subject <span className="text-[#8C8279] dark:text-muted-foreground font-medium">(optional)</span></label>
          <input
            id="hd-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120}
            placeholder={kind === "ENQUIRY" ? "e.g. Is parking included?" : "e.g. No running water"}
            className="w-full h-11 px-4 rounded-xl border border-[#E5E0D8] dark:border-border bg-white dark:bg-background text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/30"
          />
        </div>
        <div>
          <label htmlFor="hd-msg" className="text-[12px] font-bold text-[#463C38] dark:text-foreground block mb-1.5">Message <span className="text-red-500" aria-hidden>*</span></label>
          <textarea
            id="hd-msg" value={content} onChange={(e) => setContent(e.target.value.slice(0, MAX))} rows={4} required
            placeholder={kind === "ENQUIRY" ? "Ask the manager anything about your room or the hostel…" : "Describe the problem so the manager can fix it…"}
            className="w-full px-4 py-3 rounded-xl border border-[#E5E0D8] dark:border-border bg-white dark:bg-background text-[14px] font-medium resize-none focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/30"
          />
          <p className="text-[11px] text-[#8C8279] dark:text-muted-foreground font-medium text-right mt-1">{content.length}/{MAX}</p>
        </div>
        <button
          type="submit" disabled={sending}
          className="w-full h-12 rounded-full bg-[#A84A1A] hover:bg-[#8F3E15] disabled:opacity-60 text-white font-bold text-[14px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending…" : kind === "ENQUIRY" ? "Send enquiry" : "Send complaint"}
        </button>
      </form>

      {items && items.length > 0 && (
        <div className="mt-6 pt-5 border-t border-[#F0EFEA] dark:border-border/40">
          <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-[#8C8279] dark:text-muted-foreground mb-3">Your messages</h3>
          <ul className="space-y-3">
            {items.map((c) => (
              <li key={c.id} className="rounded-xl border border-[#E5E0D8] dark:border-border/50 p-4">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8C8279] dark:text-muted-foreground">{c.kind === "ENQUIRY" ? "Enquiry" : "Complaint"} · {timeAgo(c.created_at)}</span>
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${statusCls[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                </div>
                {c.subject && <p className="text-[14px] font-extrabold text-[#463C38] dark:text-foreground">{c.subject}</p>}
                <p className="text-[13px] font-medium text-[#5C4538] dark:text-muted-foreground whitespace-pre-wrap break-words">{c.content}</p>
                {c.reply ? (
                  <div className="mt-3 rounded-lg bg-[#F8F6F3] dark:bg-muted p-3">
                    <p className="text-[11px] font-extrabold text-[#A84A1A] flex items-center gap-1.5 mb-1"><CheckCircle2 className="w-3.5 h-3.5" />Manager's reply{c.replied_at ? ` · ${timeAgo(c.replied_at)}` : ""}</p>
                    <p className="text-[13px] font-medium text-[#463C38] dark:text-foreground whitespace-pre-wrap break-words">{c.reply}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-[12px] font-medium text-[#8C8279] dark:text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Waiting for the manager to reply</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
