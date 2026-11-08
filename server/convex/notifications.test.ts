import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

async function scenario(t: ReturnType<typeof convexTest>) {
  const manager = await t.mutation(api.users.create, {
    data: { name: "Kwame", email: `m-${Math.random()}@test.com`, emailVerified: false, user_type: "HOSTEL_MANAGER", profile_complete: true },
    secret,
  });
  const student = await t.mutation(api.users.create, {
    data: { name: "Ama", email: `s-${Math.random()}@test.com`, emailVerified: false, user_type: "STUDENT", profile_complete: true },
    secret,
  });
  const hostel = await t.mutation(api.hostels.create, {
    data: { hostel_name: "Dufie Annex", location: "Berekuso", total_rooms: 0, available_rooms: 0, manager_id: manager.id, status: "PENDING" },
    secret,
  });
  const room = await t.mutation(api.rooms.create, {
    data: { room_number: "A1", room_type: "DOUBLE", price_per_bed: 7000, capacity: 2, hostel_id: hostel.id },
    secret,
  });
  return { manager, student, hostel, room };
}

const list = (t: ReturnType<typeof convexTest>, userId: string) =>
  t.query(api.notifications.listForUser, { userId, secret });

describe("notifications", () => {
  it("a booking notifies the manager and the student, and approval notifies the student", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, room } = await scenario(t);
    const booking = await t.mutation(api.bookings.create, {
      data: {
        check_in_date: Date.now(), check_out_date: Date.now() + 1e9,
        student_id: student.id, room_id: room.id, payment_reference: "KC-1", amount_paid: 8500,
      },
      secret,
    });

    const mgr = await list(t, manager.id);
    expect(mgr).toHaveLength(1);
    expect(mgr[0].title).toBe("New booking request");
    expect(mgr[0].message).toContain("Ama");
    expect(mgr[0].message).toContain("8,500");
    expect(mgr[0].read).toBe(false);

    let stu = await list(t, student.id);
    expect(stu.map((n: any) => n.title)).toEqual(["Payment verified"]);

    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CONFIRMED", secret });
    stu = await list(t, student.id);
    expect(stu[0].title).toBe("Booking approved");
    // the manager is not notified of their own action
    expect(await list(t, manager.id)).toHaveLength(1);
  });

  it("declining a pending booking tells the student it was declined", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, room } = await scenario(t);
    const booking = await t.mutation(api.bookings.create, {
      data: { check_in_date: Date.now(), check_out_date: Date.now() + 1e9, student_id: student.id, room_id: room.id },
      secret,
    });
    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CANCELLED", secret });
    const stu = await list(t, student.id);
    expect(stu[0].type).toBe("booking_declined");
    expect(stu[0].title).toBe("Booking declined");
    expect(stu[0].booking_id).toBe(booking.id);
    expect(stu[0].read).toBe(false);
    expect(await list(t, manager.id)).toHaveLength(1); // only the original request
  });

  it("a student cancelling notifies the manager, not the student", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, room } = await scenario(t);
    const booking = await t.mutation(api.bookings.create, {
      data: { check_in_date: Date.now(), check_out_date: Date.now() + 1e9, student_id: student.id, room_id: room.id },
      secret,
    });
    await t.mutation(api.bookings.updateStatus, { id: booking.id, status: "CANCELLED", byStudent: true, secret });
    expect((await list(t, manager.id))[0].title).toBe("Booking cancelled by student");
    expect(await list(t, student.id)).toHaveLength(1); // only the "submitted" one
  });

  it("only the owner can mark a notification read; mark-all clears the rest", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, room } = await scenario(t);
    await t.mutation(api.bookings.create, {
      data: { check_in_date: Date.now(), check_out_date: Date.now() + 1e9, student_id: student.id, room_id: room.id },
      secret,
    });
    const [n] = await list(t, manager.id);
    expect(await t.mutation(api.notifications.markRead, { id: n.id, userId: student.id, secret })).toBe(false);
    expect((await list(t, manager.id))[0].read).toBe(false);
    expect(await t.mutation(api.notifications.markRead, { id: n.id, userId: manager.id, secret })).toBe(true);
    expect(await t.mutation(api.notifications.markAllRead, { userId: student.id, secret })).toBe(1);
  });

  it("admin approval notifies the hostel's manager", async () => {
    const t = convexTest(schema, modules);
    const { manager, hostel } = await scenario(t);
    await t.mutation(api.hostels.update, { id: hostel.id, patch: { status: "APPROVED" }, secret });
    expect((await list(t, manager.id))[0].title).toBe("Hostel approved");
  });
});
