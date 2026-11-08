import { useEffect, useSyncExternalStore } from "react";
import { NOTIFICATION_EVENT } from "@/lib/notificationEvents";
import { apiFetch } from "@/lib/apiClient";

// Bookings as the manager sees them: the real requests students have made
// (and paid for) on this manager's hostels, from GET /api/bookings.
export interface ManagerBooking {
  id: string;
  /** Paystack reference when the student paid online, else a short id. */
  ref: string;
  guest: string;
  email: string;
  course: string;
  hostelName: string;
  room: string;
  roomType: string;
  moveIn: string;
  semester: string;
  paidOn: string;
  /** Formatted amount, e.g. "7,000" */
  amount: string;
  status: "Pending" | "Confirmed" | "Cancelled";
  initials: string;
  color: string;
  refundAmount?: string;
}

interface ApiBooking {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "CHECKED_OUT";
  check_in_date: string;
  created_at: string;
  payment_reference?: string;
  amount_paid?: number;
  ROOM: { room_number: string; room_type?: string; price_per_bed?: number; HOSTEL: { hostel_name: string } | null } | null;
  USERS: { email: string; name?: string; course?: string } | null;
}

const fmt = (n: number) => n.toLocaleString("en-GH");
export const parseAmount = (amount: string) => Number(amount.replace(/,/g, ""));
export const formatAmount = fmt;
export const PROCESSOR_FEE_RATE = 0.01;

const ROOM_TYPE_LABEL: Record<string, string> = {
  SINGLE: "Single room", DOUBLE: "Standard room", TRIPLE: "Triple room", QUAD: "Shared room",
};

const AVATAR_COLORS = [
  "bg-[#4A3B32] text-white", "bg-emerald-600 text-white", "bg-[#8A79B8] text-white",
  "bg-[#A84A1A] text-white", "bg-slate-500 text-white", "bg-[#D2BDA7] text-[#5C4538]",
];

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";

function toManagerBooking(b: ApiBooking, index: number): ManagerBooking {
  const guest = b.USERS?.name || b.USERS?.email || "Unknown student";
  const paid = b.amount_paid ?? b.ROOM?.price_per_bed ?? 0;
  const status = b.status === "CANCELLED" ? "Cancelled" : b.status === "PENDING" ? "Pending" : "Confirmed";
  return {
    id: b.id,
    ref: b.payment_reference ?? `KC-${b.id.slice(-5).toUpperCase()}`,
    guest,
    email: b.USERS?.email ?? "",
    course: b.USERS?.course ?? "",
    hostelName: b.ROOM?.HOSTEL?.hostel_name ?? "",
    room: b.ROOM?.room_number ?? "—",
    roomType: ROOM_TYPE_LABEL[b.ROOM?.room_type ?? ""] ?? "Room",
    moveIn: dateLabel(b.check_in_date),
    semester: "Spring 2026",
    paidOn: dateLabel(b.created_at),
    amount: fmt(paid),
    status,
    initials: initialsOf(guest),
    color: AVATAR_COLORS[index % AVATAR_COLORS.length],
    // A cancelled booking is refunded in full unless the manager used Cancel & refund.
    refundAmount: status === "Cancelled" ? fmt(paid) : undefined,
  };
}

// --- tiny shared store so the sidebar badge and every page see the same list ---
interface State { bookings: ManagerBooking[]; loaded: boolean; error: string | null }
let state: State = { bookings: [], loaded: false, error: null };
const listeners = new Set<() => void>();
const set = (next: State) => { state = next; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export async function refreshManagerBookings() {
  try {
    const rows = await apiFetch<ApiBooking[]>("/bookings");
    // Newest first.
    const sorted = [...rows].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    set({ bookings: sorted.map(toManagerBooking), loaded: true, error: null });
  } catch (e) {
    set({ ...state, loaded: true, error: e instanceof Error ? e.message : "Couldn't load bookings" });
  }
}

async function setStatus(id: string, status: "CONFIRMED" | "CANCELLED") {
  await apiFetch(`/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  await refreshManagerBookings();
}

export function useManagerBookings() {
  const s = useSyncExternalStore(subscribe, () => state);
  useEffect(() => { refreshManagerBookings(); }, []);
  // A new request or cancellation just arrived: show it now, not at the next poll.
  useEffect(() => {
    const onNotification = (e: Event) => {
      const types = (e as CustomEvent<string[]>).detail ?? [];
      if (types.some((t) => t.startsWith("booking_"))) refreshManagerBookings();
    };
    window.addEventListener(NOTIFICATION_EVENT, onNotification);
    return () => window.removeEventListener(NOTIFICATION_EVENT, onNotification);
  }, []);
  return {
    bookings: s.bookings,
    loaded: s.loaded,
    error: s.error,
    refresh: refreshManagerBookings,
    approve: (id: string) => setStatus(id, "CONFIRMED"),
    // The backend has no "declined" state: a booking the manager rejects is CANCELLED.
    decline: (id: string) => setStatus(id, "CANCELLED"),
    cancelAndRefund: (id: string) => setStatus(id, "CANCELLED"),
  };
}
