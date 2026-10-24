import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

async function scenario(t: ReturnType<typeof convexTest>, roomOverrides: any = {}) {
  const manager = await t.mutation(api.users.create, {
    data: { name: "Mgr", email: `mgr-${Math.random()}@test.com`, emailVerified: false,
            user_type: "HOSTEL_MANAGER", profile_complete: true },
    secret,
  });
  const student = await t.mutation(api.users.create, {
    data: { name: "Ama", email: `ama-${Math.random()}@test.com`, emailVerified: false,
            user_type: "STUDENT", profile_complete: true },
    secret,
  });
  const hostel = await t.mutation(api.hostels.create, {
    data: { hostel_name: "Unity Hall", location: "North", total_rooms: 0, available_rooms: 0,
            manager_id: manager.id, status: "APPROVED" },
    secret,
  });
  const room = await t.mutation(api.rooms.create, {
    data: { room_number: "A1", room_type: "DOUBLE", price_per_bed: 400, capacity: 2,
            hostel_id: hostel.id, ...roomOverrides },
    secret,
  });
  return { manager, student, hostel, room };
}

async function book(t: ReturnType<typeof convexTest>, studentId: string, roomId: string) {
  return await t.mutation(api.bookings.create, {
    data: {
      check_in_date: new Date("2026-11-01").getTime(),
      check_out_date: new Date("2026-12-01").getTime(),
      student_id: studentId, room_id: roomId,
    },
    secret,
  });
}

