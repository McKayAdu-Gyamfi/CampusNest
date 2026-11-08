import { useEffect, useMemo, useState } from "react";
import { errorMessage, formatGHS, listAdminBookings, type AdminBooking } from "@/lib/adminApi";
import { Chip, EmptyState, ErrorBanner, PageHeader, SearchBox, Spinner, Tabs } from "@/components/admin/AdminUI";

type Filter = "ALL" | AdminBooking["status"];
const TONE = { PENDING: "amber", CONFIRMED: "green", CANCELLED: "red", CHECKED_OUT: "grey" } as const;
const LABEL = { PENDING: "Awaiting approval", CONFIRMED: "Approved", CANCELLED: "Cancelled / declined", CHECKED_OUT: "Checked out" } as const;
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const EARNING = new Set(["CONFIRMED", "CHECKED_OUT"]);

/** Read-only view of every booking and the payment behind it. */
export default function AdminBookings() {
  const [rows, setRows] = useState<AdminBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => { listAdminBookings().then((r) => setRows(r.sort((a, b) => b.created_at.localeCompare(a.created_at)))).catch((e) => setError(errorMessage(e))); }, []);

  const totals = useMemo(() => {
    const all = rows ?? [];
    return {
      count: all.length,
      pending: all.filter((b) => b.status === "PENDING").length,
      revenue: all.filter((b) => EARNING.has(b.status)).reduce((s, b) => s + (b.amount_paid ?? b.ROOM?.price_per_bed ?? 0), 0),
      awaitingMoney: all.filter((b) => b.status === "PENDING").reduce((s, b) => s + (b.amount_paid ?? 0), 0),
    };
  }, [rows]);

  const shown = (rows ?? []).filter((b) => {
    if (filter !== "ALL" && b.status !== filter) return false;
    const q = query.trim().toLowerCase();
    return !q || [b.USERS?.name, b.USERS?.email, b.ROOM?.HOSTEL?.hostel_name, b.ROOM?.room_number, b.payment_reference].some((v) => v?.toLowerCase().includes(q));
  });
  const count = (s: AdminBooking["status"]) => (rows ?? []).filter((b) => b.status === s).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings and payments" subtitle="Read-only. Managers approve requests; students pay through Paystack." actions={<SearchBox value={query} onChange={setQuery} placeholder="Search student, hostel, reference…" />} />
      <ErrorBanner message={error} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[["Bookings", totals.count.toLocaleString()], ["Awaiting approval", totals.pending.toLocaleString()], ["Earned (approved)", formatGHS(totals.revenue)], ["Paid, not yet approved", formatGHS(totals.awaitingMoney)]].map(([l, v]) => (
          <div key={l} className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm"><p className="text-[24px] font-extrabold text-foreground leading-tight">{rows ? v : "—"}</p><p className="text-[12px] font-medium text-muted-foreground mt-1">{l}</p></div>
        ))}
      </div>

      <Tabs active={filter} onChange={setFilter} tabs={[
        { id: "ALL", label: "All", count: rows?.length }, { id: "PENDING", label: "Awaiting approval", count: count("PENDING") },
        { id: "CONFIRMED", label: "Approved", count: count("CONFIRMED") }, { id: "CANCELLED", label: "Cancelled", count: count("CANCELLED") },
      ]} />

      {!rows && !error && <Spinner />}
      {rows && shown.length === 0 && <EmptyState title="No bookings match" />}
      {shown.length > 0 && (
        <div className="bg-card border border-border/40 rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead><tr className="border-b border-border/40 text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase bg-muted/40">
              <th className="py-4 px-6">Booked</th><th className="py-4 px-6">Student</th><th className="py-4 px-6">Hostel · room</th><th className="py-4 px-6">Status</th><th className="py-4 px-6 text-right">Paid</th><th className="py-4 px-6">Payment reference</th>
            </tr></thead>
            <tbody className="divide-y divide-border/40">
              {shown.map((b) => (
                <tr key={b.id} className="hover:bg-accent/30">
                  <td className="py-4 px-6 text-[13px] text-muted-foreground font-medium whitespace-nowrap">{fmt(b.created_at)}</td>
                  <td className="py-4 px-6"><p className="font-extrabold text-[14px] text-foreground leading-tight">{b.USERS?.name || "—"}</p><p className="text-[12px] text-muted-foreground font-medium">{b.USERS?.email}</p></td>
                  <td className="py-4 px-6 text-[13px] font-bold text-foreground/80">{b.ROOM?.HOSTEL?.hostel_name ?? "—"} · {b.ROOM?.room_number ?? "—"}</td>
                  <td className="py-4 px-6"><Chip tone={TONE[b.status]}>{LABEL[b.status]}</Chip></td>
                  <td className="py-4 px-6 text-right font-extrabold text-[14px] text-foreground whitespace-nowrap">{b.amount_paid ? formatGHS(b.amount_paid) : "—"}</td>
                  <td className="py-4 px-6 text-[12px] font-mono text-muted-foreground">{b.payment_reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
