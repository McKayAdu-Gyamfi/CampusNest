import { Heart, BedDouble, Star, Settings, ShieldCheck, Bell, ChevronRight, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import TopNav from "@/components/TopNav";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { useBookings } from "@/contexts/BookingContext";
import { useAuth } from "@/contexts/AuthContext";
// import { TygerAvatar } from 'tyger-avatar';

export default function Profile() {
  const { signOut } = useAuth();
  const userAvatar = localStorage.getItem("userAvatar");
  const userName = localStorage.getItem("userName") || "Sarah Adjei";
  const userUniversity = localStorage.getItem("userUniversity") || "Ashesi";
  const userLevel = localStorage.getItem("userLevel") || "300";
  const initials = userName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const { bookings } = useBookings();
  const currentBooking = bookings.length > 0 ? bookings[0] : null;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans pb-24 relative">
      
      {/* Mobile Header */}
      <div className="lg:hidden">
        <TopNav />
      </div>

      {/* Desktop Header */}
      <header className="hidden lg:flex items-center justify-between px-8 pt-6 pb-6 w-full">
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">My account</h1>
        <NotificationsDropdown />
      </header>

      <div className="px-5 lg:px-8 space-y-8 pt-24 lg:pt-0 w-full">
        
        {/* Mobile Header Title */}
        <div className="lg:hidden text-center -mx-5 px-5 pt-4 pb-2 bg-gradient-to-b from-[#3D261B] to-[#3D261B]/95 text-white">
          {/* <h1 className="text-2xl font-bold text-white">My account</h1> */}
        </div>

        {/* Profile Hero Banner Card */}
        <div className="w-[calc(100%+40px)] -mx-5 md:mx-0 md:w-full bg-gradient-to-br from-[#3D261B] via-[#7B3C1F] to-[#B85822] md:rounded-2xl rounded-b-[40px] px-6 pb-10 pt-4 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 text-white shadow-sm relative overflow-hidden -mt-10 md:mt-0 mb-8">
          
          {/* Decorative circles */}
          <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute top-4 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
            <Settings className="w-5 h-5 text-white/80" />
          </div>

          <div className="flex flex-col md:flex-row items-center text-center md:text-left space-y-4 md:space-y-0 md:space-x-5 z-10 w-full mt-4 md:mt-0">
            <div className="w-24 h-24 md:w-20 md:h-20 rounded-full flex items-center justify-center text-white font-extrabold text-3xl md:text-2xl shadow-md border-[3px] border-white/20 shrink-0 overflow-hidden transition-colors"
                 style={{ backgroundColor: userAvatar && userAvatar.startsWith("#") ? userAvatar : "#D3B78F" }}>
              {userAvatar?.startsWith("http") ? (
                <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[#6c5e57]">{initials}</span>
              )}
            </div>
            <div>
              <h2 className="text-[26px] lg:text-[28px] font-extrabold text-white leading-tight mb-1">{userName}</h2>
              <p className="text-[13px] text-white/80 font-medium mb-4">sarah.adjei@ashesi.edu.gh</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                <span className="bg-white/20 backdrop-blur-md text-white font-extrabold text-[12px] px-3.5 py-1.5 rounded-full">
                  Level {userLevel} · {userUniversity}
                </span>
                <span className="bg-[#C56A30] text-white font-extrabold text-[12px] px-3.5 py-1.5 rounded-full">
                  Verified
                </span>
              </div>
            </div>
          </div>

          <Link 
            to="/settings" 
            className="hidden md:block w-full md:w-auto text-center bg-white text-[#3D261B] hover:bg-white/90 font-extrabold text-[15px] px-6 py-2.5 rounded-full transition-all shadow-sm shrink-0 cursor-pointer z-10"
          >
            Edit profile
          </Link>
        </div>

        {/* Current Booking Section */}
        {currentBooking && (
          <div>
            <h3 className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-widest mb-3">
              Current booking
            </h3>
            <div className="bg-white dark:bg-card border border-border/40 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div className="flex items-center space-x-4 flex-1">
                <img 
                  src={currentBooking.image || "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=400&q=80"} 
                  alt={currentBooking.hostelName} 
                  className="w-[110px] h-[85px] rounded-[18px] object-cover shrink-0" 
                />
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-extrabold text-[18px] text-foreground">{currentBooking.hostelName}</h4>
                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center space-x-1 ${currentBooking.status === 'Approved' ? 'bg-[#E6F4EA] text-[#137333]' : 'bg-amber-100 text-amber-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${currentBooking.status === 'Approved' ? 'bg-[#137333]' : 'bg-amber-500'}`} />
                      <span className="uppercase">{currentBooking.status}</span>
                    </span>
                  </div>
                  <p className="text-[13px] text-muted-foreground font-medium mb-3">
                    {currentBooking.roomNumber || 'Pending Allocation'} · {currentBooking.roomLabel} · Move-in Jan 12, 2026
                  </p>
                  <div className="flex items-center space-x-6">
                    <div>
                      <span className="text-[11px] text-muted-foreground font-medium block">Paid</span>
                      <span className="text-[15px] font-extrabold text-[#137333]">GHS {currentBooking.price.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground font-medium block">Semester</span>
                      <span className="text-[15px] font-extrabold text-foreground">Spring 2026</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-card border border-border/40 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-[120px]">
            <Heart className="w-5 h-5 text-[#C56A30]" />
            <div>
              <span className="text-[26px] font-extrabold text-foreground block leading-none mb-1">7</span>
              <span className="text-[13px] font-medium text-muted-foreground">Saved hostels</span>
            </div>
          </div>

          <div className="bg-white dark:bg-card border border-border/40 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-[120px]">
            <BedDouble className="w-5 h-5 text-[#C56A30]" />
            <div>
              <span className="text-[26px] font-extrabold text-foreground block leading-none mb-1">{bookings.length}</span>
              <span className="text-[13px] font-medium text-muted-foreground">Past bookings</span>
            </div>
          </div>

          <div className="bg-white dark:bg-card border border-border/40 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-[120px]">
            <Star className="w-5 h-5 text-[#C56A30]" />
            <div>
              <span className="text-[26px] font-extrabold text-foreground block leading-none mb-1">3</span>
              <span className="text-[13px] font-medium text-muted-foreground">Reviews written</span>
            </div>
          </div>
        </div>

        {/* Settings Links */}
        <div className="bg-white dark:bg-card border border-border/40 rounded-2xl shadow-sm overflow-hidden divide-y divide-border/40">
          <Link to="/settings" className="flex items-center justify-between p-5 hover:bg-accent/40 transition-colors cursor-pointer group">
            <div className="flex items-center space-x-4">
              <Settings className="w-5 h-5 text-[#8C5B4F]" />
              <span className="font-bold text-[15px] text-foreground">Account settings</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>

          <Link to="/settings" className="flex items-center justify-between p-5 hover:bg-accent/40 transition-colors cursor-pointer group">
            <div className="flex items-center space-x-4">
              <ShieldCheck className="w-5 h-5 text-[#8C5B4F]" />
              <span className="font-bold text-[15px] text-foreground">Privacy & security</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>

          <Link to="/settings" className="flex items-center justify-between p-5 hover:bg-accent/40 transition-colors cursor-pointer group">
            <div className="flex items-center space-x-4">
              <Bell className="w-5 h-5 text-[#8C5B4F]" />
              <span className="font-bold text-[15px] text-foreground">Notifications</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>

          <Link
            to="/login"
            onClick={() => { signOut(); }}
            className="flex items-center justify-between p-5 hover:bg-red-500/10 transition-colors cursor-pointer group"
          >
            <div className="flex items-center space-x-4">
              <LogOut className="w-5 h-5 text-red-500" />
              <span className="font-bold text-[15px] text-red-500">Log out</span>
            </div>
            <ChevronRight className="w-4 h-4 text-red-500 opacity-60 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>

      </div>
    </div>
  );
}
