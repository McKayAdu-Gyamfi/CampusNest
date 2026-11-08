import { useState, useRef, useEffect } from "react";
import { ROUTES } from "@/lib/routes";
import { Bell } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { notificationIcon, timeAgo } from "@/lib/notificationIcon";

export default function NotificationsDropdown({ variant = "default" }: { variant?: "default" | "sidebar" }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("View All");
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const tabs = ["View All", "Unread"];

  const filteredNotifications = notifications.filter((n) => (activeTab === "Unread" ? !n.read : true));

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`${variant === "sidebar" ? "w-10 h-10" : "w-10 h-10 lg:w-[52px] lg:h-[52px]"} bg-card border border-border/50 rounded-full flex items-center justify-center relative shadow-sm hover:bg-accent transition-colors cursor-pointer`}
      >
        <Bell className="w-5 h-5 text-[#5E5B58]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#C56A30] text-white text-[10px] font-extrabold rounded-full border-2 border-white flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`${variant === "sidebar" ? "fixed left-[272px] top-24" : "absolute right-[-40px] sm:right-0 mt-3"} w-[320px] sm:w-[360px] bg-card border border-border/50 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col origin-top-right animate-in fade-in zoom-in-95 duration-200`}>
          
          <div className="p-4 border-b border-border/40 flex items-center justify-between bg-card">
            <h3 className="font-extrabold text-lg text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-extrabold text-[#C56A30] hover:underline transition-colors mt-1 cursor-pointer">
                Mark all as read
              </button>
            )}
          </div>

          <div className="px-4 py-3 bg-[#F8F6F3] dark:bg-muted/20 border-b border-border/40">
            <div className="flex bg-card p-1 rounded-xl border border-border/40">
              {tabs.map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-[11px] sm:text-xs font-extrabold py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === tab 
                      ? "bg-[#C56A30] text-white shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* List of Notifications */}
          <div className="max-h-[300px] overflow-y-auto overflow-x-hidden flex flex-col p-2 space-y-1">
            {filteredNotifications.map((n) => (
              <div 
                key={n.id}
                onClick={() => { markRead(n.id); if (n.link) { setIsOpen(false); navigate(n.link); } }}
                className={`p-3 rounded-2xl transition-colors cursor-pointer flex gap-4 ${
                  n.read ? 'opacity-70 hover:bg-accent/30' : 'bg-[#C56A30]/10 border border-[#C56A30]/20 hover:bg-[#C56A30]/15'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border bg-[#C56A30]/15 text-[#C56A30] border-[#C56A30]/30`}>
                  {(() => { const { Icon } = notificationIcon(n.type); return <Icon className="w-5 h-5" />; })()}
                </div>
                <div className="flex-1 relative">
                  {!n.read && <div className="absolute top-1 right-0 w-2 h-2 rounded-full bg-[#C56A30]" />}
                  <div className="flex justify-between items-start mb-0.5">
                    <h4 className={`font-extrabold text-[13px] ${n.read ? 'text-foreground/80' : 'text-foreground pr-4'}`}>{n.title}</h4>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-snug mb-1.5">{n.message}</p>
                  <span className="text-[10px] font-medium text-muted-foreground/80">{timeAgo(n.created_at)}</span>
                </div>
              </div>
            ))}
            
            {filteredNotifications.length === 0 && (
              <div className="py-8 text-center text-sm font-medium text-muted-foreground">
                {activeTab === "Unread" ? "You're all caught up." : "No notifications yet. Booking updates will show up here."}
              </div>
            )}
          </div>

          {user?.role === "student" && (
            <Link to={ROUTES.student.notifications} onClick={() => setIsOpen(false)} className="block text-center py-3 border-t border-border/40 text-[13px] font-extrabold text-[#C56A30] hover:bg-accent/40 transition-colors">
              See all notifications
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
