import { useCallback, useEffect, useState } from "react";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import MessageCard from "@/components/MessageCard";
import { errorMessage } from "@/lib/adminApi";
import { fetchComplaints, type Complaint } from "@/lib/complaints";
import { Inbox } from "lucide-react";

const FILTERS: { id: "ACTIVE" | "RESOLVED" | "ALL"; label: string }[] = [
  { id: "ACTIVE", label: "Needs attention" }, { id: "RESOLVED", label: "Resolved" }, { id: "ALL", label: "All" },
];
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
