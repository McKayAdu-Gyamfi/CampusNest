import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

async function scenario(t: ReturnType<typeof convexTest>) {
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
  return { manager, student, hostel };
}

describe("reviews", () => {
  it("create stores a review and listByHostel nests USERS.email", async () => {
    const t = convexTest(schema, modules);
    const { student, hostel } = await scenario(t);
    const review = await t.mutation(api.reviews.create, {
      data: { rating: 5, comment: "Great", student_id: student.id, hostel_id: hostel.id },
      secret,
    });
    expect(review.rating).toBe(5);
    expect(typeof review.created_at).toBe("string");

    const rows = await t.query(api.reviews.listByHostel, { hostelId: hostel.id, secret });
    expect(rows).toHaveLength(1);
    expect(rows[0].USERS).toEqual({ email: student.email });

    expect(await t.query(api.reviews.listByHostel, { secret })).toHaveLength(1);
    expect(await t.query(api.reviews.listByHostel, { hostelId: "bogus", secret })).toEqual([]);
  });

  it("create rejects a rating outside 1-5", async () => {
    const t = convexTest(schema, modules);
    const { student, hostel } = await scenario(t);
    for (const rating of [0, 6, -1]) {
      await expect(
        t.mutation(api.reviews.create, {
          data: { rating, student_id: student.id, hostel_id: hostel.id }, secret,
        })
      ).rejects.toThrow(/rating must be between 1 and 5/i);
    }
  });

  it("create rejects a malformed hostel id", async () => {
    const t = convexTest(schema, modules);
    const { student } = await scenario(t);
    await expect(
      t.mutation(api.reviews.create, {
        data: { rating: 4, student_id: student.id, hostel_id: "bogus" }, secret,
      })
    ).rejects.toThrow(/hostel not found/i);
  });
});

describe("complaints", () => {
  it("create stores a complaint with OPEN status and the hostel's manager", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, hostel } = await scenario(t);
    const complaint = await t.mutation(api.complaints.create, {
      data: { content: "No water", student_id: student.id, hostel_id: hostel.id,
              hostel_manager_id: manager.id },
      secret,
    });
    expect(complaint.status).toBe("OPEN");
    expect(complaint.hostel_manager_id).toBe(manager.id);
    expect(typeof complaint.created_at).toBe("string");
  });

  it("list nests USERS and HOSTEL and filters by student, hostel and manager", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, hostel } = await scenario(t);
    await t.mutation(api.complaints.create, {
      data: { content: "No water", student_id: student.id, hostel_id: hostel.id,
              hostel_manager_id: manager.id },
      secret,
    });

    const rows = await t.query(api.complaints.list, { secret });
    expect(rows).toHaveLength(1);
    expect(rows[0].USERS).toEqual({ email: student.email, profile_complete: true });
    expect(rows[0].HOSTEL).toEqual({ hostel_name: "Unity Hall" });

    expect(await t.query(api.complaints.list, { studentId: student.id, secret })).toHaveLength(1);
    expect(await t.query(api.complaints.list, { hostelId: hostel.id, secret })).toHaveLength(1);
    expect(await t.query(api.complaints.list, { hostelManagerId: manager.id, secret })).toHaveLength(1);
    expect(await t.query(api.complaints.list, { studentId: "bogus", secret })).toEqual([]);
  });

  it("getByIdWithUser returns the complaint with USERS, or null for a malformed id (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, hostel } = await scenario(t);
    const complaint = await t.mutation(api.complaints.create, {
      data: { content: "Noise", student_id: student.id, hostel_id: hostel.id,
              hostel_manager_id: manager.id },
      secret,
    });

    const row = await t.query(api.complaints.getByIdWithUser, { id: complaint.id, secret });
    expect(row!.USERS.email).toBe(student.email);
    expect(row!.hostel_manager_id).toBe(manager.id);
    expect(await t.query(api.complaints.getByIdWithUser, { id: "123", secret })).toBeNull();
  });

  it("updateStatus patches the status and returns null for a malformed id", async () => {
    const t = convexTest(schema, modules);
    const { manager, student, hostel } = await scenario(t);
    const complaint = await t.mutation(api.complaints.create, {
      data: { content: "Noise", student_id: student.id, hostel_id: hostel.id,
              hostel_manager_id: manager.id },
      secret,
    });

    const updated = await t.mutation(api.complaints.updateStatus, {
      id: complaint.id, status: "RESOLVED", secret,
    });
    expect(updated!.status).toBe("RESOLVED");
    expect(
      await t.mutation(api.complaints.updateStatus, { id: "123", status: "RESOLVED", secret })
    ).toBeNull();
  });
});
