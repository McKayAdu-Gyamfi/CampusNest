import { describe, it, expect, beforeEach, vi } from "vitest";

const { cmMock, cqMock, caMock, uploadLargeMock, uploadImageMock } = vi.hoisted(() => ({
  cmMock: vi.fn(),
  cqMock: vi.fn(),
  caMock: vi.fn(),
  uploadLargeMock: vi.fn(),
  uploadImageMock: vi.fn(),
}));

vi.mock("../src/config/convexClient.js", () => ({ cm: cmMock, cq: cqMock, ca: caMock }));
vi.mock("../src/utils/convexStorage.js", () => ({
  uploadLargeFileToConvex: uploadLargeMock,
  uploadImageToConvex: uploadImageMock,
}));

const { generateRoomTour } = await import("../src/modules/rooms/rooms.controller.js");

const PANORAMA_URL = "https://example.convex.cloud/api/storage/panorama-id";
const CONFIG_URL = "https://example.convex.cloud/api/storage/config-id";

function mockRes() {
  const res = { code: null, body: null };
  res.status = (c) => { res.code = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

function reqWith(body = {}, file = { buffer: Buffer.from("pano"), mimetype: "image/jpeg" }) {
  return { params: { id: "room-1" }, body, file };
}

describe("generateRoomTour", () => {
  beforeEach(() => {
    cmMock.mockReset();
    uploadLargeMock.mockReset();
    cmMock.mockResolvedValue({ id: "scene-1", scene_name: "Bedroom" });
    // first call stores the panorama, second stores the config
    uploadLargeMock
      .mockResolvedValueOnce(PANORAMA_URL)
      .mockResolvedValueOnce(CONFIG_URL);
  });

  it("stores the panorama, then a config pointing at it, and registers the config URL", async () => {
    const next = vi.fn();
    const res = mockRes();

    await generateRoomTour(reqWith({ scene_name: "Bedroom" }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.code).toBe(201);

    // the panorama went up as the raw image bytes
    const [panoBuffer, panoType] = uploadLargeMock.mock.calls[0];
    expect(panoBuffer.toString()).toBe("pano");
    expect(panoType).toBe("image/jpeg");

    // the config is JSON, and points at the stored panorama's URL
    const [configBuffer, configType] = uploadLargeMock.mock.calls[1];
    expect(configType).toBe("application/json");
    const config = JSON.parse(configBuffer.toString());
    expect(config.type).toBe("equirectangular");
    expect(config.panorama).toBe(PANORAMA_URL);
    expect(config.hotSpots).toEqual([]);

    // the scene records the CONFIG url, not the raw image url
    expect(cmMock.mock.calls[0][1]).toEqual({
      roomId: "room-1",
      scene_name: "Bedroom",
      scene_config_url: CONFIG_URL,
    });
  });

  it("passes hotspots through into the config, accepting a JSON string", async () => {
    const hotspots = [{ pitch: 10, yaw: 20, type: "scene", sceneId: "hall", text: "Hall" }];
    await generateRoomTour(
      reqWith({ scene_name: "Bedroom", hotspots: JSON.stringify(hotspots) }),
      mockRes(),
      vi.fn()
    );

    const config = JSON.parse(uploadLargeMock.mock.calls[1][0].toString());
    expect(config.hotSpots).toEqual(hotspots);
  });

  it("accepts hotspots already parsed into an array", async () => {
    const hotspots = [{ pitch: 1, yaw: 2 }];
    await generateRoomTour(reqWith({ scene_name: "Bedroom", hotspots }), mockRes(), vi.fn());

    const config = JSON.parse(uploadLargeMock.mock.calls[1][0].toString());
    expect(config.hotSpots).toEqual(hotspots);
  });

  it("400s without a file, and stores nothing", async () => {
    const res = mockRes();
    // null, not undefined — undefined would fall back to reqWith's default file
    await generateRoomTour(reqWith({ scene_name: "Bedroom" }, null), res, vi.fn());

    expect(res.code).toBe(400);
    expect(res.body.message).toMatch(/panorama image is required/i);
    expect(uploadLargeMock).not.toHaveBeenCalled();
    expect(cmMock).not.toHaveBeenCalled();
  });

  it("400s without a scene_name, and stores nothing", async () => {
    const res = mockRes();
    await generateRoomTour(reqWith({}), res, vi.fn());

    expect(res.code).toBe(400);
    expect(res.body.message).toMatch(/scene_name is required/i);
    expect(uploadLargeMock).not.toHaveBeenCalled();
  });

  it("400s on malformed hotspots JSON rather than storing a broken config", async () => {
    const res = mockRes();
    await generateRoomTour(reqWith({ scene_name: "Bedroom", hotspots: "{not json" }), res, vi.fn());

    expect(res.code).toBe(400);
    expect(res.body.message).toMatch(/valid JSON/i);
    expect(uploadLargeMock).not.toHaveBeenCalled();
  });

  it("400s when hotspots parses to something other than an array", async () => {
    const res = mockRes();
    await generateRoomTour(reqWith({ scene_name: "Bedroom", hotspots: '{"pitch":1}' }), res, vi.fn());

    expect(res.code).toBe(400);
    expect(res.body.message).toMatch(/must be an array/i);
    expect(uploadLargeMock).not.toHaveBeenCalled();
  });

  it("no longer calls the Python panorama service", async () => {
    globalThis.fetch = vi.fn();
    await generateRoomTour(reqWith({ scene_name: "Bedroom" }), mockRes(), vi.fn());
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("forwards a storage failure to next() instead of reporting success", async () => {
    uploadLargeMock.mockReset();
    uploadLargeMock.mockRejectedValue(new Error("Convex storage upload failed with HTTP 413"));
    const next = vi.fn();
    const res = mockRes();

    await generateRoomTour(reqWith({ scene_name: "Bedroom" }), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.code).toBeNull();
    expect(cmMock).not.toHaveBeenCalled();
  });
});
