import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, Users, Building, GraduationCap, Box, Sun } from "lucide-react";

export default function AdminBottomNav() {
  const { pathname } = useLocation();

  const navItems = [
    { path: "/admin", label: "Dashboard", icon: LayoutGrid },
    { path: "/admin/users", label: "Users", icon: Users },
    { path: "/admin/hostels", label: "Hostels", icon: Building },
    { path: "/admin/schools", label: "Schools", icon: GraduationCap },
    { path: "/admin/room-tours", label: "Tours", icon: Box },
    { path: "/admin/settings", label: "Settings", icon: Sun },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 w-full bg-[#F8F6F3] border-t border-border/40 z-[100] px-2 flex items-center justify-between pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path || (item.path !== "/admin" && pathname.startsWith(item.path));

        return (
          <Link
            key={item.path}
            to={item.path}
            className="flex flex-col items-center justify-center space-y-1 py-2.5 flex-1 min-w-0"
          >
            <Icon
              className={`w-5 h-5 transition-all duration-300 ${isActive ? "text-[#C56A30] scale-105" : "text-[#A29A91]"}`}
              strokeWidth={isActive ? 2.5 : 2}
            />
            <span className={`text-[9px] font-bold tracking-wide truncate ${isActive ? "text-[#C56A30]" : "text-[#A29A91]"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
