import { v } from "convex/values";
import { secureQuery } from "./lib/secureFunction";

// Dashboard figures, all derived from stored rows at read time. Nothing here
// is cached or stored, so the numbers cannot drift from the bookings/rooms
// they summarise.
//
// Revenue = sum of the amount paid (else the room's price_per_bed) over CONFIRMED and CHECKED_OUT
// bookings, attributed to the UTC month the booking was CREATED ("bookings
// taken that month", not "stays served"). UTC equals Ghana time (GMT, no
// daylight saving).

const EARNING = new Set(["CONFIRMED", "CHECKED_OUT"]);
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(ms: number) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(asOf: number, count: number) {
  const d = new Date(asOf);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push({ key: monthKey(m.getTime()), label: MONTH_NAMES[m.getUTCMonth()] });
  }
  return out;
}

async function roomsOf(ctx: any, hostelId: any) {
  return await ctx.db
    .query("rooms")
    .withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", hostelId))
    .collect();
}

async function bookingsOfRoom(ctx: any, roomId: any) {
  return await ctx.db
    .query("bookings")
    .withIndex("by_room_id", (q: any) => q.eq("room_id", roomId))
    .collect();
}

// Walks hostels → rooms → bookings once and returns everything the
// dashboards need about that set of hostels.
async function gather(ctx: any, hostels: any[]) {
  const roomById = new Map<string, any>();
  const hostelById = new Map<string, any>();
  const perHostel: any[] = [];
  const bookings: any[] = [];

  for (const h of hostels) {
    hostelById.set(h._id, h);
    const rooms = await roomsOf(ctx, h._id);
    let total = 0;
    let filled = 0;
    let roomsFull = 0;
    for (const r of rooms) {
      roomById.set(r._id, r);
      total += r.capacity;
      filled += r.current_occupancy;
      if (r.current_occupancy >= r.capacity) roomsFull++;
      bookings.push(...(await bookingsOfRoom(ctx, r._id)));
    }
    perHostel.push({
      hostel_id: h._id,
      hostel_name: h.hostel_name,
      status: h.status,
      beds_total: total,
      beds_filled: filled,
      occupancy_rate: total === 0 ? 0 : filled / total,
      rooms_total: rooms.length,
      rooms_full: roomsFull,
    });
  }
  return { roomById, hostelById, perHostel, bookings };
}

// What the student actually paid; falls back to the room's price for
// bookings made before payments were recorded.
function amountOf(booking: any, roomById: Map<string, any>) {
  return booking.amount_paid ?? roomById.get(booking.room_id)?.price_per_bed ?? 0;
}

function revenueByMonth(bookings: any[], roomById: Map<string, any>) {
  const byMonth = new Map<string, number>();
  for (const b of bookings) {
    if (!EARNING.has(b.status)) continue;
    const key = monthKey(createdAt(b));
    byMonth.set(key, (byMonth.get(key) ?? 0) + amountOf(b, roomById));
  }
  return byMonth;
}

function createdAt(b: any) {
  return b.created_at ?? b._creationTime;
}

