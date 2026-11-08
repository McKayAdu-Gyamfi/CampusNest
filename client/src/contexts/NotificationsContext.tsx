import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { notificationIcon, notificationTone } from "@/lib/notificationIcon";
import { NOTIFICATION_EVENT } from "@/lib/notificationEvents";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  booking_id?: string;
  /** In-app path to open when tapped. */
  link?: string;
  created_at: string;
}

interface NotificationsValue {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | undefined>(undefined);

const POLL_MS = 8_000;
const TOAST_MS = 7_000;

// Notifications live in the backend (written when a booking is made, approved,
// etc.). This polls for them, pops a floating card for each new one, and keeps
// the full list for the bell menu. Runs for students and managers.
const EMPTY: NotificationsValue = {
  notifications: [], unreadCount: 0, markRead: async () => undefined, markAllRead: async () => undefined,
};

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [value, setValue] = useState<NotificationsValue>(EMPTY);
  return (
    <NotificationsContext.Provider value={value}>
      {children}
      {/* Keyed by user: signing in as someone else starts from a clean slate. The key sits on this
          sibling, not on a wrapper around `children`, so the rest of the app is NOT remounted
          (that used to wipe page state, e.g. a sign-in form's error, whenever the user changed). */}
      <NotificationsPoller key={user?.id ?? "anon"} publish={setValue} />
    </NotificationsContext.Provider>
  );
}

function NotificationsPoller({ publish }: { publish: (v: NotificationsValue) => void }) {
  const { user } = useAuth();
  const active = !!user?.id;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [floating, setFloating] = useState<AppNotification[]>([]);
  // Ids already shown or loaded, so each notification pops up once. The first
  // load only seeds this: old notifications don't pop up on every page load.
  const seen = useRef<Set<string> | null>(null);

  const dismiss = useCallback((id: string) => setFloating((f) => f.filter((n) => n.id !== id)), []);

  const load = useCallback(async () => {
    try {
      const rows = await apiFetch<AppNotification[]>("/notifications");
      setNotifications(rows);
      if (seen.current === null) {
        seen.current = new Set(rows.map((r) => r.id));
        return;
      }
      const fresh = rows.filter((r) => !r.read && !seen.current!.has(r.id));
      if (fresh.length) {
        fresh.forEach((r) => seen.current!.add(r.id));
        // Let the rest of the app react right away (e.g. refresh booking statuses).
        window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: fresh.map((r) => r.type) }));
        setFloating((f) => [...fresh.reverse(), ...f].slice(0, 4));
        fresh.forEach((r) => setTimeout(() => dismiss(r.id), TOAST_MS));
      }
    } catch {
      // transient network errors: try again on the next tick
    }
  }, [dismiss]);

  useEffect(() => {
    if (!active) return;
    const first = setTimeout(load, 0);
    const timer = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(first); clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [active, load]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((all) => all.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setFloating((f) => f.filter((n) => n.id !== id));
    try { await apiFetch(`/notifications/${id}/read`, { method: "PATCH" }); } catch { /* next poll corrects it */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((all) => all.map((n) => ({ ...n, read: true })));
    setFloating([]);
    try { await apiFetch("/notifications/read-all", { method: "POST" }); } catch { /* next poll corrects it */ }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = useMemo(
    () => ({ notifications, unreadCount, markRead, markAllRead }),
    [notifications, unreadCount, markRead, markAllRead],
  );
  useEffect(() => { publish(value); }, [publish, value]);
  useEffect(() => () => publish(EMPTY), [publish]);

  return (
    <>
      <div className="fixed top-20 right-4 z-[9990] flex flex-col gap-3 pointer-events-none w-[calc(100vw-2rem)] max-w-sm">
        {floating.map((n) => {
          const { Icon } = notificationIcon(n.type);
          const tone = notificationTone(n.type);
          return (
            <div
              key={n.id}
              role="status"
              onClick={() => markRead(n.id)}
              className={`pointer-events-auto cursor-pointer bg-card border ${tone.border} shadow-xl rounded-2xl p-4 flex items-start gap-3 animate-in slide-in-from-right-10 fade-in duration-300`}
            >
              <div className={`w-9 h-9 rounded-full ${tone.icon} flex items-center justify-center shrink-0`}>
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-extrabold text-foreground leading-tight">{n.title}</p>
                <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{n.message}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                aria-label="Dismiss"
                className="p-1 hover:bg-accent rounded-full shrink-0"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationsProvider");
  return ctx;
}
