// server/convex/users.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

describe("users CRUD", () => {
  it("create then findOne by email returns the created user with an id field", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.users.create, {
      data: { name: "Alice", email: "alice@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
    });
    expect(created.id).toBeTruthy();

    const found = await t.query(api.users.findOne, { where: [{ field: "email", value: "alice@test.com" }] });
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.name).toBe("Alice");
  });

  it("findOne returns null when nothing matches (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    const found = await t.query(api.users.findOne, { where: [{ field: "email", value: "nobody@test.com" }] });
    expect(found).toBeNull();
  });

  it("findOne by id uses ctx.db.get", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.users.create, {
      data: { name: "Bob", email: "bob@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
    });
    const found = await t.query(api.users.findOne, { where: [{ field: "id", value: created.id }] });
    expect(found!.email).toBe("bob@test.com");
  });

  it("update patches only the given fields", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.users.create, {
      data: { name: "Carol", email: "carol@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
    });
    await t.mutation(api.users.update, {
      where: [{ field: "email", value: "carol@test.com" }],
      update: { profile_complete: true },
    });
    const found = await t.query(api.users.findOne, { where: [{ field: "email", value: "carol@test.com" }] });
    expect(found!.profile_complete).toBe(true);
    expect(found!.name).toBe("Carol");
  });

  it("update on a non-matching where is a no-op, not a crash (Review Focus #4)", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.users.update, { where: [{ field: "email", value: "ghost@test.com" }], update: { profile_complete: true } })
    ).resolves.not.toThrow();
  });

  it("delete on a non-matching where is a no-op, not a crash (Review Focus #4)", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.users.delete, { where: [{ field: "email", value: "ghost@test.com" }] })).resolves.not.toThrow();
  });

  it("findOne throws on an unsupported operator (Review Focus #2)", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.users.findOne, { where: [{ field: "email", value: "x", operator: "contains" }] })
    ).rejects.toThrow(/unsupported where operator/i);
  });
});