export const managerOverview = secureQuery(
  { managerId: v.string(), asOf: v.optional(v.number()), recentLimit: v.optional(v.number()) },
  async (ctx, { managerId, asOf, recentLimit }) => {
    const now = asOf ?? Date.now();
    const mid = ctx.db.normalizeId("users", managerId);
    const hostels = mid
      ? await ctx.db
          .query("hostels")
          .withIndex("by_manager_id", (q: any) => q.eq("manager_id", mid))
          .collect()
      : [];

    const { roomById, hostelById, perHostel, bookings } = await gather(ctx, hostels);

    // Occupancy describes the listings students can actually book: a
    // rejected or still-pending hostel must not dilute or inflate it.
    const live = perHostel.filter((h) => h.status === "APPROVED");
    const bedsTotal = live.reduce((s, h) => s + h.beds_total, 0);
    const bedsFilled = live.reduce((s, h) => s + h.beds_filled, 0);
    const roomsTotal = live.reduce((s, h) => s + h.rooms_total, 0);
    const roomsFull = live.reduce((s, h) => s + h.rooms_full, 0);

    const thisMonth = monthKey(now);
    let revenueThisMonth = 0;
    for (const b of bookings) {
      if (EARNING.has(b.status) && monthKey(createdAt(b)) === thisMonth) {
        revenueThisMonth += amountOf(b, roomById);
      }
    }

    const recent = [...bookings]
      .sort((a, b) => createdAt(b) - createdAt(a))
      .slice(0, recentLimit ?? 4);
    const recentRows = [];
    for (const b of recent) {
      const student = await ctx.db.get(b.student_id);
      const room = roomById.get(b.room_id);
      recentRows.push({
        id: b._id,
        status: b.status,
        student_name: student?.name ?? null,
        student_email: student?.email ?? null,
        room_number: room?.room_number ?? null,
        hostel_name: room ? hostelById.get(room.hostel_id)?.hostel_name ?? null : null,
        amount: amountOf(b, roomById),
        created_at: new Date(createdAt(b)).toISOString(),
      });
    }

    return {
      month: MONTH_NAMES[new Date(now).getUTCMonth()],
      beds_total: bedsTotal,
      beds_filled: bedsFilled,
      occupancy_rate: bedsTotal === 0 ? 0 : bedsFilled / bedsTotal,
      rooms_total: roomsTotal,
      rooms_full: roomsFull,
      revenue_this_month: revenueThisMonth,
      pending_bookings: bookings.filter((b) => b.status === "PENDING").length,
      recent_bookings: recentRows,
      hostels: live,
    };
  }
);

export const adminOverview = secureQuery(
  { asOf: v.optional(v.number()), months: v.optional(v.number()) },
  async (ctx, { asOf, months }) => {
    const now = asOf ?? Date.now();
    const hostels = await ctx.db.query("hostels").collect();
    const { roomById, perHostel, bookings } = await gather(ctx, hostels);

    const byMonth = revenueByMonth(bookings, roomById);
    const series = lastMonths(now, months ?? 7).map((m) => ({
      month: m.label,
      key: m.key,
      revenue: byMonth.get(m.key) ?? 0,
    }));

    let revenueTotal = 0;
    for (const b of bookings) if (EARNING.has(b.status)) revenueTotal += amountOf(b, roomById);

    // Top hostels: APPROVED only, ranked by earning bookings, ties by name.
    const earningByHostel = new Map<string, number>();
    for (const b of bookings) {
      if (!EARNING.has(b.status)) continue;
      const room = roomById.get(b.room_id);
      if (room) earningByHostel.set(room.hostel_id, (earningByHostel.get(room.hostel_id) ?? 0) + 1);
    }
    const topHostels = perHostel
      .filter((h) => h.status === "APPROVED")
      .map((h) => ({ ...h, bookings: earningByHostel.get(h.hostel_id) ?? 0 }))
      .sort((a, b) => b.bookings - a.bookings || a.hostel_name.localeCompare(b.hostel_name))
      .slice(0, 5);

    const pending = [];
    for (const h of hostels.filter((x: any) => x.status === "PENDING")) {
      const manager = h.manager_id ? await ctx.db.get(h.manager_id) : null;
      pending.push({
        id: h._id,
        hostel_name: h.hostel_name,
        location: h.location,
        manager_name: manager?.name ?? null,
        manager_email: manager?.email ?? null,
        created_at: new Date(h.created_at).toISOString(),
      });
    }

    const users = await ctx.db.query("users").collect();
    const countType = (t: string) => users.filter((u: any) => u.user_type === t).length;

    return {
      revenue_total: revenueTotal,
      revenue_this_month: byMonth.get(monthKey(now)) ?? 0,
      revenue_by_month: series,
      pending_approvals: pending,
      top_hostels: topHostels,
      counts: {
        students: countType("STUDENT"),
        managers: countType("HOSTEL_MANAGER"),
        admins: countType("ADMIN"),
        hostels: hostels.length,
        approved_hostels: hostels.filter((h: any) => h.status === "APPROVED").length,
        bookings: bookings.length,
      },
    };
  }
);
