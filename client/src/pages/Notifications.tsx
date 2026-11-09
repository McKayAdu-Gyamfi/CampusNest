import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BellOff, CalendarCheck, CheckCheck, ChevronRight, Heart, Search, Sparkles } from "lucide-react";
import TopNav from "@/components/TopNav";
import { ROUTES } from "@/lib/routes";
import { useNotifications, type AppNotification } from "@/contexts/NotificationsContext";
import { notificationIcon, notificationTone, timeAgo } from "@/lib/notificationIcon";

type TabId = "all" | "unread" | "bookings" | "replies";

const TABS: { id: TabId; label: string; match: (n: AppNotification) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "unread", label: "Unread", match: (n) => !n.read },
  { id: "bookings", label: "Bookings", match: (n) => n.type.startsWith("booking_") },
  { id: "replies", label: "Replies", match: (n) => n.type === "complaint_reply" },
];

const EMPTY_COPY: Record<TabId, { title: string; body: string }> = {
  all: { title: "No notifications yet", body: "Booking approvals, payment confirmations and replies from hostels will show up here." },
  unread: { title: "You're all caught up", body: "Nothing new right now. We'll let you know as soon as a hostel responds." },
  bookings: { title: "No booking updates", body: "Once you request a room, its progress (paid, approved, declined) is tracked here." },
  replies: { title: "No replies yet", body: "When a hostel manager answers one of your enquiries, you'll see it here." },
};

/** Where tapping a notification should take the student. */
function targetFor(n: AppNotification): string | null {
  if (n.link) return n.link;
  if (n.booking_id && (n.type.startsWith("booking_") || n.type === "complaint_reply")) return ROUTES.student.booking(n.booking_id);
  return null;
}

/** Small label that says what kind of update this is, so the list scans quickly. */
function kindOf(n: AppNotification): string {
  if (n.type === "booking_submitted" && /payment/i.test(n.title)) return "Payment";
  if (n.type.startsWith("booking_")) return "Booking";
  if (n.type === "complaint_reply") return "Reply";
  if (n.type === "new_review") return "Review";
  return "Update";
}

