import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const secret = process.env.CONVEX_ADAPTER_SECRET as string;

describe("files.storeImage", () => {
  it("stores bytes and returns a URL string", async () => {
    const t = convexTest(schema, modules);
    const bytes = new TextEncoder().encode("fake-png-bytes").buffer as ArrayBuffer;

    const url = await t.action(api.files.storeImage, {
      bytes, contentType: "image/png", secret,
    });

    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });

  it("rejects a wrong secret", async () => {
    const t = convexTest(schema, modules);
    const bytes = new TextEncoder().encode("x").buffer as ArrayBuffer;
    await expect(
      t.action(api.files.storeImage, { bytes, contentType: "image/png", secret: "wrong-secret" })
    ).rejects.toThrow(/unauthorized/i);
  });
});
