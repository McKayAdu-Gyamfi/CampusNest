import { Home, Compass, Bookmark, User } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSavedCount } from "@/lib/savedHostels";

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;
  const savedCount = useSavedCount();

  const navItems = [
    { name: "Home", path: ROUTES.student.home, icon: Home },
    { name: "Explore", path: ROUTES.student.explore, icon: Compass },
    { name: "Saved", path: ROUTES.student.saved, icon: Bookmark },
    { name: "Profile", path: ROUTES.student.profile, icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-[72px] px-2 bg-card border-t border-border/40 shadow-lg transition-colors">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPath === item.path;
        
        return (
          <Link
            key={item.name}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full relative transition-colors cursor-pointer",
              isActive ? "text-[#C56A30]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive && (
              <span className="absolute top-2 w-1.5 h-1.5 bg-[#C56A30] rounded-full" />
            )}
            <span className="relative">
              <Icon className={cn("w-5 h-5 mb-1", isActive && "stroke-[2.5]")} />
              {item.path === ROUTES.student.saved && savedCount > 0 && (
                <span aria-label={`${savedCount} saved`} className="absolute -top-1.5 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C56A30] text-white text-[10px] font-extrabold flex items-center justify-center leading-none">{savedCount > 99 ? "99+" : savedCount}</span>
              )}
            </span>
            <span className="text-[11px] font-extrabold">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
