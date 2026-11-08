import { useCallback, useEffect, useState } from "react";
import { fetchComplaints, type Complaint } from "@/lib/complaints";
import { errorMessage } from "@/lib/adminApi";
import MessageCard from "@/components/MessageCard";
import { EmptyState, ErrorBanner, PageHeader, SearchBox, Spinner, Tabs } from "@/components/admin/AdminUI";

type Filter = "ACTIVE" | "RESOLVED" | "ALL";

/** Every enquiry and complaint on the platform. Admins can answer or resolve any of them. */
export default function AdminComplaints() {
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [kind, setKind] = useState<"ALL" | "COMPLAINT" | "ENQUIRY">("ALL");
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    fetchComplaints().then((r) => { setItems(r.sort((a, b) => b.created_at.localeCompare(a.created_at))); setError(null); }).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    const poll = setInterval(load, 20000);
    return () => { clearTimeout(t); clearInterval(poll); };
  }, [load]);

  const all = items ?? [];
  const active = all.filter((c) => c.status !== "RESOLVED");
  const shown = all.filter((c) => {
    if (filter === "ACTIVE" && c.status === "RESOLVED") return false;
    if (filter === "RESOLVED" && c.status !== "RESOLVED") return false;
    if (kind !== "ALL" && (c.kind ?? "COMPLAINT") !== kind) return false;
    const q = query.trim().toLowerCase();
    return !q || [c.subject, c.content, c.USERS?.name, c.USERS?.email, c.HOSTEL?.hostel_name].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enquiries and complaints" subtitle={items ? `${active.length} need attention · ${all.length} in total` : "Loading…"}
        actions={<SearchBox value={query} onChange={setQuery} placeholder="Search student, hostel, subject…" />}
      />
      <ErrorBanner message={error} />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs active={filter} onChange={setFilter} tabs={[
          { id: "ACTIVE", label: "Needs attention", count: items ? active.length : undefined },
          { id: "RESOLVED", label: "Resolved", count: items ? all.length - active.length : undefined },
          { id: "ALL", label: "All", count: items ? all.length : undefined },
        ]} />
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Type" className="h-10 px-4 rounded-full bg-card border border-border/60 text-[13px] font-bold">
          <option value="ALL">Complaints and enquiries</option><option value="COMPLAINT">Complaints only</option><option value="ENQUIRY">Enquiries only</option>
        </select>
      </div>
      {!items && !error && <Spinner />}
      {items && shown.length === 0 && <EmptyState title={filter === "ACTIVE" ? "You're all caught up" : "Nothing here"} text="Complaints and enquiries from students show up here." />}
      <ul className="space-y-4 max-w-4xl">{shown.map((c) => <MessageCard key={c.id} c={c} onChanged={load} />)}</ul>
    </div>
  );
}
