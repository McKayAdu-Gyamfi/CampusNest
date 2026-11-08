import { useMemo, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { useNavigate } from "react-router-dom";
import { BellOff, CheckCheck } from "lucide-react";
import TopNav from "@/components/TopNav";
import { useNotifications, type AppNotification } from "@/contexts/NotificationsContext";
import { notificationIcon, notificationTone, timeAgo } from "@/lib/notificationIcon";

const TABS = ["All", "Unread"] as const;

/** Where tapping a notification should take the student. */
function targetFor(n: AppNotification): string | null {
  if (n.booking_id && (n.type.startsWith("booking_") || n.type === "complaint_reply")) return ROUTES.student.booking(n.booking_id);
  return null;
}

function dayBucket(iso: string): string {
  const d = new Date(iso);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((startOfToday.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  return "Earlier";
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");

  const groups = useMemo(() => {
    const shown = notifications.filter((n) => (tab === "Unread" ? !n.read : true));
    const map = new Map<string, AppNotification[]>();
    for (const n of shown) {
      const k = dayBucket(n.created_at);
      map.set(k, [...(map.get(k) ?? []), n]);
    }
    return [...map.entries()];
  }, [notifications, tab]);

  const open = (n: AppNotification) => {
    if (!n.read) markRead(n.id);
    const to = targetFor(n);
    if (to) navigate(to);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24 transition-colors">
      <div className="lg:hidden"><TopNav /></div>

      <header className="hidden lg:flex items-center justify-between px-8 pt-6 pb-6 w-full border-b border-border/40">
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">Notifications</h1>
      </header>

      <div className="px-5 lg:px-8 pt-24 lg:pt-8 w-full max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5 lg:hidden">
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        </div>

        <div className="flex items-center justify-between gap-3 mb-6">
          <div role="tablist" className="inline-flex p-1 bg-muted rounded-full">
            {TABS.map((t) => (
              <button
                key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`h-10 px-5 rounded-full text-[13px] font-extrabold transition-colors cursor-pointer flex items-center gap-2 ${tab === t ? "bg-[#C56A30] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t}
                {t === "Unread" && unreadCount > 0 && (
                  <span className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] font-extrabold flex items-center justify-center ${tab === t ? "bg-white/25" : "bg-[#C56A30] text-white"}`}>{unreadCount}</span>
                )}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="h-10 px-4 rounded-full text-[13px] font-extrabold text-[#C56A30] hover:bg-[#C56A30]/10 transition-colors cursor-pointer flex items-center gap-2">
              <CheckCheck className="w-4 h-4" />Mark all as read
            </button>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center text-center mt-16">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-5"><BellOff className="w-8 h-8 text-muted-foreground" /></div>
            <h2 className="text-[20px] font-extrabold text-foreground mb-2">{tab === "Unread" ? "You're all caught up" : "No notifications yet"}</h2>
            <p className="text-[14px] font-medium text-muted-foreground max-w-sm">
              {tab === "Unread" ? "New updates about your bookings will appear here." : "Booking approvals, payment confirmations and replies from your hostel will show up here."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(([label, items]) => (
              <section key={label}>
                <h2 className="text-[12px] font-extrabold uppercase tracking-widest text-muted-foreground mb-3">{label}</h2>
                <ul className="space-y-3">
                  {items.map((n) => {
                    const { Icon } = notificationIcon(n.type);
                    const tone = notificationTone(n.type);
                    const clickable = !!targetFor(n) || !n.read;
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => open(n)}
                          className={`w-full text-left rounded-2xl border p-4 flex gap-4 items-start transition-colors ${clickable ? "cursor-pointer" : "cursor-default"} ${
                            n.read ? "bg-card border-border/50 hover:bg-accent/30" : `bg-card ${tone.border} shadow-sm hover:bg-accent/30`
                          }`}
                        >
                          <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${tone.icon}`}><Icon className="w-5 h-5" /></span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-start justify-between gap-3">
                              <span className={`text-[14px] font-extrabold ${n.read ? "text-foreground/80" : "text-foreground"}`}>{n.title}</span>
                              <span className="text-[11px] font-medium text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                            </span>
                            <span className="block text-[13px] font-medium text-muted-foreground leading-snug mt-1">{n.message}</span>
                            {targetFor(n) && <span className="inline-block mt-2 text-[12px] font-extrabold text-[#C56A30]">View booking →</span>}
                          </span>
                          {!n.read && <span aria-label="Unread" className="w-2.5 h-2.5 rounded-full bg-[#C56A30] shrink-0 mt-1.5" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
