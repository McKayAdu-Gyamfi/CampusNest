import { createContext, useContext, useState, type ReactNode } from "react";

// Matches the backend's real `booking_status` Postgres enum exactly
// (see server/src/utils/supabase_schema.sql) so this mock context's shape
// is a drop-in for whatever the real API returns once it's wired up.
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
}

interface BookingContextType {
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, "id" | "reference" | "status" | "date" | "moveIn" | "semester"> & { moveIn?: string; semester?: string }) => Booking;
  approveBooking: (id: string) => void;
  declineBooking: (id: string) => void;
  cancelBooking: (id: string) => void;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

// Initial state populated with a few static mock bookings for display purposes
const initialBookings: Booking[] = [];

function generateReference() {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `KC-${suffix}`;
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);

  const addBooking: BookingContextType["addBooking"] = (newBookingData) => {
    const newBooking: Booking = {
      ...newBookingData,
      id: `b-${Date.now()}`,
      reference: generateReference(),
      status: "PENDING",
      date: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      moveIn: newBookingData.moveIn || "Jan 12, 2026",
      semester: newBookingData.semester || "Spring 2026",
    };
    setBookings((prev) => [newBooking, ...prev]);
    return newBooking;
  };

  const approveBooking = (id: string) => {
    setBookings((prev) =>
      prev.map(b => b.id === id ? { ...b, status: "CONFIRMED" } : b)
    );
  };

  const declineBooking = (id: string) => {
    // The backend has no separate "declined" state — a booking a manager
    // never confirms is just CANCELLED, same as a student-initiated cancel.
    setBookings((prev) =>
      prev.map(b => b.id === id ? { ...b, status: "CANCELLED" } : b)
    );
  };

  const cancelBooking = (id: string) => {
    // A cancelled booking is a real row with CANCELLED status, not a
    // deletion — matches the backend, which never deletes a BOOKING row.
    setBookings((prev) =>
      prev.map(b => b.id === id ? { ...b, status: "CANCELLED" } : b)
    );
  };

  return (
    <BookingContext.Provider value={{ bookings, addBooking, approveBooking, declineBooking, cancelBooking }}>
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
