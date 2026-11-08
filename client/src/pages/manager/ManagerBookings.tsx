import { useState } from "react";
import { ROUTES } from "@/lib/routes";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { Search, SlidersHorizontal, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/adminApi";
import { useManagerBookings } from "@/data/managerBookings";

export default function ManagerBookings() {
  const [activeTab, setActiveTab] = useState("Pending");

  const { bookings, loaded, error, approve, decline } = useManagerBookings();
  const { toast } = useToast();
  const act = (fn: (id: string) => Promise<void>, id: string, done: string) =>
    fn(id).then(() => toast(done)).catch((e) => toast(errorMessage(e), "error"));
  const countOf = (status: string) => bookings.filter(b => b.status === status).length;

  const [query, setQuery] = useState("");
  const [roomType, setRoomType] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const roomTypes = ["All", ...Array.from(new Set(bookings.map((b) => b.roomType)))];
  const q = query.trim().toLowerCase();

  const filteredBookings = bookings.filter((b) => {
    if (activeTab !== "All" && b.status !== activeTab) return false;
    if (roomType !== "All" && b.roomType !== roomType) return false;
    if (q && !`${b.guest} ${b.ref} ${b.room} ${b.email}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen pb-6 lg:pb-12 bg-[#F0EFEA]">
      {/* Header Mobile & Desktop Container */}
      <div className="pt-10 sticky top-0 bg-[#F0EFEA]/90 backdrop-blur-md z-40 border-b border-solid border-[#E5D0BA]/50 mb-6">
        <div className="px-5 lg:px-8 flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
          <div className="flex items-center justify-between mb-4 lg:mb-0">
            <h1 className="text-xl lg:text-2xl font-bold text-[#463C38]">Bookings</h1>
            <div className="lg:hidden"><NotificationsDropdown /></div>
          </div>
          
          <div className="flex items-center space-x-3 w-full lg:w-auto">
            <div className="hidden lg:block order-last"><NotificationsDropdown /></div>
            <div className="relative flex-1 lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8279]" />
              <input 
                type="text" 
                placeholder="Search guest or ref..." value={query} onChange={(e) => setQuery(e.target.value)} 
                className="w-full h-10 bg-white rounded-full pl-9 pr-4 text-[13px] font-semibold text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 shadow-sm border border-transparent placeholder:text-[#A29A91]"
              />
            </div>
            <div className="relative shrink-0">
              <button
                onClick={() => setFilterOpen((o) => !o)}
                aria-label="Filter bookings"
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-colors ${roomType !== "All" ? "bg-[#A84A1A] text-white" : "bg-white text-[#463C38] hover:bg-[#F8F6F3]"}`}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-12 z-50 w-56 bg-white rounded-2xl shadow-lg border border-[#E5E0D8] p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#8C8279] px-2 pb-2">Room type</p>
                  {roomTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setRoomType(t); setFilterOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-[13px] font-bold transition-colors ${roomType === t ? "bg-[#F1E8DC] text-[#A84A1A]" : "text-[#463C38] hover:bg-[#F8F6F3]"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Tabs (Segmented Control) */}
        <div className="lg:hidden px-5 mb-4 mt-2">
          <div className="flex p-1 bg-[#E5E0D8]/50 rounded-[14px]">
            {[
              { name: "Pending", count: countOf("Pending") },
              { name: "Confirmed", count: countOf("Confirmed") },
              { name: "Cancelled", count: countOf("Cancelled") }
            ].map(tab => (
              <button 
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`flex-1 flex items-center justify-center py-2 text-[13px] font-bold rounded-xl transition-all ${activeTab === tab.name ? 'bg-white text-[#463C38] shadow-sm' : 'text-[#8C8279] hover:text-[#5C4538]'}`}
              >
                {tab.name}
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.name ? 'bg-[#F0EFEA] text-[#8C8279]' : 'bg-[#E5E0D8] text-[#8C8279]'}`}>
                   {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Desktop Tabs */}
        <div className="hidden lg:flex px-8 space-x-6 overflow-x-auto hide-scrollbar">
          {[
            { name: "All", count: bookings.length },
            { name: "Pending", count: countOf("Pending") },
            { name: "Confirmed", count: countOf("Confirmed") },
            { name: "Cancelled", count: countOf("Cancelled") }
          ].map(tab => (
            <button 
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`pb-3 text-[14px] font-bold whitespace-nowrap transition-colors relative flex items-center ${activeTab === tab.name ? 'text-[#A84A1A]' : 'text-[#8C8279] hover:text-[#5C4538]'}`}
            >
              {tab.name}
              <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${activeTab === tab.name ? 'bg-[#A84A1A] text-white' : 'bg-[#E5E0D8] text-[#8C8279]'}`}>
                 {tab.count}
              </span>
              {activeTab === tab.name && (
                <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#A84A1A] rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 lg:px-8 mt-2 space-y-4">
        {error && <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm font-bold text-red-700">{error}</div>}
        {!loaded && <p className="text-center text-sm font-semibold text-[#8C8279] mt-10">Loading bookings…</p>}
        {loaded && filteredBookings.length === 0 && (
          <div className="text-center text-[#8C8279] mt-10">
            <p className="text-sm font-semibold">{bookings.length === 0 ? "No booking requests yet. They'll appear here when students book your hostel." : `No ${activeTab.toLowerCase()} bookings found.`}</p>
          </div>
        )}
        
        {/* Desktop Table View */}
        <div className="hidden lg:block bg-white rounded-2xl p-2 shadow-sm overflow-hidden">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="text-[10px] font-extrabold uppercase tracking-widest text-[#8C8279] border-b border-[#F0EFEA]">
                    <th className="px-5 py-4 font-extrabold w-[30%]">GUEST</th>
                    <th className="px-5 py-4 font-extrabold w-[15%]">ROOM</th>
                    <th className="px-5 py-4 font-extrabold w-[15%]">MOVE-IN</th>
                    <th className="px-5 py-4 font-extrabold w-[15%]">AMOUNT</th>
                    <th className="px-5 py-4 font-extrabold text-right">STATUS / ACTIONS</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EFEA]">
                 {filteredBookings.map(b => (
                    <tr key={b.id} className="hover:bg-[#F8F6F3]/50 transition-colors">
                       <td className="px-5 py-4">
                          <div className="flex items-center space-x-3">
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${b.color}`}>
                               {b.initials}
                             </div>
                             <div className="flex flex-col">
                                <span className="font-bold text-[#463C38] text-[15px]">{b.guest}</span>
                                <span className="text-[11px] font-bold text-[#A29A91] uppercase tracking-wider">{b.ref}</span>
                             </div>
                          </div>
                       </td>
                       <td className="px-5 py-4 text-[14px] font-medium text-[#5C4538]">{b.roomType} · {b.room}</td>
                       <td className="px-5 py-4 text-[14px] font-medium text-[#5C4538]">{b.moveIn}</td>
                       <td className="px-5 py-4 text-[15px] font-bold text-[#463C38]">{b.amount}</td>
                       <td className="px-5 py-4">
                          <div className="flex items-center justify-end space-x-3">
                             {b.status === 'Pending' && (
                                <>
                                  <button onClick={() => act(approve, b.id, "Booking approved.")} className="bg-[#A84A1A] hover:bg-[#8F3E15] text-white px-5 py-2 rounded-full font-bold text-xs transition-colors shadow-sm">
                                     Approve
                                  </button>
                                  <button onClick={() => act(decline, b.id, "Booking declined.")} className="bg-transparent border border-[#E5E0D8] text-[#5C4538] hover:bg-[#F8F6F3] px-5 py-2 rounded-full font-bold text-xs transition-colors">
                                     Decline
                                  </button>
                                </>
                             )}
                             {b.status === 'Confirmed' && (
                                <>
                                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 font-bold text-[11px] mr-2">Paid</span>
                                  <Link to={ROUTES.manager.cancelBooking(b.id)} className="bg-transparent border border-[#E5E0D8] text-[#A84A1A] hover:bg-red-50 hover:text-red-600 hover:border-red-200 px-4 py-2 rounded-full font-bold text-xs transition-colors flex items-center space-x-1">
                                     <span>Cancel & refund</span>
                                  </Link>
                                  <button className="w-8 h-8 flex items-center justify-center text-[#A29A91] hover:text-[#5C4538] transition-colors">
                                     <MoreHorizontal className="w-5 h-5" />
                                  </button>
                                </>
                             )}
                             {b.status === 'Cancelled' && (
                                <span className="px-3 py-1.5 rounded-full bg-red-50 text-red-600 font-bold text-[11px]">
                                   Refunded {b.refundAmount}
                                </span>
                             )}
                          </div>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>

        {/* Mobile List View */}
        <div className="lg:hidden space-y-4">
           {filteredBookings.map(b => (
             <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col space-y-4">
               <div className="flex items-start justify-between">
                 <div className="flex items-center space-x-3">
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${b.color}`}>
                     {b.initials}
                   </div>
                   <div className="flex flex-col">
                     <span className="font-bold text-[#463C38] text-[15px]">{b.guest}</span>
                     <span className="text-[11px] font-bold text-[#A29A91] uppercase tracking-wider">{b.ref}</span>
                   </div>
                 </div>
                 <div className="text-right">
                    <div className="font-bold text-[#463C38] text-base">{b.amount}</div>
                    <div className="text-[12px] font-medium text-[#8C8279]">{b.roomType} · {b.room}</div>
                 </div>
               </div>
               
               <div className="border-t border-[#F0EFEA] pt-3 flex justify-between items-center">
                  <div className="text-[12px] font-medium text-[#8C8279]">Move-in: {b.moveIn}</div>
                  <div>
                    {b.status === 'Pending' && (
                       <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 font-bold text-[10px]">Pending</span>
                    )}
                    {b.status === 'Confirmed' && (
                       <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-bold text-[10px]">Paid</span>
                    )}
                    {b.status === 'Cancelled' && (
                       <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-bold text-[10px]">Refunded</span>
                    )}
                  </div>
               </div>

               {/* Mobile Actions */}
               {b.status === 'Pending' && (
                  <div className="flex space-x-2 pt-1">
                     <button onClick={() => act(approve, b.id, "Booking approved.")} className="flex-1 bg-[#A84A1A] text-white py-2.5 rounded-xl font-bold text-[13px] shadow-sm active:scale-95 transition-transform">
                        Approve
                     </button>
                     <button onClick={() => act(decline, b.id, "Booking declined.")} className="flex-1 bg-[#F8F6F3] text-[#5C4538] py-2.5 rounded-xl font-bold text-[13px] active:scale-95 transition-transform">
                        Decline
                     </button>
                  </div>
               )}
               {b.status === 'Confirmed' && (
                  <div className="flex space-x-2 pt-1">
                     <Link to={ROUTES.manager.cancelBooking(b.id)} className="flex-1 bg-red-50 text-red-600 py-2.5 rounded-xl font-bold text-[13px] text-center active:scale-95 transition-transform">
                        Cancel & refund
                     </Link>
                  </div>
               )}
             </div>
           ))}
        </div>

      </div>
    </div>
  );
}
