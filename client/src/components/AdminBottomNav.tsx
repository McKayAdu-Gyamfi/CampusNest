import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { LayoutGrid, Users, Building, GraduationCap, Box, Sun, MessageSquareWarning, CalendarCheck, Star, ScrollText, UserCircle, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const MAIN = [
  { path: ROUTES.admin.dashboard, label: "Dashboard", icon: LayoutGrid },
  { path: ROUTES.admin.hostels, label: "Hostels", icon: Building },
  { path: ROUTES.admin.users, label: "Users", icon: Users },
  { path: ROUTES.admin.complaints, label: "Complaints", icon: MessageSquareWarning },
];
const MORE = [
  { path: ROUTES.admin.schools, label: "Schools", icon: GraduationCap },
  { path: ROUTES.admin.bookings, label: "Bookings", icon: CalendarCheck },
  { path: ROUTES.admin.reviews, label: "Reviews", icon: Star },
  { path: ROUTES.admin.roomTours, label: "Room tours", icon: Box },
  { path: ROUTES.admin.audit, label: "Audit log", icon: ScrollText },
  { path: ROUTES.admin.settings, label: "Settings", icon: Sun },
  { path: ROUTES.admin.profile, label: "My account", icon: UserCircle },
];

export default function AdminBottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");
  const moreActive = MORE.some((m) => isActive(m.path));

  const exit = async () => { await signOut(); navigate(ROUTES.admin.login); };

  return (
    <>
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-[150] bg-black/50" onClick={() => setMoreOpen(false)}>
          <div className="absolute bottom-0 inset-x-0 bg-card rounded-t-3xl p-5 pb-24 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="More">
            <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-extrabold">More</h2><button onClick={() => setMoreOpen(false)} aria-label="Close" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-3 gap-3">
              {MORE.map(({ path, label, icon: Icon }) => (
                <Link key={path} to={path} onClick={() => setMoreOpen(false)} className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center ${isActive(path) ? "border-[#C56A30] text-[#C56A30]" : "border-border text-foreground"}`}>
                  <Icon className="w-5 h-5" /><span className="text-[11px] font-bold">{label}</span>
                </Link>
              ))}
              <button onClick={exit} className="flex flex-col items-center gap-1.5 rounded-2xl border border-red-200 text-red-600 p-3"><LogOut className="w-5 h-5" /><span className="text-[11px] font-bold">Sign out</span></button>
            </div>
          </div>
        </div>
      )}
      <div className="lg:hidden fixed bottom-0 left-0 w-full bg-[#F8F6F3] dark:bg-card border-t border-border/40 z-[160] px-2 flex items-center justify-between pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {MAIN.map(({ path, label, icon: Icon }) => (
          <Link key={path} to={path} className="flex flex-col items-center justify-center space-y-1 py-2.5 flex-1 min-w-0">
            <Icon className={`w-5 h-5 transition-all duration-300 ${isActive(path) ? "text-[#C56A30] scale-105" : "text-[#A29A91]"}`} strokeWidth={isActive(path) ? 2.5 : 2} />
            <span className={`text-[10px] font-bold tracking-wide truncate ${isActive(path) ? "text-[#C56A30]" : "text-[#A29A91]"}`}>{label}</span>
          </Link>
        ))}
        <button onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} className="flex flex-col items-center justify-center space-y-1 py-2.5 flex-1 min-w-0 cursor-pointer">
          <Menu className={`w-5 h-5 ${moreActive || moreOpen ? "text-[#C56A30]" : "text-[#A29A91]"}`} />
          <span className={`text-[10px] font-bold ${moreActive || moreOpen ? "text-[#C56A30]" : "text-[#A29A91]"}`}>More</span>
        </button>
      </div>
    </>
  );
}
