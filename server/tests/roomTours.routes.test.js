import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";

const { cqMock, cmMock, uploadMock, panoMock, session } = vi.hoisted(() => ({
  cqMock: vi.fn(), cmMock: vi.fn(), uploadMock: vi.fn(), panoMock: vi.fn(), session: { user: null },
}));

vi.mock("../src/config/convexClient.js", () => ({ cq: cqMock, cm: cmMock, ca: vi.fn() }));
vi.mock("../src/utils/convexStorage.js", () => ({ uploadImageToConvex: vi.fn(), uploadLargeFileToConvex: uploadMock }));
vi.mock("../src/modules/payments/payments.routes.js", async () => {
  const { Router } = await import("express");
  return { default: Router(), verifyTransaction: vi.fn() };
});
vi.mock("../auth.js", () => ({
  auth: { api: { getSession: async () => (session.user ? { user: session.user } : null) }, handler: async () => new Response("{}") },
}));
// Real panoService, but with a controllable fetch (see tests below).
const { default: app } = await import("../src/app.js");
const { generateTiledTour, isPanoServiceConfigured } = await import("../src/utils/panoService.js");

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x00]);
const as = (t) => { session.user = t ? { id: `${t}-id`, user_type: t } : null; };

// verifyRoomOwnership reads the room, then its hostel's manager.
const ownRoom = (managerId = "HOSTEL_MANAGER-id") =>
  cqMock.mockResolvedValueOnce({ id: "room-1", hostel_id: "h1" }).mockResolvedValueOnce({ manager_id: managerId });

beforeEach(() => {
  cqMock.mockReset(); cmMock.mockReset(); uploadMock.mockReset(); panoMock.mockReset();
  as(null);
  delete process.env.PANO_API_URL; delete process.env.PANO_API_KEY;
  uploadMock.mockResolvedValueOnce("https://x.convex.cloud/api/storage/pano").mockResolvedValueOnce("https://x.convex.cloud/api/storage/config");
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("room tour generation", () => {
  it("stores a single-image scene when the panorama service isn't configured", async () => {
    as("ADMIN");
    ownRoom();
    cmMock.mockResolvedValueOnce({ id: "scene-1" });
    const res = await request(app).post("/api/rooms/room-1/tours/generate").field("scene_name", "  Bedroom ").attach("image", JPG, { filename: "p.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(201);
    expect(res.body.mode).toBe("single");
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(cmMock.mock.calls[0][1]).toMatchObject({ roomId: "room-1", scene_name: "Bedroom", scene_config_url: "https://x.convex.cloud/api/storage/config", actorId: "ADMIN-id" });
  });

  it("uses the panorama service when configured, and falls back to a single image if it fails", async () => {
    process.env.PANO_API_URL = "http://pano.test"; process.env.PANO_API_KEY = "k";
    as("ADMIN");

    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ tour_url: "https://x.convex.site/tour/room-1-abc/config.json" }) });
    vi.stubGlobal("fetch", fetchMock);
    ownRoom(); cmMock.mockResolvedValueOnce({ id: "s1" });
    const tiled = await request(app).post("/api/rooms/room-1/tours/generate").field("scene_name", "Hall").attach("image", JPG, { filename: "p.jpg", contentType: "image/jpeg" });
    expect(tiled.body.mode).toBe("tiled");
    expect(uploadMock).not.toHaveBeenCalled();
    expect(cmMock.mock.calls[0][1].scene_config_url).toBe("https://x.convex.site/tour/room-1-abc/config.json");
    expect(fetchMock.mock.calls[0][0]).toBe("http://pano.test/api/panorama/tour");
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ "X-Internal-Key": "k" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ detail: "down" }) }));
    ownRoom(); cmMock.mockResolvedValueOnce({ id: "s2" });
    const fallback = await request(app).post("/api/rooms/room-1/tours/generate").field("scene_name", "Hall").attach("image", JPG, { filename: "p.jpg", contentType: "image/jpeg" });
    expect(fallback.status).toBe(201);
    expect(fallback.body.mode).toBe("single");
    expect(uploadMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a missing image or name, other file types, and a manager who doesn't own the room", async () => {
    as("ADMIN");
    ownRoom();
    expect((await request(app).post("/api/rooms/room-1/tours/generate").field("scene_name", "x")).status).toBe(400);
    ownRoom();
    expect((await request(app).post("/api/rooms/room-1/tours/generate").attach("image", JPG, { filename: "p.jpg", contentType: "image/jpeg" })).status).toBe(400);
    ownRoom();
    const gif = await request(app).post("/api/rooms/room-1/tours/generate").field("scene_name", "x").attach("image", Buffer.from("GIF89a"), { filename: "p.gif", contentType: "image/gif" });
    expect(gif.status).toBeGreaterThanOrEqual(400);

    as("HOSTEL_MANAGER");
    ownRoom("someone-else");
    expect((await request(app).post("/api/rooms/room-1/tours/generate").field("scene_name", "x").attach("image", JPG, { filename: "p.jpg", contentType: "image/jpeg" })).status).toBe(403);
    expect(cmMock).not.toHaveBeenCalled();
  });

  it("deleting a scene records who did it", async () => {
    as("ADMIN");
    ownRoom();
    cmMock.mockResolvedValueOnce({ success: true });
    expect((await request(app).delete("/api/rooms/room-1/tours/scene-9")).status).toBe(200);
    expect(cmMock.mock.calls[0][1]).toEqual({ id: "scene-9", roomId: "room-1", actorId: "ADMIN-id" });
  });
});

describe("panoService", () => {
  it("is only configured when both the URL and the key are set", () => {
    expect(isPanoServiceConfigured()).toBe(false);
    process.env.PANO_API_URL = "http://pano.test";
    expect(isPanoServiceConfigured()).toBe(false);
    process.env.PANO_API_KEY = "k";
    expect(isPanoServiceConfigured()).toBe(true);
  });

  it("surfaces the service's error detail", async () => {
    process.env.PANO_API_URL = "http://pano.test/"; process.env.PANO_API_KEY = "k";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: "room_id must be valid" }) }));
    await expect(generateTiledTour({ roomId: "r", buffer: JPG, mimetype: "image/jpeg" })).rejects.toThrow(/HTTP 400.*room_id must be valid/);
  });
});
