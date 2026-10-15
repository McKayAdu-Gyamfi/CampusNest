// server/convex/accounts.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

describe("accounts CRUD", () => {
  async function makeUser(t: ReturnType<typeof convexTest>) {
    return t.mutation(api.users.create, {
      data: { name: "Eve", email: "eve@test.com", emailVerified: false, user_type: "STUDENT", profile_complete: false },
      secret,
    });
  }

  it("create then findOne by provider+accountId composite returns the account", async () => {
    const t = convexTest(schema, modules);
    const user = await makeUser(t);
    const created = await t.mutation(api.accounts.create, {
      data: { providerId: "credential", accountId: "eve@test.com", userId: user.id, password: "hashed" },
      secret,
    });
    expect(created.id).toBeTruthy();

    const found = await t.query(api.accounts.findOne, {
      where: [
        { field: "providerId", value: "credential" },
        { field: "accountId", value: "eve@test.com" },
      ],
      secret,
    });
    expect(found).not.toBeNull();
    expect(found!.password).toBe("hashed");
  });

  it("findOne returns null for a provider+accountId pair that doesn't exist (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    const found = await t.query(api.accounts.findOne, {
      where: [
        { field: "providerId", value: "credential" },
        { field: "accountId", value: "nobody@test.com" },
      ],
      secret,
    });
    expect(found).toBeNull();
  });

  it("findMany by userId returns every account for that user", async () => {
    const t = convexTest(schema, modules);
    const user = await makeUser(t);
    await t.mutation(api.accounts.create, { data: { providerId: "credential", accountId: "eve@test.com", userId: user.id }, secret });
    const results = await t.query(api.accounts.findMany, { where: [{ field: "userId", value: user.id }], secret });
    expect(results).toHaveLength(1);
  });

  it("findOne by provider+accountId does not leak _id or _creationTime into the returned account", async () => {
    const t = convexTest(schema, modules);
    const user = await makeUser(t);
    await t.mutation(api.accounts.create, {
      data: { providerId: "credential", accountId: "leak@test.com", userId: user.id, password: "hashed" },
      secret,
    });

    const found = await t.query(api.accounts.findOne, {
      where: [
        { field: "providerId", value: "credential" },
        { field: "accountId", value: "leak@test.com" },
      ],
      secret,
    });
    expect(found).not.toBeNull();
    expect(found).not.toHaveProperty("_id");
    expect(found).not.toHaveProperty("_creationTime");
    expect(found!.id).toBeTruthy();
  });

  it("findOne throws on an unsupported operator even when the table is empty", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.accounts.findOne, { where: [{ field: "accountId", value: "x", operator: "gt" }], secret })
    ).rejects.toThrow(/Unsupported where operator/);
  });

  it("create rejects a duplicate provider+accountId (I1 fix: atomic uniqueness)", async () => {
    const t = convexTest(schema, modules);
    const user = await makeUser(t);
    await t.mutation(api.accounts.create, { data: { providerId: "credential", accountId: "dup@test.com", userId: user.id }, secret });
    await expect(
      t.mutation(api.accounts.create, { data: { providerId: "credential", accountId: "dup@test.com", userId: user.id }, secret })
    ).rejects.toThrow(/already exists/i);
  });

  it("findOne rejects a missing/wrong secret (Critical security fix)", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.accounts.findOne, { where: [{ field: "accountId", value: "x" }], secret: "wrong-secret" })
    ).rejects.toThrow(/unauthorized/i);
  });
});
