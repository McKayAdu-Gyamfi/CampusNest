// server/convex/bookings.ts
import { v, ConvexError } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";

const bookingStatus = v.union(
  v.literal("PENDING"), v.literal("CONFIRMED"), v.literal("CANCELLED"), v.literal("CHECKED_OUT")
);

async function withRelations(ctx: any, booking: any, includeManagerId: boolean) {
  const row = toApiRow(booking);

  const room = await ctx.db.get(booking.room_id);
  if (room) {
    const hostel = await ctx.db.get(room.hostel_id);
    const nestedHostel: Record<string, any> | null = hostel
      ? { hostel_name: hostel.hostel_name }
      : null;
    if (nestedHostel && includeManagerId) nestedHostel.manager_id = hostel!.manager_id ?? null;
    row.ROOM = { room_number: room.room_number, hostel_id: room.hostel_id, HOSTEL: nestedHostel };
  } else {
    row.ROOM = null;
  }

  const student = await ctx.db.get(booking.student_id);
  row.USERS = student ? { email: student.email, profile_complete: student.profile_complete } : null;

  return row;
}

export const list = secureQuery({ studentId: v.optional(v.string()) }, async (ctx, { studentId }) => {
  let rows;
  if (studentId !== undefined) {
    const id = ctx.db.normalizeId("users", studentId);
    if (!id) return [];
    rows = await ctx.db
      .query("bookings")
      .withIndex("by_student_id", (q: any) => q.eq("student_id", id))
      .collect();
  } else {
    rows = await ctx.db.query("bookings").collect();
  }
  return await Promise.all(rows.map((b: any) => withRelations(ctx, b, false)));
});

export const getByIdWithRelations = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const bookingId = ctx.db.normalizeId("bookings", id);
  if (!bookingId) return null;
  const booking = await ctx.db.get(bookingId);
  if (!booking) return null;
  return await withRelations(ctx, booking, true);
});

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  const roomId = ctx.db.normalizeId("rooms", data.room_id);
  if (!roomId) throw new Error("Room not found");
  const studentId = ctx.db.normalizeId("users", data.student_id);
  if (!studentId) throw new Error("Student not found");

  const now = Date.now();
  const bookingId = await ctx.db.insert("bookings", {
    check_in_date: new Date(data.check_in_date).getTime(),
    check_out_date: new Date(data.check_out_date).getTime(),
    status: "PENDING",
    student_id: studentId,
    room_id: roomId,
    created_at: now,
    updated_at: now,
  });
  return toApiRow((await ctx.db.get(bookingId))!);
});

export const updateStatus = secureMutation(
  { id: v.string(), status: bookingStatus },
  async (ctx, { id, status }) => {
    const bookingId = ctx.db.normalizeId("bookings", id);
    if (!bookingId) return null;
    const booking = await ctx.db.get(bookingId);
    if (!booking) return null;

    const previous = booking.status;
    let occupancyChange = 0;
    if (status === "CONFIRMED" && previous !== "CONFIRMED") occupancyChange = 1;
    else if (previous === "CONFIRMED" && status !== "CONFIRMED") {
      // Occupancy counts exactly the CONFIRMED bookings, so any exit releases the bed.
      occupancyChange = -1;
    }

    const room = await ctx.db.get(booking.room_id);

    // Without this, a manager confirming several PENDING bookings for the
    // same room pushes current_occupancy past capacity with nothing to stop it.
    //
    // ConvexError, not Error: the controller maps this to a 409, and Convex
    // redacts a plain Error's message on a prod deployment, which would
    // silently turn that 409 into a generic 400.
    if (occupancyChange === 1 && room && room.current_occupancy + 1 > room.capacity) {
      throw new ConvexError({ code: "ROOM_AT_CAPACITY" });
    }

    const now = Date.now();
    await ctx.db.patch(bookingId, { status, updated_at: now });

    if (occupancyChange !== 0 && room) {
      const newOccupancy = Math.max(0, room.current_occupancy + occupancyChange);
      const newAvailable = newOccupancy < room.capacity;
      await ctx.db.patch(room._id, {
        current_occupancy: newOccupancy,
        is_available: newAvailable,
        updated_at: now,
      });

      if (newAvailable !== room.is_available) {
        const hostel = await ctx.db.get(room.hostel_id);
        if (hostel) {
          await ctx.db.patch(hostel._id, {
            available_rooms: Math.max(0, hostel.available_rooms + (newAvailable ? 1 : -1)),
            updated_at: now,
          });
        }
      }

      // Keep the student's current_room_id in step with their actual
      // confirmed booking — this is the only place that field is set.
      if (occupancyChange === 1) {
        await ctx.db.patch(booking.student_id, { current_room_id: room._id });
      } else {
        const student = await ctx.db.get(booking.student_id);
        if (student && student.current_room_id === room._id) {
          await ctx.db.patch(booking.student_id, { current_room_id: undefined });
        }
      }
    }

    return toApiRow((await ctx.db.get(bookingId))!);
  }
);

export const existsForStudentInRooms = secureQuery(
  {
    studentId: v.string(),
    roomIds: v.array(v.string()),
    statuses: v.optional(v.array(v.string())),
  },
  async (ctx, { studentId, roomIds, statuses }) => {
    const id = ctx.db.normalizeId("users", studentId);
    if (!id || roomIds.length === 0) return false;
    const wanted = new Set(roomIds);
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_student_id", (q: any) => q.eq("student_id", id))
      .collect();
    return rows.some(
      (b: any) => wanted.has(b.room_id) && (statuses === undefined || statuses.includes(b.status))
    );
  }
);
