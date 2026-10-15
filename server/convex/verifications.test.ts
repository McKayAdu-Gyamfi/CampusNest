// server/convex/verifications.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

describe("verifications CRUD", () => {
  it("create then findOne by identifier returns the verification", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.verifications.create, {
      data: { identifier: "reset:eve@test.com", value: "otp-123", expiresAt: Date.now() + 100000 },
    });
    expect(created.id).toBeTruthy();

    const found = await t.query(api.verifications.findOne, { where: [{ field: "identifier", value: "reset:eve@test.com" }] });
    expect(found).not.toBeNull();
    expect(found!.value).toBe("otp-123");
  });

  it("findOne returns null for an unknown identifier (Review Focus #1)", async () => {
    const t = convexTest(schema, modules);
    const found = await t.query(api.verifications.findOne, { where: [{ field: "identifier", value: "nothing" }] });
    expect(found).toBeNull();
  });

  it("delete on a non-matching where is a no-op (Review Focus #4)", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.verifications.delete, { where: [{ field: "identifier", value: "ghost" }] })).resolves.not.toThrow();
  });
});
