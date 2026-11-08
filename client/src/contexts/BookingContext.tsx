import { NOTIFICATION_EVENT } from "@/lib/notificationEvents";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useHostels } from "@/contexts/HostelsContext";

// Matches the backend's `booking_status` exactly.
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "CHECKED_OUT";

export interface Booking {
  id: string;
  reference: string;
  studentName: string;
  hostelName: string;
  roomLabel: string;
  roomNumber: string;
  price: number;
  date: string;
  moveIn: string;
  semester: string;
  status: BookingStatus;
  image: string;
  location: string;
  roomId: string;
  hostelId: string;
  roomType: string;
}

interface ApiBooking {
  id: string;
  room_id: string;
  status: BookingStatus;
  check_in_date: string;
  created_at: string;
  payment_reference?: string;
  amount_paid?: number;
  ROOM: {
    room_number: string;
    room_type?: string;
    price_per_bed?: number;
    hostel_id: string;
    HOSTEL: { hostel_name: string } | null;
  } | null;
}

interface BookingContextType {
  bookings: Booking[];
  isLoading: boolean;
  /** Re-reads the student's bookings, e.g. right after a payment. */
  refresh: () => Promise<void>;
  cancelBooking: (id: string) => Promise<void>;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

const ROOM_LABEL: Record<string, string> = {
  SINGLE: "Single room", DOUBLE: "Standard room", TRIPLE: "Triple room", QUAD: "Shared room",
};
const fmtDate = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });

const POLL_MS = 15_000;

// The student's bookings, straight from the backend. A manager approving or
// declining a request changes the status there, so polling (and refetching on
// focus) is what makes it show up here.
export function BookingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { allHostels } = useHostels();
  const [rows, setRows] = useState<ApiBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isStudent = user?.role === "student" && !!user.id;

  const refresh = useCallback(async () => {
    if (!isStudent) return;
    try {
      setRows(await apiFetch<ApiBooking[]>("/bookings"));
    } catch (err) {
      console.error("[BookingProvider] Could not load bookings:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isStudent]);

  useEffect(() => {
    if (!isStudent) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    refresh();
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
    const onFocus = () => refresh();
    // A booking notification means a status just changed: show it now, not at the next poll.
    const onNotification = (e: Event) => {
      const types = (e as CustomEvent<string[]>).detail ?? [];
      if (types.some((t) => t.startsWith("booking_"))) refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATION_EVENT, onNotification);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATION_EVENT, onNotification);
    };
  }, [isStudent, refresh]);

  const bookings = useMemo<Booking[]>(
    () =>
      [...rows]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .map((b) => {
          const hostel = allHostels.find((h) => h.id === b.ROOM?.hostel_id);
          return {
            id: b.id,
            reference: b.payment_reference ?? `KC-${b.id.slice(-5).toUpperCase()}`,
            studentName: user?.name ?? "",
            hostelName: b.ROOM?.HOSTEL?.hostel_name ?? hostel?.name ?? "",
            roomLabel: ROOM_LABEL[b.ROOM?.room_type ?? ""] ?? "Room",
            roomNumber: b.ROOM?.room_number ? `Rm ${b.ROOM.room_number}` : "",
            price: b.amount_paid ?? b.ROOM?.price_per_bed ?? 0,
            date: fmtDate(b.created_at, true),
            moveIn: fmtDate(b.check_in_date),
            semester: "Spring 2026",
            status: b.status,
            image: hostel?.image ?? "",
            location: hostel?.location ?? "",
            roomId: b.room_id,
            hostelId: b.ROOM?.hostel_id ?? "",
            roomType: b.ROOM?.room_type ?? "",
          };
        }),
    [rows, allHostels, user?.name],
  );

  const cancelBooking = useCallback(
    async (id: string) => {
      await apiFetch(`/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) });
      await refresh();
    },
    [refresh],
  );

  return (
    <BookingContext.Provider value={{ bookings, isLoading, refresh, cancelBooking }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBookings() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error("useBookings must be used within a BookingProvider");
  }
  return context;
}
