import { Link, useLocation } from "react-router-dom";
import Logo from "./Logo";
import { Home, Compass, Bookmark, BedDouble, User, LogOut, Moon } from "lucide-react";
// import { TygerAvatar } from 'tyger-avatar';
import { useTheme } from "./theme-provider";
import { useAuth } from "@/contexts/AuthContext";

export default function DesktopSidebar() {
  const { pathname } = useLocation();
  const userAvatar = localStorage.getItem("userAvatar");
  const userName = localStorage.getItem("userName") || "Sarah Adjei";
  const initials = userName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();

  // Define navigation items
  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/explore", label: "Explore", icon: Compass },
    { path: "/saved", label: "Saved", icon: Bookmark },
    { path: "/manage-bookings", label: "Bookings", icon: BedDouble },
    { path: "/profile", label: "Account", icon: User },
  ];

  return (
    <aside className="hidden lg:flex w-[88px] hover:w-[260px] flex-col h-screen fixed top-0 left-0 bg-[#F3ECDE] dark:bg-sidebar border-r border-border/40 z-50 py-8 transition-[width] duration-300 group overflow-x-hidden shadow-[4px_0_24px_rgba(0,0,0,0.02)] hover:shadow-[12px_0_40px_rgba(0,0,0,0.06)]">
      {/* Top Logo */}
      <div className="px-5 mb-12 min-w-[260px]">
        <Logo 
          iconClassName="h-10 w-auto shrink-0" 
          textClassName="text-[19px] font-bold tracking-tight text-foreground ml-1 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap" 
        />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 flex flex-col space-y-2 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-4 px-4 py-3.5 rounded-2xl font-bold text-[15px] transition-all relative overflow-hidden min-w-[236px] ${
                isActive 
                  ? "text-canyon bg-[#F2EFEA] dark:bg-card" 
                  : "text-[#5E5B58] dark:text-muted-foreground hover:bg-[#F2EFEA]/60 dark:hover:bg-card hover:text-foreground dark:hover:text-foreground"
              }`}
            >
              {/* Active vertical marker */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#C56A30] rounded-r-md" />
              )}
              
              <Icon className={`w-6 h-6 shrink-0 ${isActive ? 'text-canyon' : 'text-[#8C8A88] dark:text-muted-foreground'}`} strokeWidth={isActive ? 2.5 : 2} />
              <span className="opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Theme Toggle */}
      <div className="px-5 mt-auto pt-8 border-t border-border/40 min-w-[260px]">
        {/* Theme Toggle */}
        <div className="flex items-center justify-between mb-6 px-1 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap">
          <div className="flex items-center space-x-3 text-[#8C8A88] dark:text-muted-foreground">
            <Moon className="w-5 h-5 text-canyon dark:text-muted-foreground" />
            <span className="font-bold text-[15px] text-[#5E5B58] dark:text-muted-foreground">Dark mode</span>
          </div>
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${theme === 'dark' ? 'bg-[#4A3A31]' : 'bg-[#E5E0D8]'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <Link to="/profile" className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-12 h-12 ring-2 ring-background flex items-center justify-center bg-[#E5D0BA] shadow-sm rounded-full overflow-hidden p-0 shrink-0">
              {/* userAvatar?.startsWith("Tr") ? (
                 <TygerAvatar name={userAvatar as any} size="lg" />
              ) : */}
              {userAvatar?.startsWith("http") ? (
                 <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                 <span className="text-[#6c5e57] font-bold text-[16px]">{initials}</span>
              )}
            </div>
            <div className="flex flex-col opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap">
              <span className="font-bold text-[15px] text-foreground leading-tight">{userName}</span>
              <span className="text-[12px] font-medium text-muted-foreground">Student</span>
            </div>
          </Link>
          <Link 
            to="/login" 
            title="Log out"
            onClick={() => { signOut(); }}
            className="opacity-0 group-hover:opacity-100 transition-all duration-300 text-muted-foreground hover:text-red-500 p-2 rounded-full hover:bg-red-500/10 cursor-pointer"
          >
            <LogOut className="w-5 h-5 shrink-0" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
