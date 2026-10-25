import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const panoSecret = process.env.PANO_CONVEX_SECRET;

// Stores a blob directly and registers it, standing in for what the pano
// service does over HTTP (generateTourUploadUrl cannot run under
// convex-test, which implements storeBlob but not storage/generateUploadUrl).
async function putTile(
  t: ReturnType<typeof convexTest>,
  tourId: string,
  path: string,
  body: string,
  type = "image/jpeg"
) {
  const storageId = await t.run(async (ctx: any) => await ctx.storage.store(new Blob([body], { type })));
  await t.mutation(api.tours.registerTourFile, { tourId, path, storageId, panoSecret });
  return storageId;
}

describe("tour file registration", () => {
  it("registers a tile and serves it over the /tour/ route at the path Pannellum asks for", async () => {
    const t = convexTest(schema, modules);
    await putTile(t, "tour-abc", "2/f0_1.jpg", "tile-bytes");

    const res = await t.fetch("/tour/tour-abc/2/f0_1.jpg", { method: "GET" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(await res.text()).toBe("tile-bytes");
  });

  it("404s an unknown tour, an unknown path, and a malformed route", async () => {
    const t = convexTest(schema, modules);
    await putTile(t, "tour-abc", "config.json", "{}", "application/json");

    expect((await t.fetch("/tour/other-tour/config.json", { method: "GET" })).status).toBe(404);
    expect((await t.fetch("/tour/tour-abc/nope.jpg", { method: "GET" })).status).toBe(404);
    expect((await t.fetch("/tour/tour-abc", { method: "GET" })).status).toBe(404);
    expect((await t.fetch("/tour/", { method: "GET" })).status).toBe(404);
  });

  it("keeps tours isolated — one tour's path never resolves to another's file", async () => {
    const t = convexTest(schema, modules);
    await putTile(t, "tour-a", "1/f0_0.jpg", "A-content");
    await putTile(t, "tour-b", "1/f0_0.jpg", "B-content");

    expect(await (await t.fetch("/tour/tour-a/1/f0_0.jpg", { method: "GET" })).text()).toBe("A-content");
    expect(await (await t.fetch("/tour/tour-b/1/f0_0.jpg", { method: "GET" })).text()).toBe("B-content");
  });

  it("normalises a leading slash and Windows separators to one canonical path", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run(async (ctx: any) =>
      await ctx.storage.store(new Blob(["x"], { type: "image/jpeg" }))
    );

    const a = await t.mutation(api.tours.registerTourFile, {
      tourId: "tour-n", path: "/2/f0_1.jpg", storageId, panoSecret,
    });
    expect(a.path).toBe("2/f0_1.jpg");

    const b = await t.mutation(api.tours.registerTourFile, {
      tourId: "tour-w", path: "2\\f0_1.jpg", storageId, panoSecret,
    });
    expect(b.path).toBe("2/f0_1.jpg");

    // both are reachable at the normalised path
    expect((await t.fetch("/tour/tour-n/2/f0_1.jpg", { method: "GET" })).status).toBe(200);
    expect((await t.fetch("/tour/tour-w/2/f0_1.jpg", { method: "GET" })).status).toBe(200);
  });

  it("re-registering a path replaces the file and deletes the one it displaced", async () => {
    const t = convexTest(schema, modules);
    const firstId = await putTile(t, "tour-r", "1/f0_0.jpg", "old-bytes");
    const secondId = await t.run(async (ctx: any) =>
      await ctx.storage.store(new Blob(["new-bytes"], { type: "image/jpeg" }))
    );

    const result = await t.mutation(api.tours.registerTourFile, {
      tourId: "tour-r", path: "1/f0_0.jpg", storageId: secondId, panoSecret,
    });
    expect(result.replaced).toBe(true);

    // the route now serves the new bytes
    expect(await (await t.fetch("/tour/tour-r/1/f0_0.jpg", { method: "GET" })).text()).toBe("new-bytes");

    // exactly one row, and the displaced file is gone rather than orphaned
    const rows = await t.run(async (ctx: any) => await ctx.db.query("tourFiles").collect());
    expect(rows).toHaveLength(1);
    const stillThere = await t.run(async (ctx: any) => await ctx.storage.getUrl(firstId));
    expect(stillThere).toBeNull();
  });

  it("404s when the row outlives the file it points at", async () => {
    const t = convexTest(schema, modules);
    const storageId = await putTile(t, "tour-x", "1/f0_0.jpg", "bytes");
    await t.run(async (ctx: any) => await ctx.storage.delete(storageId));

    expect((await t.fetch("/tour/tour-x/1/f0_0.jpg", { method: "GET" })).status).toBe(404);
  });

  it("rejects a wrong pano secret, and does not accept the adapter secret", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run(async (ctx: any) =>
      await ctx.storage.store(new Blob(["x"], { type: "image/jpeg" }))
    );

    await expect(
      t.mutation(api.tours.registerTourFile, {
        tourId: "t", path: "a.jpg", storageId, panoSecret: "wrong-secret",
      })
    ).rejects.toThrow(/unauthorized/i);

    // the adapter secret must NOT be interchangeable with the pano one
    await expect(
      t.mutation(api.tours.registerTourFile, {
        tourId: "t", path: "a.jpg", storageId,
        panoSecret: process.env.CONVEX_ADAPTER_SECRET,
      })
    ).rejects.toThrow(/unauthorized/i);
  });
});
