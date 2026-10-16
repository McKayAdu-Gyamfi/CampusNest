// server/convex/users.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
// Every function now requires this (Critical fix: all 20 Convex functions
// were public and unauthenticated — see lib/secureFunction.ts). tests/setup.js
// loads it via loadEnv.js before any test file runs.
const secret = process.env.CONVEX_ADAPTER_SECRET;

describe("users CRUD", () => {
  it("create then findOne by email returns the created user with an id field", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.users.create, {
      data: { name: "Alice", email: "alice@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
      secret,
    });
    expect(created.id).toBeTruthy();

    const found = await t.query(api.users.findOne, { where: [{ field: "email", value: "alice@test.com" }], secret });
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.name).toBe("Alice");
  });

  it("findOne's returned object has no raw _id/_creationTime alongside id (Important fix)", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.users.create, {
      data: { name: "Frank", email: "frank@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
      secret,
    });
    const found = await t.query(api.users.findOne, { where: [{ field: "email", value: "frank@test.com" }], secret });
    expect(found).not.toBeNull();
    expect(found).not.toHaveProperty("_id");
    expect(found).not.toHaveProperty("_creationTime");
    expect(found!.id).toBeTruthy();
  });

  it("findOne returns null when nothing matches (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    const found = await t.query(api.users.findOne, { where: [{ field: "email", value: "nobody@test.com" }], secret });
    expect(found).toBeNull();
  });

  it("findOne by id uses ctx.db.get", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.users.create, {
      data: { name: "Bob", email: "bob@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
      secret,
    });
    const found = await t.query(api.users.findOne, { where: [{ field: "id", value: created.id }], secret });
    expect(found!.email).toBe("bob@test.com");
  });

  it("update patches only the given fields", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.users.create, {
      data: { name: "Carol", email: "carol@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
      secret,
    });
    await t.mutation(api.users.update, {
      where: [{ field: "email", value: "carol@test.com" }],
      update: { profile_complete: true },
      secret,
    });
    const found = await t.query(api.users.findOne, { where: [{ field: "email", value: "carol@test.com" }], secret });
    expect(found!.profile_complete).toBe(true);
    expect(found!.name).toBe("Carol");
  });

  it("update on a non-matching where is a no-op, not a crash (Review Focus #4)", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.users.update, { where: [{ field: "email", value: "ghost@test.com" }], update: { profile_complete: true }, secret })
    ).resolves.not.toThrow();
  });

  it("delete on a non-matching where is a no-op, not a crash (Review Focus #4)", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.users.delete, { where: [{ field: "email", value: "ghost@test.com" }], secret })).resolves.not.toThrow();
  });

  it("findOne throws on an unsupported operator (Review Focus #2)", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.users.findOne, { where: [{ field: "email", value: "x", operator: "contains" }], secret })
    ).rejects.toThrow(/unsupported where operator/i);
  });

  it("findOne rejects a missing/wrong secret (Critical security fix)", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.users.findOne, { where: [{ field: "email", value: "alice@test.com" }], secret: "wrong-secret" })
    ).rejects.toThrow(/unauthorized/i);
  });

  it("getMeWithRoom returns the user with a null ROOM when no current room", async () => {
    const t = convexTest(schema, modules);
    const user = await t.mutation(api.users.create, {
      data: { name: "Ama", email: "ama@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
      secret,
    });
    const me = await t.query(api.users.getMeWithRoom, { id: user.id, secret });
    expect(me).not.toBeNull();
    expect(me!.email).toBe("ama@test.com");
    expect(me!.ROOM).toBeNull();
  });

  it("getMeWithRoom nests ROOM.HOSTEL.hostel_name for a student with a current room", async () => {
    const t = convexTest(schema, modules);
    const user = await t.mutation(api.users.create, {
      data: { name: "Ama", email: "ama2@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
      secret,
    });
    const ids = await t.run(async (ctx) => {
      const hostelId = await ctx.db.insert("hostels", {
        hostel_name: "Unity Hall", location: "North Campus", total_rooms: 1, available_rooms: 1,
        status: "APPROVED", created_at: Date.now(), updated_at: Date.now(),
      });
      const roomId = await ctx.db.insert("rooms", {
        room_number: "A1", room_type: "SINGLE", price_per_bed: 400, capacity: 1,
        current_occupancy: 0, is_available: true, hostel_id: hostelId,
        created_at: Date.now(), updated_at: Date.now(),
      });
      await ctx.db.patch(ctx.db.normalizeId("users", user.id)!, { current_room_id: roomId });
      return { roomId };
    });

    const me = await t.query(api.users.getMeWithRoom, { id: user.id, secret });
    expect(me!.ROOM.room_number).toBe("A1");
    expect(me!.ROOM.HOSTEL.hostel_name).toBe("Unity Hall");
    expect(ids.roomId).toBeTruthy();
  });

  it("getMeWithRoom returns null for a malformed id instead of throwing (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    const me = await t.query(api.users.getMeWithRoom, { id: "not-a-real-id", secret });
    expect(me).toBeNull();
  });

  it("getProfileComplete reports the flag, and null for an unknown user", async () => {
    const t = convexTest(schema, modules);
    const user = await t.mutation(api.users.create, {
      data: { name: "Kojo", email: "kojo@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: true },
      secret,
    });
    expect(await t.query(api.users.getProfileComplete, { id: user.id, secret })).toEqual({ profile_complete: true });
    expect(await t.query(api.users.getProfileComplete, { id: "bogus", secret })).toBeNull();
  });

  it("updateProfile patches only the given fields and returns ISO timestamps", async () => {
    const t = convexTest(schema, modules);
    const user = await t.mutation(api.users.create, {
      data: { name: "Esi", email: "esi@test.com", emailVerified: false, user_type: "STUDENT",
              profile_complete: false, createdAt: Date.now(), updatedAt: Date.now() },
      secret,
    });
    const updated = await t.mutation(api.users.updateProfile, {
      id: user.id, patch: { student_id: "UG-123", course: "CS", profile_complete: true }, secret,
    });
    expect(updated!.student_id).toBe("UG-123");
    expect(updated!.name).toBe("Esi");
    expect(typeof updated!.createdAt).toBe("string");
  });

  async function mkUser(t: any, email: string) {
    return await t.mutation(api.users.create, {
      data: { name: "U", email, emailVerified: false, user_type: "STUDENT", profile_complete: false },
      secret,
    });
  }
  async function mkRoom(t: any) {
    return await t.run(async (ctx: any) => {
      const hostelId = await ctx.db.insert("hostels", {
        hostel_name: "H", location: "L", total_rooms: 1, available_rooms: 1,
        status: "APPROVED", created_at: Date.now(), updated_at: Date.now(),
      });
      return await ctx.db.insert("rooms", {
        room_number: "A1", room_type: "SINGLE", price_per_bed: 1, capacity: 1,
        current_occupancy: 0, is_available: true, hostel_id: hostelId,
        created_at: Date.now(), updated_at: Date.now(),
      });
    });
  }

  it("updateProfile drops unknown keys instead of throwing", async () => {
    const t = convexTest(schema, modules);
    const user = await mkUser(t, "drop@test.com");
    const updated = await t.mutation(api.users.updateProfile, {
      id: user.id, patch: { phone: "123", bogus: 1, course: "CS" }, secret,
    });
    expect(updated!.course).toBe("CS");
    expect((updated as any).phone).toBeUndefined();
  });

  it("updateProfile accepts a valid current_room_id and clears it with null", async () => {
    const t = convexTest(schema, modules);
    const user = await mkUser(t, "room@test.com");
    const roomId = await mkRoom(t);
    const set = await t.mutation(api.users.updateProfile, { id: user.id, patch: { current_room_id: roomId }, secret });
    expect(set!.current_room_id).toBe(roomId);
    const cleared = await t.mutation(api.users.updateProfile, { id: user.id, patch: { current_room_id: null }, secret });
    expect(cleared!.current_room_id).toBeUndefined();
  });

  it("updateProfile throws Room not found for a malformed current_room_id", async () => {
    const t = convexTest(schema, modules);
    const user = await mkUser(t, "badroom@test.com");
    await expect(
      t.mutation(api.users.updateProfile, { id: user.id, patch: { current_room_id: "nope" }, secret })
    ).rejects.toThrow(/Room not found/);
  });
});