describe("bookings", () => {
  it("create forces PENDING and returns ISO dates", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    const booking = await book(t, student.id, room.id);
    expect(booking.status).toBe("PENDING");
    expect(typeof booking.check_in_date).toBe("string");
    expect(typeof booking.created_at).toBe("string");
  });

  it("create rejects a malformed room or student id", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    await expect(book(t, student.id, "bogus")).rejects.toThrow(/room not found/i);
    await expect(book(t, "bogus", room.id)).rejects.toThrow(/student not found/i);
  });

  it("list nests ROOM.HOSTEL and USERS, and filters by student", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    await book(t, student.id, room.id);

    const all = await t.query(api.bookings.list, { secret });
    expect(all).toHaveLength(1);
    expect(all[0].ROOM.room_number).toBe("A1");
    expect(all[0].ROOM.HOSTEL.hostel_name).toBe("Unity Hall");
    expect(all[0].USERS.email).toBe(student.email);
    expect(all[0].USERS.profile_complete).toBe(true);

    expect(await t.query(api.bookings.list, { studentId: student.id, secret })).toHaveLength(1);
    expect(await t.query(api.bookings.list, { studentId: "bogus", secret })).toEqual([]);
  });

  it("getByIdWithRelations includes HOSTEL.manager_id for the ownership check", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, room } = await scenario(t);
    const booking = await book(t, student.id, room.id);

    const row = await t.query(api.bookings.getByIdWithRelations, { id: booking.id, secret });
    expect(row!.ROOM.HOSTEL.manager_id).toBe(manager.id);
    expect(row!.student_id).toBe(student.id);
    expect(await t.query(api.bookings.getByIdWithRelations, { id: "123", secret })).toBeNull();
  });

  it("confirming increments occupancy and sets the student's current_room_id", async () => {
    const t = convexTest(schema, modules);
    const { student, room, hostel } = await scenario(t);
    const booking = await book(t, student.id, room.id);

    const confirmed = await t.mutation(api.bookings.updateStatus, {
      id: booking.id, status: "CONFIRMED", secret,
    });
    expect(confirmed!.status).toBe("CONFIRMED");

    const basics = await t.query(api.rooms.getBasics, { id: room.id, secret });
    expect(basics!.current_occupancy).toBe(1);
    expect(basics!.is_available).toBe(true);

    const me = await t.query(api.users.getMeWithRoom, { id: student.id, secret });
    expect(me!.ROOM.room_number).toBe("A1");

    const h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.available_rooms).toBe(1);
  });

  it("cancelling a confirmed booking decrements occupancy and clears current_room_id", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    const booking = await book(t, student.id, room.id);
    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CONFIRMED", secret });
    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CANCELLED", secret });

    const basics = await t.query(api.rooms.getBasics, { id: room.id, secret });
    expect(basics!.current_occupancy).toBe(0);

    const me = await t.query(api.users.getMeWithRoom, { id: student.id, secret });
    expect(me!.ROOM).toBeNull();
  });

  it("filling a room flips is_available and decrements the hostel's available_rooms", async () => {
    const t = convexTest(schema, modules);
    const { student, room, hostel } = await scenario(t, { capacity: 1 });
    const booking = await book(t, student.id, room.id);
    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CONFIRMED", secret });

    const basics = await t.query(api.rooms.getBasics, { id: room.id, secret });
    expect(basics!.is_available).toBe(false);

    const h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.available_rooms).toBe(0);
  });

  it("refuses to confirm into a full room and never exceeds capacity (Review Focus #4)", async () => {
    const t = convexTest(schema, modules);
    const { student, room, hostel } = await scenario(t, { capacity: 1 });
    const first = await book(t, student.id, room.id);
    const second = await book(t, student.id, room.id);

    await t.mutation(api.bookings.updateStatus, { id: first.id, status: "CONFIRMED", secret });
    await expect(
      t.mutation(api.bookings.updateStatus, { id: second.id, status: "CONFIRMED", secret })
    ).rejects.toMatchObject({ data: { code: "ROOM_AT_CAPACITY" } });

    const basics = await t.query(api.rooms.getBasics, { id: room.id, secret });
    expect(basics!.current_occupancy).toBe(1);

    // Nothing was partially applied by the rejected call.
    const after = await t.query(api.bookings.getByIdWithRelations, { id: second.id, secret });
    expect(after!.status).toBe("PENDING");
    const h = await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret });
    expect(h!.available_rooms).toBe(0);
    const me = await t.query(api.users.getMeWithRoom, { id: student.id, secret });
    expect(me!.ROOM.room_number).toBe("A1");
  });

  it("confirming twice does not double-count occupancy", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    const booking = await book(t, student.id, room.id);
    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CONFIRMED", secret });
    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CONFIRMED", secret });

    const basics = await t.query(api.rooms.getBasics, { id: room.id, secret });
    expect(basics!.current_occupancy).toBe(1);
  });

  it("updateStatus returns null for a malformed id (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    expect(await t.mutation(api.bookings.updateStatus, { id: "123", status: "CANCELLED", secret })).toBeNull();
  });

  it("existsForStudentInRooms respects the room set and the status filter", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    const booking = await book(t, student.id, room.id);

    expect(await t.query(api.bookings.existsForStudentInRooms, {
      studentId: student.id, roomIds: [room.id], secret,
    })).toBe(true);

    expect(await t.query(api.bookings.existsForStudentInRooms, {
      studentId: student.id, roomIds: [room.id], statuses: ["CONFIRMED", "CHECKED_OUT"], secret,
    })).toBe(false);

    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CONFIRMED", secret });
    expect(await t.query(api.bookings.existsForStudentInRooms, {
      studentId: student.id, roomIds: [room.id], statuses: ["CONFIRMED", "CHECKED_OUT"], secret,
    })).toBe(true);

    expect(await t.query(api.bookings.existsForStudentInRooms, {
      studentId: student.id, roomIds: [], secret,
    })).toBe(false);
    expect(await t.query(api.bookings.existsForStudentInRooms, {
      studentId: "bogus", roomIds: [room.id], secret,
    })).toBe(false);
  });

  const occ = async (t: any, roomId: string) =>
    (await t.query(api.rooms.getBasics, { id: roomId, secret }))!.current_occupancy;
  const setStatus = (t: any, id: string, status: any) =>
    t.mutation(api.bookings.updateStatus, { id, status, secret });

  it("releasing a booking on a full room restores availability (+1 on the hostel)", async () => {
    const t = convexTest(schema, modules);
    const { student, room, hostel } = await scenario(t, { capacity: 1 });
    const b = await book(t, student.id, room.id);
    await setStatus(t, b.id, "CONFIRMED");
    expect((await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret }))!.available_rooms).toBe(0);
    await setStatus(t, b.id, "CANCELLED");
    expect((await t.query(api.rooms.getBasics, { id: room.id, secret }))!.is_available).toBe(true);
    expect((await t.query(api.hostels.getByIdWithRelations, { id: hostel.id, secret }))!.available_rooms).toBe(1);
  });

  it("CONFIRMED -> PENDING releases the bed, and re-confirming counts exactly once", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    const b = await book(t, student.id, room.id);
    await setStatus(t, b.id, "CONFIRMED");
    await setStatus(t, b.id, "PENDING");
    expect(await occ(t, room.id)).toBe(0);
    expect((await t.query(api.users.getMeWithRoom, { id: student.id, secret }))!.ROOM).toBeNull();
    await setStatus(t, b.id, "CONFIRMED");
    expect(await occ(t, room.id)).toBe(1);
  });

  it("CONFIRMED -> CHECKED_OUT decrements occupancy", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    const b = await book(t, student.id, room.id);
    await setStatus(t, b.id, "CONFIRMED");
    await setStatus(t, b.id, "CHECKED_OUT");
    expect(await occ(t, room.id)).toBe(0);
  });

  it("non-confirmed exits do not decrement occupancy", async () => {
    const t = convexTest(schema, modules);
    const { student, room } = await scenario(t);
    const kept = await book(t, student.id, room.id);
    await setStatus(t, kept.id, "CONFIRMED");
    const other = await book(t, student.id, room.id);
    await setStatus(t, other.id, "CANCELLED");
    expect(await occ(t, room.id)).toBe(1);
    await setStatus(t, other.id, "CANCELLED");
    expect(await occ(t, room.id)).toBe(1);
  });

  it("releasing a booking does not clear current_room_id pointing at another room", async () => {
    const t = convexTest(schema, modules);
    const { student, room, hostel } = await scenario(t);
    const roomB = await t.mutation(api.rooms.create, {
      data: { room_number: "B1", room_type: "DOUBLE", price_per_bed: 400, capacity: 2, hostel_id: hostel.id },
      secret,
    });
    const b = await book(t, student.id, room.id);
    await setStatus(t, b.id, "CONFIRMED");
    await t.mutation(api.users.updateProfile, { id: student.id, patch: { current_room_id: roomB.id }, secret });
    await setStatus(t, b.id, "CANCELLED");
    expect((await t.query(api.users.getMeWithRoom, { id: student.id, secret }))!.ROOM.room_number).toBe("B1");
  });
});
