import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "../src/middlewares/errorHandler.js";

const run = (err) => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  vi.spyOn(console, "error").mockImplementation(() => {});
  errorHandler(err, {}, res, () => {});
  return res;
};

describe("errorHandler", () => {
  it("passes through the message of errors with a statusCode", () => {
    const err = Object.assign(new Error("User not found"), { statusCode: 404 });
    const res = run(err);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].message).toBe("User not found");
  });

  it("hides the message of errors without a statusCode", () => {
    const res = run(new Error("internal detail xyz"));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("internal detail xyz");
    expect(res.json.mock.calls[0][0].message).toBe("Internal Server Error");
  });

  it("does not leak a secret embedded in the message", () => {
    const res = run(new Error("ArgumentValidationError {secret: 'FAKE-SECRET-123'}"));
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("FAKE-SECRET-123");
  });

  it("omits stack and the secret from the whole body in development for non-deliberate errors", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const res = run(new Error("args {secret: 'FAKE-SECRET-456'}"));
      const body = res.json.mock.calls[0][0];
      expect(JSON.stringify(body)).not.toContain("FAKE-SECRET-456");
      expect(body.stack).toBeUndefined();
    } finally {
      if (prev === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prev;
    }
  });
});
