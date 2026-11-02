import Logo from "@/components/Logo";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { Link } from "react-router-dom";
// import { TygerAvatar } from 'tyger-avatar';
import { Moon } from "lucide-react";
import { useTheme } from "./theme-provider";
import { useAuth } from "@/contexts/AuthContext";
import { getInitials } from "@/lib/utils";

export default function TopNav() {
  const userAvatar = localStorage.getItem("userAvatar");
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  return (
    <header className="flex items-center justify-between px-4 h-20 w-full fixed top-0 left-0 z-50 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-b border-border/40 transition-colors shadow-sm">
      <Logo />
      <div className="flex items-center space-x-3">
        <button 
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Moon className="w-5 h-5" />
        </button>
        <NotificationsDropdown />
        <Link to="/profile">
          <div className="w-10 h-10 ring-2 ring-background flex items-center justify-center bg-[#E5D0BA] shadow-sm cursor-pointer hover:opacity-80 transition-opacity rounded-full overflow-hidden p-0.5">
            {/* {userAvatar?.startsWith("Tr") ? (
               <TygerAvatar name={userAvatar as any} size="lg" />
            ) : */} 
            {userAvatar?.startsWith("http") ? (
               <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
               <span className="text-[#6c5e57] font-bold text-[14px]">{getInitials(user?.name || user?.email)}</span>
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}
