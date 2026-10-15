// server/convex/verifications.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET;

describe("verifications CRUD", () => {
  it("create then findOne by identifier returns the verification", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.verifications.create, {
      data: { identifier: "reset:eve@test.com", value: "otp-123", expiresAt: Date.now() + 100000 },
      secret,
    });
    expect(created.id).toBeTruthy();

    const found = await t.query(api.verifications.findOne, { where: [{ field: "identifier", value: "reset:eve@test.com" }], secret });
    expect(found).not.toBeNull();
    expect(found!.value).toBe("otp-123");
  });

  it("findOne returns null for an unknown identifier (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    const found = await t.query(api.verifications.findOne, { where: [{ field: "identifier", value: "nothing" }], secret });
    expect(found).toBeNull();
  });

  it("delete on a non-matching where is a no-op (Review Focus #4)", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.verifications.delete, { where: [{ field: "identifier", value: "ghost" }], secret })).resolves.not.toThrow();
  });

  it("findMany honors sortBy+limit (better-auth's findVerificationValue call shape — regression test for the re-review finding)", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.verifications.create, {
      data: { identifier: "reset:same@test.com", value: "old", expiresAt: Date.now() + 1000, createdAt: 1000 },
      secret,
    });
    await t.mutation(api.verifications.create, {
      data: { identifier: "reset:same@test.com", value: "new", expiresAt: Date.now() + 2000, createdAt: 2000 },
      secret,
    });

    const latest = await t.query(api.verifications.findMany, {
      where: [{ field: "identifier", value: "reset:same@test.com" }],
      sortBy: { field: "createdAt", direction: "desc" },
      limit: 1,
      secret,
    });
    expect(latest).toHaveLength(1);
    expect(latest[0].value).toBe("new");
  });

  it("findMany rejects an unsupported sortBy shape", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.verifications.findMany, { where: [], sortBy: "createdAt", secret })
    ).rejects.toThrow(/unsupported sortby/i);
  });

  it("findOne rejects a missing/wrong secret (Critical security fix)", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.verifications.findOne, { where: [{ field: "identifier", value: "reset:eve@test.com" }], secret: "wrong-secret" })
    ).rejects.toThrow(/unauthorized/i);
  });
});
