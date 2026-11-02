import { Home, Compass, Bookmark, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { name: "Home", path: "/", icon: Home },
    { name: "Explore", path: "/explore", icon: Compass },
    { name: "Saved", path: "/saved", icon: Bookmark },
    { name: "Profile", path: "/profile", icon: User },
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
            <Icon className={cn("w-5 h-5 mb-1", isActive && "stroke-[2.5]")} />
            <span className="text-[11px] font-extrabold">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
