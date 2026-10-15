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
});
