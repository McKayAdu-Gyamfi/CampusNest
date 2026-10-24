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
  it("create persists the supplied hostel_manager_id and forces status OPEN", async () => {
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

  it("list nests USERS and HOSTEL", async () => {
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
    expect(await t.query(api.complaints.list, { studentId: "bogus", secret })).toEqual([]);
  });

  it("list filters by every combination the controller can send", async () => {
    const t = convexTest(schema, modules);
    const mk = (name: string, type: string) =>
      t.mutation(api.users.create, {
        data: { name, email: `${name}-${Math.random()}@test.com`, emailVerified: false,
                user_type: type, profile_complete: true },
        secret,
      });
    const mgrA = await mk("A", "HOSTEL_MANAGER");
    const mgrB = await mk("B", "HOSTEL_MANAGER");
    const s1 = await mk("s1", "STUDENT");
    const s2 = await mk("s2", "STUDENT");
    const mkHostel = (name: string, managerId: string) =>
      t.mutation(api.hostels.create, {
        data: { hostel_name: name, location: "N", total_rooms: 0, available_rooms: 0,
                manager_id: managerId, status: "APPROVED" },
        secret,
      });
    const hShared = await mkHostel("Shared", mgrA.id);
    const hOther = await mkHostel("Other", mgrB.id);
    const mkC = async (content: string, student: any, hostel: any, mgr: any) =>
      (await t.mutation(api.complaints.create, {
        data: { content, student_id: student.id, hostel_id: hostel.id, hostel_manager_id: mgr.id },
        secret,
      })).content as string;
    // Both managers have a complaint against the SAME hostel.
    await mkC("s1-shared-A", s1, hShared, mgrA);
    await mkC("s2-shared-A", s2, hShared, mgrA);
    await mkC("s1-shared-B", s1, hShared, mgrB);
    await mkC("s1-other-B", s1, hOther, mgrB);
    await mkC("s2-other-B", s2, hOther, mgrB);
    const names = async (args: any) =>
      ((await t.query(api.complaints.list, { ...args, secret })) as any[])
        .map((r) => r.content).sort();

    // cross-manager leak guard
    expect(await names({ hostelId: hShared.id, hostelManagerId: mgrA.id }))
      .toEqual(["s1-shared-A", "s2-shared-A"]);
    expect(await names({ hostelId: hShared.id, hostelManagerId: mgrB.id }))
      .toEqual(["s1-shared-B"]);
    expect(await names({ hostelId: hShared.id, studentId: s1.id }))
      .toEqual(["s1-shared-A", "s1-shared-B"]);
    expect(await names({ studentId: s1.id, hostelManagerId: mgrB.id }))
      .toEqual(["s1-other-B", "s1-shared-B"]);
    expect(await names({ studentId: s2.id, hostelManagerId: mgrA.id }))
      .toEqual(["s2-shared-A"]);
    expect(await names({ hostelManagerId: mgrA.id }))
      .toEqual(["s1-shared-A", "s2-shared-A"]);
    expect(await names({ studentId: s1.id }))
      .toEqual(["s1-other-B", "s1-shared-A", "s1-shared-B"]);
    // hostel alone is deliberately unnarrowed: both managers' rows
    expect(await names({ hostelId: hShared.id }))
      .toEqual(["s1-shared-A", "s1-shared-B", "s2-shared-A"]);
    // all three
    expect(await names({ hostelId: hShared.id, studentId: s1.id, hostelManagerId: mgrA.id }))
      .toEqual(["s1-shared-A"]);
  });

  it("getByIdWithUser returns the complaint with USERS, or null for a malformed id", async () => {
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
