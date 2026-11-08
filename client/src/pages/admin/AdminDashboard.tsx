import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { GraduationCap, FileText, BedDouble, Banknote } from "lucide-react";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { Link } from "react-router-dom";
import { getAdminStats, formatGHS, errorMessage, type AdminStats } from "@/lib/adminApi";

const thumbStyle = {
  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 8px)'
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    getAdminStats()
      .then((s) => {
        setStats(s);
        setLoadedAt(new Date());
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const dash = "—";
  const series = stats?.revenue_by_month ?? [];
  const peak = Math.max(0, ...series.map((m) => m.revenue));

  const cards = [
    { icon: GraduationCap, value: stats?.counts.students.toLocaleString(), label: "Students" },
    { icon: FileText, value: stats?.counts.approved_hostels.toLocaleString(), label: "Live hostels" },
    { icon: BedDouble, value: stats?.counts.bookings.toLocaleString(), label: "Bookings · all time" },
    { icon: Banknote, value: stats ? formatGHS(stats.revenue_total) : undefined, label: "Revenue · all time" },
  ];

  const totals = stats
    ? [
        { label: "Students", value: stats.counts.students },
        { label: "Hostel managers", value: stats.counts.managers },
        { label: "Admins", value: stats.counts.admins },
        { label: "Hostels (all statuses)", value: stats.counts.hostels },
        { label: `Revenue · ${series.at(-1)?.month ?? ""}`, value: formatGHS(stats.revenue_this_month) },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-solid border-border/80">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">Platform overview</h1>
          <p className="text-[13px] text-muted-foreground font-medium">
            {loadedAt ? `Updated ${loadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Loading…"}
          </p>
        </div>
        <NotificationsDropdown />
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm font-bold text-red-700">{error}</div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ icon: Icon, value, label }) => (
          <div key={label} className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#F8F4EE] flex items-center justify-center text-[#C56A30]">
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[28px] font-extrabold text-foreground leading-tight">{value ?? dash}</p>
            <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Middle Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-card border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="mb-6">
            <h3 className="font-extrabold text-lg text-foreground">Revenue</h3>
            <p className="text-[12px] text-muted-foreground font-medium">confirmed bookings · last {series.length || 7} months</p>
          </div>

          <div className="h-44 w-full flex items-end justify-between px-4 pb-2 pt-6">
            {series.map((item, i) => {
              const active = i === series.length - 1;
              // Keep a sliver visible for empty months so the axis still reads.
              const height = peak === 0 ? 2 : Math.max(2, (item.revenue / peak) * 100);
              return (
                <div key={item.key} className="flex flex-col items-center gap-3 h-full justify-end flex-1">
                  <div
                    title={formatGHS(item.revenue)}
                    className={`w-10 rounded-xl transition-all ${
                      active ? "bg-[#C56A30]" : "bg-[#F4ECE3] hover:bg-[#EBE2D8]"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <span className={`text-[12px] font-bold ${active ? "text-foreground font-extrabold" : "text-muted-foreground"}`}>
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-extrabold text-lg text-foreground">Pending approvals</h3>
            <span className="w-6 h-6 rounded-full bg-[#F5E6D8] text-[#C56A30] font-extrabold text-xs flex items-center justify-center">
              {stats?.pending_approvals.length ?? 0}
            </span>
          </div>

          {stats && stats.pending_approvals.length === 0 && (
            <p className="text-sm font-medium text-muted-foreground">Nothing waiting for review.</p>
          )}

          <div className="space-y-4">
            {stats?.pending_approvals.map((h) => (
              <div key={h.id} className="p-3.5 border border-border/40 rounded-2xl flex items-center justify-between gap-3 bg-[#FAF8F5]">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D2BDA7] to-[#B09A84] shrink-0 opacity-80" style={thumbStyle} />
                  <div>
                    <h4 className="font-extrabold text-[15px] text-foreground">{h.hostel_name}</h4>
                    <p className="text-[12px] text-muted-foreground font-medium">
                      {h.location} · {h.manager_name ?? h.manager_email ?? "Unassigned"}
                    </p>
                  </div>
                </div>
                <Link to={`${ROUTES.admin.hostels}?status=PENDING&focus=${h.id}`} className="px-4 py-2 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-xs rounded-full transition-colors shrink-0">
                  Review
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Hostels */}
        <div className="lg:col-span-2 bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-extrabold text-lg text-foreground">Top hostels</h3>
            <span className="text-[12px] text-muted-foreground font-medium">by confirmed bookings</span>
          </div>

          {stats && stats.top_hostels.length === 0 && (
            <p className="text-sm font-medium text-muted-foreground">No live hostels yet.</p>
          )}

          <div className="space-y-4">
            {stats?.top_hostels.map((h) => (
              <div key={h.hostel_id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-accent/40 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D2BDA7] to-[#B09A84] shrink-0 opacity-80" style={thumbStyle} />
                  <div>
                    <h4 className="font-extrabold text-[15px] text-foreground">{h.hostel_name}</h4>
                    <p className="text-[12px] text-muted-foreground font-medium">
                      {h.beds_total} beds · {h.bookings} {h.bookings === 1 ? "booking" : "bookings"}
                    </p>
                  </div>
                </div>
                <span className="font-extrabold text-emerald-600 text-sm">{Math.round(h.occupancy_rate * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Platform totals */}
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
          <h3 className="font-extrabold text-lg text-foreground mb-5">Platform totals</h3>

          <div className="space-y-4">
            {totals.map((t) => (
              <div key={t.label} className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-muted-foreground">{t.label}</span>
                <span className="font-extrabold text-[14px] text-foreground">
                  {typeof t.value === "number" ? t.value.toLocaleString() : t.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
