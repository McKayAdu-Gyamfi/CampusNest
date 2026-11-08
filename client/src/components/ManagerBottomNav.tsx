import { Link, useLocation } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { LayoutDashboard, Building2, CalendarDays, Users2, User } from "lucide-react";

export default function ManagerBottomNav() {
  const { pathname } = useLocation();

  const navItems = [
    { name: "Dashboard", path: ROUTES.manager.dashboard, icon: LayoutDashboard },
    { name: "Bookings", path: ROUTES.manager.bookings, icon: CalendarDays },
    { name: "Property", path: ROUTES.manager.properties, icon: Building2 },
    { name: "Clients", path: ROUTES.manager.clients, icon: Users2 },
    { name: "Profile", path: ROUTES.manager.profile, icon: User },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 w-full h-[84px] bg-[#F8F6F3] border-t border-border/40 z-[100] px-4 flex items-center justify-between pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
        
        return (
          <Link 
            key={item.path} 
            to={item.path} 
            className="flex flex-col items-center justify-center space-y-1 relative group flex-1"
          >
            <div className="relative">
              <Icon 
                className={`w-6 h-6 transition-all duration-300 ${isActive ? 'text-[#A84A1A] scale-105' : 'text-[#A29A91]'}`} 
                strokeWidth={isActive ? 2.5 : 2}
              />
            </div>
            <span className={`text-[10px] font-bold tracking-wide transition-all ${isActive ? 'text-[#A84A1A]' : 'text-[#A29A91]'}`}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