function actionLabel(n: AppNotification): string {
  if (n.type === "complaint_reply") return "View reply";
  if (n.type.startsWith("booking_")) return "View booking";
  return "Open";
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

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C56A30]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const SHORTCUTS = [
  { to: ROUTES.student.bookings, label: "My bookings", hint: "Track requests and payments", Icon: CalendarCheck },
  { to: ROUTES.student.explore, label: "Find a hostel", hint: "Browse rooms near campus", Icon: Search },
  { to: ROUTES.student.saved, label: "Saved hostels", hint: "Pick up where you left off", Icon: Heart },
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [tab, setTab] = useState<TabId>("all");

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, notifications.filter(t.match).length])) as Record<TabId, number>,
    [notifications],
  );
  const thisWeek = useMemo(() => notifications.filter((n) => dayBucket(n.created_at) !== "Earlier").length, [notifications]);

  const { groups, shownCount } = useMemo(() => {
    const active = TABS.find((t) => t.id === tab)!;
    const shown = notifications.filter(active.match);
    const map = new Map<string, AppNotification[]>();
    for (const n of shown) {
      const k = dayBucket(n.created_at);
      map.set(k, [...(map.get(k) ?? []), n]);
    }
    return { groups: [...map.entries()], shownCount: shown.length };
  }, [notifications, tab]);

  const open = (n: AppNotification) => {
    if (!n.read) markRead(n.id);
    const to = targetFor(n);
    if (to) navigate(to);
  };

  const markAll = unreadCount > 0 && (
    <button onClick={markAllRead} className={`h-11 px-4 rounded-full text-[13px] font-extrabold text-[#C56A30] hover:bg-[#C56A30]/10 transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${focusRing}`}>
      <CheckCheck className="w-4 h-4" />Mark all as read
    </button>
  );

  const subtitle = unreadCount > 0
    ? `${unreadCount} unread ${unreadCount === 1 ? "update" : "updates"} about your bookings and enquiries.`
    : "Updates about your bookings, payments and enquiries.";

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24 transition-colors">
      <div className="lg:hidden"><TopNav /></div>

      <header className="hidden lg:flex items-center justify-between gap-6 px-8 pt-6 pb-6 w-full border-b border-border/40">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-foreground leading-tight">Notifications</h1>
          <p className="text-[14px] font-medium text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {markAll}
      </header>

      <div className="px-5 lg:px-8 pt-24 lg:pt-8 w-full max-w-5xl mx-auto grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <main className="min-w-0">
          <div className="lg:hidden mb-5">
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            <p className="text-[13px] font-medium text-muted-foreground mt-1">{subtitle}</p>
          </div>

          <div className="flex items-center justify-between gap-3 mb-6">
            <div role="tablist" aria-label="Filter notifications" className="flex p-1 bg-muted rounded-full overflow-x-auto max-w-full [scrollbar-width:none]">
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id} role="tab" aria-selected={active} onClick={() => setTab(t.id)}
                    className={`h-11 px-4 rounded-full text-[13px] font-extrabold transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${focusRing} ${active ? "bg-[#C56A30] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {t.label}
                    {counts[t.id] > 0 && (
                      <span className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] font-extrabold flex items-center justify-center ${active ? "bg-white/25 text-white" : t.id === "unread" ? "bg-[#C56A30] text-white" : "bg-foreground/10 text-muted-foreground"}`}>{counts[t.id]}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="lg:hidden">{markAll}</div>
          </div>

          {groups.length === 0 ? (
            <div className="flex flex-col items-center text-center rounded-3xl border border-dashed border-border bg-card/50 px-6 py-14">
              <div className="w-20 h-20 rounded-full bg-[#C56A30]/10 flex items-center justify-center mb-5"><BellOff className="w-8 h-8 text-[#C56A30]" /></div>
              <h2 className="text-[20px] font-extrabold text-foreground mb-2">{EMPTY_COPY[tab].title}</h2>
              <p className="text-[14px] font-medium text-muted-foreground max-w-sm leading-relaxed">{EMPTY_COPY[tab].body}</p>
              <Link to={ROUTES.student.explore} className={`mt-6 h-11 px-6 rounded-full bg-[#C56A30] text-white text-[14px] font-extrabold inline-flex items-center gap-2 hover:bg-[#B35E28] transition-colors cursor-pointer ${focusRing}`}>
                Browse hostels<ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {groups.map(([label, items]) => (
                <section key={label} aria-label={label}>
                  <h2 className="text-[12px] font-extrabold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-3">
                    {label}<span className="h-px flex-1 bg-border/60" />
                  </h2>
                  <ul className="space-y-3">
                    {items.map((n) => {
                      const { Icon } = notificationIcon(n.type);
                      const tone = notificationTone(n.type);
                      const to = targetFor(n);
                      const clickable = !!to || !n.read;
                      return (
                        <li key={n.id}>
                          <button
                            onClick={() => open(n)}
                            title={new Date(n.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                            className={`group relative w-full text-left rounded-2xl border p-4 sm:p-5 flex gap-4 items-start transition-colors overflow-hidden ${focusRing} ${clickable ? "cursor-pointer" : "cursor-default"} ${
                              n.read ? "bg-card border-border/50 hover:bg-accent/30" : `bg-card ${tone.border} shadow-sm hover:bg-accent/30`
                            }`}
                          >
                            {!n.read && <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-[#C56A30]" />}
                            <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${tone.icon}`}><Icon className="w-5 h-5" /></span>
                            <span className="flex-1 min-w-0">
                              <span className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${tone.icon}`}>{kindOf(n)}</span>
                                <span className="text-[12px] font-medium text-muted-foreground">{timeAgo(n.created_at)}</span>
                                {!n.read && <span className="ml-auto flex items-center gap-1.5 text-[11px] font-extrabold text-[#C56A30]"><span aria-hidden className="w-2 h-2 rounded-full bg-[#C56A30]" />New</span>}
                              </span>
                              <span className={`block text-[15px] font-extrabold leading-snug ${n.read ? "text-foreground/80" : "text-foreground"}`}>{n.title}</span>
                              <span className="block text-[13.5px] font-medium text-muted-foreground leading-relaxed mt-1">{n.message}</span>
                              {to && (
                                <span className="inline-flex items-center gap-1 mt-3 text-[13px] font-extrabold text-[#C56A30]">
                                  {actionLabel(n)}<ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              {shownCount <= 5 && (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#C56A30]/10 flex items-center justify-center mx-auto mb-3"><Sparkles className="w-5 h-5 text-[#C56A30]" /></div>
                  <p className="text-[15px] font-extrabold text-foreground">That's everything for now</p>
                  <p className="text-[13px] font-medium text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">New updates about your bookings and enquiries appear here as they happen.</p>
                  <div className="lg:hidden mt-5 flex flex-col sm:flex-row gap-2 justify-center">
                    <Link to={ROUTES.student.explore} className={`h-11 px-5 rounded-full bg-[#C56A30] text-white text-[13px] font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer ${focusRing}`}>Browse hostels</Link>
                    <Link to={ROUTES.student.bookings} className={`h-11 px-5 rounded-full border border-border text-foreground text-[13px] font-extrabold inline-flex items-center justify-center cursor-pointer hover:bg-accent/40 transition-colors ${focusRing}`}>My bookings</Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        <aside className="hidden lg:block lg:sticky lg:top-8 space-y-4" aria-label="Overview and shortcuts">
          <section className="rounded-2xl border border-border/50 bg-card p-5">
            <h2 className="text-[12px] font-extrabold uppercase tracking-widest text-muted-foreground">Overview</h2>
            <dl className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: "Total", value: notifications.length },
                { label: "Unread", value: unreadCount, accent: unreadCount > 0 },
                { label: "This week", value: thisWeek },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-muted/60 px-3 py-3 text-center">
                  <dd className={`text-[22px] font-extrabold leading-none ${s.accent ? "text-[#C56A30]" : "text-foreground"}`}>{s.value}</dd>
                  <dt className="text-[11px] font-bold text-muted-foreground mt-1.5">{s.label}</dt>
                </div>
              ))}
            </dl>
          </section>

          <nav aria-label="Shortcuts" className="rounded-2xl border border-border/50 bg-card p-2">
            {SHORTCUTS.map(({ to, label, hint, Icon }) => (
              <Link key={to} to={to} className={`flex items-center gap-3 rounded-xl px-3 min-h-14 py-2 hover:bg-accent/40 transition-colors cursor-pointer ${focusRing}`}>
                <span className="w-10 h-10 rounded-full bg-[#C56A30]/10 text-[#C56A30] flex items-center justify-center shrink-0"><Icon className="w-[18px] h-[18px]" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-extrabold text-foreground">{label}</span>
                  <span className="block text-[12px] font-medium text-muted-foreground truncate">{hint}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}
