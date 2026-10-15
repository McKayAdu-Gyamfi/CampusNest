// server/convex/sessions.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

describe("sessions CRUD", () => {
  async function makeUser(t: ReturnType<typeof convexTest>) {
    return t.mutation(api.users.create, {
      data: { name: "Dana", email: "dana@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
      secret,
    });
  }

  it("create then findOne by token returns the session with an id field", async () => {
    const t = convexTest(schema, modules);
    const user = await makeUser(t);
    const created = await t.mutation(api.sessions.create, {
      data: { token: "tok-123", expiresAt: Date.now() + 100000, userId: user.id },
      secret,
    });
    expect(created.id).toBeTruthy();

    const found = await t.query(api.sessions.findOne, { where: [{ field: "token", value: "tok-123" }], secret });
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.userId).toBe(user.id);
  });

  it("findOne returns null for an unknown token (Review Focus #1 — the actual sign-in-rejection path)", async () => {
    const t = convexTest(schema, modules);
    const found = await t.query(api.sessions.findOne, { where: [{ field: "token", value: "does-not-exist" }], secret });
    expect(found).toBeNull();
  });

  it("delete on a non-matching where is a no-op (Review Focus #4)", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.sessions.delete, { where: [{ field: "token", value: "ghost" }], secret })).resolves.not.toThrow();
  });

  it("findOne by token does not leak _id or _creationTime into the returned session", async () => {
    const t = convexTest(schema, modules);
    const user = await makeUser(t);
    await t.mutation(api.sessions.create, {
      data: { token: "tok-leak", expiresAt: Date.now() + 100000, userId: user.id },
      secret,
    });

    const found = await t.query(api.sessions.findOne, { where: [{ field: "token", value: "tok-leak" }], secret });
    expect(found).not.toBeNull();
    expect(found).not.toHaveProperty("_id");
    expect(found).not.toHaveProperty("_creationTime");
    expect(found!.id).toBeTruthy();
  });

  it("findOne throws on an unsupported operator even when the table is empty", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.sessions.findOne, { where: [{ field: "token", value: "x", operator: "gt" }], secret })
    ).rejects.toThrow(/Unsupported where operator/);
  });

  it("findOne rejects a missing/wrong secret (Critical security fix)", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.sessions.findOne, { where: [{ field: "token", value: "tok-123" }], secret: "wrong-secret" })
    ).rejects.toThrow(/unauthorized/i);
  });
});
