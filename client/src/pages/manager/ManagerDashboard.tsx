import { useEffect, useState } from "react";
import { Bell, Plus, Bed, Receipt, Clock, Building2, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getManagerStats, formatGHS, errorMessage, type ManagerStats, type RecentBooking } from "@/lib/adminApi";

const STATUS_LABEL: Record<RecentBooking["status"], string> = {
  CONFIRMED: "Confirmed",
  PENDING: "Pending",
  CANCELLED: "Cancelled",
  CHECKED_OUT: "Checked out",
};

const AVATAR_COLORS = [
  "bg-[#D2BDA7] text-[#5C4538]",
  "bg-[#A84A1A] text-white",
  "bg-emerald-600 text-white",
  "bg-[#8A79B8] text-white",
];

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getManagerStats().then(setStats).catch((e) => setError(errorMessage(e)));
  }, []);

  const name = user?.name ?? "";
  const firstName = name.split(" ")[0];
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const liveListings = stats?.hostels.filter((h) => h.status === "APPROVED").length ?? 0;
  const awaitingReview = stats?.hostels.filter((h) => h.status === "PENDING").length ?? 0;
  const dash = "—";

  return (
    <div className="flex flex-col min-h-screen pb-6 lg:pb-12 bg-[#F0EFEA]">
      {/* Header Mobile */}
      <div className="lg:hidden px-6 pt-12 pb-6 sticky top-0 bg-[#F0EFEA]/90 backdrop-blur-md z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
             <div className="w-12 h-12 rounded-full bg-[#463C38] flex items-center justify-center text-white font-bold text-lg">
                {initials(name)}
             </div>
             <div>
               <p className="text-[#8C8279] text-sm font-medium">{greeting()}</p>
               <h1 className="text-xl font-bold text-[#463C38]">{name}</h1>
             </div>
          </div>
          <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center relative shadow-sm text-[#463C38]">
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Header Desktop */}
      <div className="hidden lg:flex px-8 pt-10 pb-6 items-center justify-between border-b border-solid border-[#E5D0BA]/50 mb-6 mx-8">
        <div>
          <h1 className="text-2xl font-bold text-[#463C38]">{greeting()}, {firstName}</h1>
          <p className="text-[#8C8279] text-sm font-medium mt-1">{today}</p>
        </div>
        <div className="flex items-center space-x-4">
          <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-[#463C38]">
            <Bell className="w-5 h-5" />
          </button>
          <Link to="/manager/properties" className="bg-[#A84A1A] hover:bg-[#8F3E15] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-colors flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Add room</span>
          </Link>
        </div>
      </div>

      <div className="px-5 lg:px-8 space-y-6 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6">

        {error && (
          <div className="lg:col-span-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-sm font-bold text-red-700">{error}</div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 lg:col-span-3 gap-3 lg:gap-4">
          {/* Occupancy */}
          <div className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <div className="w-8 h-8 rounded-lg bg-[#F8F6F3] text-[#A84A1A] flex items-center justify-center">
                  <Bed className="w-4 h-4" />
               </div>
            </div>
            <h2 className="text-2xl font-bold text-[#463C38]">{stats ? pct(stats.occupancy_rate) : dash}</h2>
            <p className="text-[11px] font-medium text-[#8C8279] mt-0.5">
              Occupancy{stats ? ` · ${stats.beds_filled}/${stats.beds_total} beds` : ""}
            </p>
          </div>

          {/* Revenue */}
          <div className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <div className="w-8 h-8 rounded-lg bg-[#F8F6F3] text-[#A84A1A] flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
               </div>
            </div>
            <h2 className="text-2xl font-bold text-[#463C38]">{stats ? formatGHS(stats.revenue_this_month) : dash}</h2>
            <p className="text-[11px] font-medium text-[#8C8279] mt-0.5">Revenue{stats ? ` · ${stats.month}` : ""}</p>
          </div>

          {/* Pending */}
          <div className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <div className="w-8 h-8 rounded-lg bg-[#F8F6F3] text-[#A84A1A] flex items-center justify-center">
                  <Clock className="w-4 h-4" />
               </div>
            </div>
            <h2 className="text-2xl font-bold text-[#463C38]">{stats ? stats.pending_bookings : dash}</h2>
            <p className="text-[11px] font-medium text-[#8C8279] mt-0.5">Pending bookings</p>
          </div>

          {/* Listings */}
          <div className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <div className="w-8 h-8 rounded-lg bg-[#F8F6F3] text-[#A84A1A] flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
               </div>
            </div>
            <h2 className="text-2xl font-bold text-[#463C38]">{stats ? liveListings : dash}</h2>
            <p className="text-[11px] font-medium text-[#8C8279] mt-0.5">
              Live listings{stats ? ` · ${stats.hostels.length} total` : ""}
            </p>
          </div>
        </div>

        {/* Left Column (Recent Bookings) */}
        <div className="lg:col-span-2 flex flex-col h-full">
          <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-base font-bold text-[#463C38]">Recent bookings</h3>
               <Link to="/manager/bookings" className="text-sm font-bold text-[#A84A1A] hover:underline">View all</Link>
            </div>

            {/* Desktop Table Header */}
            <div className="hidden lg:grid grid-cols-4 text-[10px] font-extrabold uppercase tracking-widest text-[#8C8279] pb-3 border-b border-[#F0EFEA]">
               <div>GUEST</div>
               <div>ROOM</div>
               <div>STATUS</div>
               <div className="text-right">AMOUNT</div>
            </div>

            {stats && stats.recent_bookings.length === 0 && (
              <p className="py-6 text-sm font-medium text-[#8C8279]">No bookings yet.</p>
            )}

            <div className="space-y-0.5">
               {stats?.recent_bookings.map((b, i) => {
                  const status = STATUS_LABEL[b.status];
                  const guest = b.student_name ?? b.student_email ?? "Unknown student";
                  const amount = Math.round(b.amount).toLocaleString("en-GH");
                  return (
                  <div key={b.id} className="flex flex-col lg:grid lg:grid-cols-4 lg:items-center py-3 border-b border-[#F0EFEA] last:border-0 gap-2 lg:gap-0">
                     <div className="flex items-center space-x-3">
                       <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                         {initials(b.student_name)}
                       </div>
                       <div className="lg:hidden flex flex-col">
                         <span className="font-bold text-[#463C38] text-sm">{guest}</span>
                         <span className="text-xs font-medium text-[#8C8279]">Room {b.room_number ?? dash}</span>
                       </div>
                       <span className="hidden lg:block font-bold text-[#463C38] text-[13px]">{guest}</span>
                     </div>
                     <div className="hidden lg:block text-[#8C8279] font-medium text-[13px]">{b.room_number ?? dash}</div>
                     <div className="flex justify-between items-center lg:block">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          status === 'Confirmed' || status === 'Checked out' ? 'bg-emerald-50 text-emerald-600' :
                          status === 'Pending' ? 'bg-amber-50 text-amber-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {status}
                        </span>
                        <span className="lg:hidden font-bold text-[#463C38] text-sm">{amount}</span>
                     </div>
                     <div className="hidden lg:block text-right font-bold text-[#463C38] text-[13px]">
                        {amount}
                     </div>
                  </div>
                  );
               })}
            </div>
          </div>
        </div>

        {/* Right Column (Occupancy & Action Needed) */}
        <div className="lg:col-span-1 space-y-6">

           {/* Occupancy by hostel */}
           <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="text-base font-bold text-[#463C38] mb-5">Occupancy by hostel</h3>
              {stats && stats.hostels.length === 0 && (
                <p className="text-sm font-medium text-[#8C8279]">No hostels yet.</p>
              )}
              <div className="space-y-4">
                 {stats?.hostels.map(h => (
                    <div key={h.hostel_id}>
                       <div className="flex justify-between text-xs font-bold mb-1.5">
                          <span className="text-[#8C8279]">{h.hostel_name}</span>
                          <span className="text-[#463C38]">{h.beds_filled}/{h.beds_total}</span>
                       </div>
                       <div className="h-1.5 bg-[#F0EFEA] rounded-full overflow-hidden">
                          <div className="h-full bg-[#A84A1A] rounded-full" style={{ width: `${h.occupancy_rate * 100}%` }} />
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           {/* Action Needed */}
           {stats && (stats.pending_bookings > 0 || awaitingReview > 0) && (
           <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="text-base font-bold text-[#463C38] mb-4">Action needed</h3>
              <div className="space-y-3">
                 {stats.pending_bookings > 0 && (
                 <Link to="/manager/bookings" className="flex items-start space-x-3 p-3 rounded-xl hover:bg-[#F0EFEA]/50 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-[#F8F6F3] text-[#A84A1A] flex items-center justify-center shrink-0">
                       <Clock className="w-4 h-4" />
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                       <p className="text-[13px] font-medium text-[#463C38] leading-tight pr-4">
                          <strong className="font-bold">{stats.pending_bookings} {stats.pending_bookings === 1 ? "booking" : "bookings"}</strong> awaiting your approval
                       </p>
                       <ChevronRight className="w-4 h-4 text-[#A29A91] group-hover:text-[#463C38] transition-colors shrink-0" />
                    </div>
                 </Link>
                 )}

                 {awaitingReview > 0 && (
                 <Link to="/manager/properties" className="flex items-start space-x-3 p-3 rounded-xl hover:bg-[#F0EFEA]/50 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-[#F8F6F3] text-[#A84A1A] flex items-center justify-center shrink-0">
                       <Building2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                       <p className="text-[13px] font-medium text-[#463C38] leading-tight pr-4">
                          <strong className="font-bold">{awaitingReview} {awaitingReview === 1 ? "hostel" : "hostels"}</strong> waiting for admin approval
                       </p>
                       <ChevronRight className="w-4 h-4 text-[#A29A91] group-hover:text-[#463C38] transition-colors shrink-0" />
                    </div>
                 </Link>
                 )}
              </div>
           </div>
           )}

        </div>
      </div>
    </div>
  );
}
