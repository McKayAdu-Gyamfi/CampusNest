import { useState } from "react";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useBookings } from "@/contexts/BookingContext";

export default function ManageBookings() {
  const [activeTab, setActiveTab] = useState("Upcoming");
  const { bookings: rawBookings } = useBookings();

  // Map the shared booking-approval status onto this page's payment-oriented display:
  // a booking is only "confirmed" once a manager has approved it; otherwise it's awaiting payment/hold.
  const mappedBookings = rawBookings.map((b) => ({
    id: b.id,
    rawStatus: b.status,
    status: b.status === "CONFIRMED" || b.status === "CHECKED_OUT" ? ("CONFIRMED" as const) : b.status === "CANCELLED" ? ("CANCELLED" as const) : ("PAYMENT DUE" as const),
    ref: b.reference,
    hostelName: b.hostelName,
    roomDetails: `${b.roomLabel} · ${b.roomNumber}`,
    moveIn: b.moveIn,
    semester: b.semester,
    amountPaid: b.status === "CONFIRMED" || b.status === "CHECKED_OUT" ? `GHS ${b.price.toLocaleString()}` : null,
    amountDue: b.status === "CONFIRMED" || b.status === "CHECKED_OUT" ? null : `GHS ${b.price.toLocaleString()}`,
    expiresIn: b.status === "PENDING" ? "Awaiting manager approval" : null,
  }));

  const upcomingBookings = mappedBookings.filter((b) => b.rawStatus === "PENDING" || b.rawStatus === "CONFIRMED");
  const cancelledBookings = mappedBookings.filter((b) => b.rawStatus === "CANCELLED");
  const pastBookings = mappedBookings.filter((b) => b.rawStatus === "CHECKED_OUT");

  const tabs = [
    { name: "Upcoming", count: upcomingBookings.length },
    { name: "Past", count: pastBookings.length },
    { name: "Cancelled", count: cancelledBookings.length },
  ];

  const bookings = activeTab === "Upcoming" ? upcomingBookings : activeTab === "Cancelled" ? cancelledBookings : pastBookings;
  const hasAnyBookings = rawBookings.length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#F0EFEA] dark:bg-background font-sans pb-12">
      {/* Header Container */}
      <div className="px-6 lg:px-10 pt-10 pb-6 w-full mx-auto flex flex-col h-full">
        
        {/* Top Header Row */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-[#463C38] dark:text-foreground">My bookings</h1>
          <Link 
            to="/explore"
            className="flex items-center space-x-2 bg-[#A84A1A] hover:bg-[#8F3E15] text-white px-5 py-2.5 rounded-full font-bold text-[14px] shadow-sm transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Find a room</span>
          </Link>
        </div>

        {!hasAnyBookings ? (
          /* Empty State (Image 2) */
          <div className="flex-1 flex flex-col items-center justify-center mt-20 text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-[#F1E8DC] dark:bg-card flex items-center justify-center text-[#A84A1A] mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h2 className="text-[22px] font-bold text-[#463C38] dark:text-foreground mb-3">No bookings yet</h2>
            <p className="text-[14px] font-medium text-[#8C8279] dark:text-muted-foreground mb-8 leading-relaxed">
              When you reserve a room it'll show up here with your move-in details, reference, and directions.
            </p>
            <Link 
              to="/explore"
              className="flex items-center space-x-2 bg-[#A84A1A] hover:bg-[#8F3E15] text-white px-6 py-3 rounded-full font-bold text-[14px] shadow-sm transition-colors"
            >
              <Search className="w-4 h-4" />
              <span>Explore hostels</span>
            </Link>
          </div>
        ) : (
          /* Populated State (Image 1) */
          <>
            {/* Tabs */}
            <div className="flex space-x-8 border-b border-[#E5E0D8] dark:border-border/40 mb-6">
              {tabs.map(tab => (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`pb-3 text-[15px] font-bold transition-colors relative flex items-center space-x-1 ${
                    activeTab === tab.name ? 'text-[#A84A1A]' : 'text-[#A29A91] dark:text-muted-foreground hover:text-[#8C8279] dark:text-muted-foreground'
                  }`}
                >
                  <span>{tab.name}</span>
                  <span>{tab.count}</span>
                  {activeTab === tab.name && (
                    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#A84A1A] rounded-t-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Bookings List */}
            {bookings.length === 0 ? (
              <p className="text-center text-[14px] font-medium text-[#8C8279] dark:text-muted-foreground py-16">
                {activeTab === "Past" ? "No past stays yet." : "Nothing here yet."}
              </p>
            ) : (
            <div className="space-y-5">
              {bookings.map((booking) => (
                <div key={booking.id} className="bg-white dark:bg-card rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-5 relative">
                  
                  {/* Thumbnail Placeholder */}
                  <div className="w-full md:w-[240px] h-[160px] md:h-auto rounded-xl shrink-0 relative overflow-hidden bg-[repeating-linear-gradient(45deg,#E5D0BA,#E5D0BA_15px,#F1E8DC_15px,#F1E8DC_30px)] flex items-center justify-center border border-[#E5D0BA]/50">
                    <div className="bg-white/90 dark:bg-background/90 text-[#8C8279] dark:text-muted-foreground backdrop-blur-sm px-4 py-1.5 rounded-full text-[10px] font-extrabold tracking-widest text-[#8C8279] dark:text-muted-foreground shadow-sm">
                      HOSTEL
                    </div>
                  </div>

                  {/* Middle Content */}
                  <div className="flex-1 py-1 flex flex-col justify-between">
                    <div>
                      {/* Status & Ref */}
                      <div className="flex items-center space-x-3 mb-2">
                        {booking.status === "CONFIRMED" ? (
                          <span className="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest">
                            {booking.status}
                          </span>
                        ) : booking.status === "CANCELLED" ? (
                          <span className="bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest">
                            {booking.status}
                          </span>
                        ) : (
                          <span className="bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
                            {booking.status}
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-[#A29A91] dark:text-muted-foreground">Ref <span className="text-[#8C8279] dark:text-muted-foreground">{booking.ref}</span></span>
                      </div>
                      
                      <h2 className="text-xl font-bold text-[#463C38] dark:text-foreground mb-0.5">{booking.hostelName}</h2>
                      <p className="text-[13px] font-medium text-[#8C8279] dark:text-muted-foreground mb-5">{booking.roomDetails}</p>
                    </div>

                    {/* Stats Grid */}
                    <div className="flex items-start space-x-8">
                      <div>
                        <p className="text-[10px] font-extrabold text-[#A29A91] dark:text-muted-foreground tracking-widest uppercase mb-1">Move-in</p>
                        <p className="text-[13px] font-bold text-[#463C38] dark:text-foreground">{booking.moveIn}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold text-[#A29A91] dark:text-muted-foreground tracking-widest uppercase mb-1">Semester</p>
                        <p className="text-[13px] font-bold text-[#463C38] dark:text-foreground">{booking.semester}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold text-[#A29A91] dark:text-muted-foreground tracking-widest uppercase mb-1">{booking.amountPaid ? 'Paid' : 'Due'}</p>
                        <p className={`text-[13px] font-bold ${booking.amountPaid ? 'text-emerald-600' : 'text-[#A84A1A]'}`}>
                          {booking.amountPaid || booking.amountDue}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="w-full md:w-[180px] shrink-0 border-t md:border-t-0 md:border-l border-[#F0EFEA] dark:border-border/40 pt-4 md:pt-0 md:pl-5 flex flex-col justify-center space-y-3">
                    {booking.status === "CONFIRMED" ? (
                      <>
                        <button className="w-full bg-[#A84A1A] hover:bg-[#8F3E15] text-white py-2.5 rounded-full font-bold text-[13px] transition-colors shadow-sm">
                          View booking
                        </button>
                        <button className="w-full bg-white dark:bg-card border border-[#C8B09A] dark:border-border/40 text-[#A84A1A] hover:bg-[#F8F6F3] dark:hover:bg-muted py-2.5 rounded-full font-bold text-[13px] transition-colors flex items-center justify-center space-x-1.5">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                          <span>Directions</span>
                        </button>
                      </>
                    ) : booking.status === "CANCELLED" ? (
                      <button className="w-full bg-white dark:bg-card border border-[#C8B09A] dark:border-border/40 text-[#A84A1A] hover:bg-[#F8F6F3] dark:hover:bg-muted py-2.5 rounded-full font-bold text-[13px] transition-colors">
                        View details
                      </button>
                    ) : (
                      <>
                        <button className="w-full bg-[#A84A1A] hover:bg-[#8F3E15] text-white py-2.5 rounded-full font-bold text-[13px] transition-colors shadow-sm">
                          Complete payment
                        </button>
                        <button className="w-full bg-white dark:bg-card border border-[#C8B09A] dark:border-border/40 text-[#A84A1A] hover:bg-[#F8F6F3] dark:hover:bg-muted py-2.5 rounded-full font-bold text-[13px] transition-colors">
                          View details
                        </button>
                        {booking.expiresIn && (
                          <p className="text-[10px] font-medium text-[#A29A91] dark:text-muted-foreground text-center mt-1">
                            {booking.expiresIn}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  
                </div>
              ))}
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

