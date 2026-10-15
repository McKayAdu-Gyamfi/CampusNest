import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("convexAdapter", () => {
  const originalUrl = process.env.CONVEX_URL;

  beforeEach(() => {
    delete process.env.CONVEX_URL;
  });

  afterEach(() => {
    if (originalUrl) process.env.CONVEX_URL = originalUrl;
  });

  it("throws immediately on import if CONVEX_URL is not set (Review Focus #5)", async () => {
    // Fresh import each time so the module-level throw-on-missing-env-var
    // check actually re-runs (vitest caches modules by default otherwise).
    await expect(import(/* @vite-ignore */ `./auth-convex-adapter.js?t=${Date.now()}`)).rejects.toThrow(/CONVEX_URL/);
  });
});
