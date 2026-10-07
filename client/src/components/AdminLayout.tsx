import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { LayoutGrid, Users, Building, GraduationCap, Box, Sun, ArrowLeft } from "lucide-react";
import Logo from "./Logo";
import AdminBottomNav from "./AdminBottomNav";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleExitAdmin = async () => {
    await signOut();
    navigate("/login");
  };

  const navItems = [
    { path: "/admin", label: "Dashboard", icon: LayoutGrid },
    { path: "/admin/users", label: "Users", icon: Users },
    { path: "/admin/hostels", label: "Hostels", icon: Building },
    { path: "/admin/schools", label: "Schools", icon: GraduationCap },
    { path: "/admin/room-tours", label: "Room tours", icon: Box },
    { path: "/admin/settings", label: "Settings", icon: Sun },
  ];

  return (
    <div className="flex min-h-screen bg-[#F4F1EA] dark:bg-background text-foreground font-sans">
      {/* Dark Sidebar */}
      <aside className="hidden lg:flex w-[260px] shrink-0 bg-[#251D1A] text-white flex-col h-screen sticky top-0 py-7 px-4 select-none z-40">
        
        {/* Logo Section */}
        <div className="px-3 pb-6 mb-8 border-b border-solid border-white/20 mx-2">
          <div className="flex items-center space-x-3">
            <Logo 
              iconClassName="h-9 w-auto shrink-0" 
              textClassName="text-[20px] font-extrabold tracking-tight text-white" 
            />
          </div>
          <div className="ml-11 -mt-1">
            <span className="text-[11px] font-extrabold tracking-[0.2em] text-[#C56A30] uppercase">ADMIN</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.path || (item.path !== "/admin" && pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3.5 px-4 py-3 rounded-2xl font-bold text-[14px] transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#3D2E27] text-white"
                    : "text-[#A89F99] hover:bg-[#322723] hover:text-white"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-[#A89F99]"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Pill Footer */}
        <div className="pt-4 border-t border-white/10 mt-auto">
          <div className="bg-[#322723] rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#C56A30] text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                A
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-[14px] text-white leading-tight">Admin</span>
                <span className="text-[11px] text-[#A89F99] font-medium">Platform admin</span>
              </div>
            </div>
            <button onClick={handleExitAdmin} title="Exit Admin" className="text-[#A89F99] hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 pb-28 lg:pb-8 lg:p-8 overflow-x-hidden min-h-screen">
        <Outlet />
      </main>

      <AdminBottomNav />
    </div>
  );
}
