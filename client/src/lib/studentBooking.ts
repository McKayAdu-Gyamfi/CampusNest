import { apiFetch } from "./apiClient";

interface ApiRoom { id: string; price_per_bed: number; is_available: boolean }

/**
 * Creates the real booking for a paid request. Picks the available room in
 * the hostel whose price is closest to what the student chose, and sends the
 * verified Paystack reference so the server can confirm the payment.
 */
export async function createStudentBooking(opts: {
  hostelId: string;
  price: number;
  paymentReference: string;
}) {
  const hostel = await apiFetch<{ ROOM: ApiRoom[] }>(`/hostels/${opts.hostelId}`);
  const rooms = hostel.ROOM.filter((r) => r.is_available);
  if (rooms.length === 0) throw new Error("No rooms are available in this hostel right now.");
  const room = rooms.reduce((best, r) =>
    Math.abs(r.price_per_bed - opts.price) < Math.abs(best.price_per_bed - opts.price) ? r : best,
  );

  return apiFetch<{ id: string }>("/bookings", {
    method: "POST",
    body: JSON.stringify({
      room_id: room.id,
      check_in_date: "2026-01-12T00:00:00.000Z",
      check_out_date: "2026-05-29T00:00:00.000Z",
      payment_reference: opts.paymentReference,
    }),
  });
}
