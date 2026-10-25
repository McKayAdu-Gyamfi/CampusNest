import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// convex-test implements storeBlob but not storage/generateUploadUrl, so the
// upload-URL flow cannot run in that harness. The Convex side is two thin
// wrappers verified against the live deployment; the orchestration lives
// here in Express precisely so it can be tested, which is what this file does.
const { cmMock, cqMock, caMock } = vi.hoisted(() => ({
  cmMock: vi.fn(),
  cqMock: vi.fn(),
  caMock: vi.fn(),
}));

vi.mock("../src/config/convexClient.js", () => ({
  cm: cmMock,
  cq: cqMock,
  ca: caMock,
}));

const { uploadLargeFileToConvex, uploadImageToConvex } = await import("../src/utils/convexStorage.js");

const UPLOAD_URL = "https://example.convex.cloud/api/storage/upload?token=abc";

describe("uploadLargeFileToConvex", () => {
  beforeEach(() => {
    cmMock.mockReset();
    cqMock.mockReset();
    cmMock.mockResolvedValue(UPLOAD_URL);
    cqMock.mockResolvedValue("https://example.convex.cloud/api/storage/the-id");
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ storageId: "the-id" }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the exact bytes to the upload URL and returns the resolved public URL", async () => {
    const buffer = Buffer.from("panorama-bytes");

    const url = await uploadLargeFileToConvex(buffer, "image/jpeg");

    // step 1: asked Convex for an upload URL
    expect(cmMock).toHaveBeenCalledTimes(1);
    // step 2: POSTed the bytes there, with the caller's content type
    const [calledUrl, init] = globalThis.fetch.mock.calls[0];
    expect(calledUrl).toBe(UPLOAD_URL);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("image/jpeg");
    expect(init.body).toBe(buffer);
    // step 3: resolved the returned id, and handed back that URL
    expect(cqMock).toHaveBeenCalledTimes(1);
    expect(cqMock.mock.calls[0][1]).toEqual({ storageId: "the-id" });
    expect(url).toBe("https://example.convex.cloud/api/storage/the-id");
  });

  it("passes a JSON content type through unchanged", async () => {
    await uploadLargeFileToConvex(Buffer.from("{}"), "application/json");
    expect(globalThis.fetch.mock.calls[0][1].headers["Content-Type"]).toBe("application/json");
  });

  it("throws, naming the status, when the upload POST fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 413, json: async () => ({}) });

    await expect(uploadLargeFileToConvex(Buffer.from("x"), "image/png")).rejects.toThrow(/HTTP 413/);
    // never tries to resolve a URL for an upload that did not happen
    expect(cqMock).not.toHaveBeenCalled();
  });

  it("throws when the upload response carries no storageId", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    await expect(uploadLargeFileToConvex(Buffer.from("x"), "image/png")).rejects.toThrow(/no storageId/);
    expect(cqMock).not.toHaveBeenCalled();
  });
});

describe("uploadImageToConvex (the small-file, bytes-as-argument path)", () => {
  beforeEach(() => {
    caMock.mockReset();
    caMock.mockResolvedValue("https://example.convex.cloud/api/storage/img");
  });

  it("rejects a mimetype outside the allowlist before sending anything", async () => {
    await expect(
      uploadImageToConvex({ mimetype: "image/svg+xml", buffer: Buffer.from("x") })
    ).rejects.toThrow(/Unsupported image type/);
    expect(caMock).not.toHaveBeenCalled();
  });

  it("sends exactly this file's bytes, not the whole shared Buffer pool", async () => {
    // Small Buffers are views into Node's shared pool, so a naive
    // file.buffer.buffer would ship unrelated neighbouring bytes. Allocating
    // two small Buffers back to back makes that mistake observable.
    Buffer.from("AAAAAAAAAAAAAAAA");
    const file = { mimetype: "image/png", buffer: Buffer.from("BBBB") };

    await uploadImageToConvex(file);

    const { bytes } = caMock.mock.calls[0][1];
    expect(bytes.byteLength).toBe(4);
    expect(Buffer.from(bytes).toString()).toBe("BBBB");
  });
});
