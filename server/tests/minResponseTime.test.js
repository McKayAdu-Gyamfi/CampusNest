import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { minResponseTime } from "../src/middlewares/minResponseTime.middleware.js";

describe("minResponseTime", () => {
  const build = (ms, delay = 0) => {
    const app = express();
    app.post("/x", minResponseTime(ms), (req, res) => setTimeout(() => res.json({ ok: true }), delay));
    return app;
  };

  it("holds a fast response until the floor", async () => {
    const t = Date.now();
    const r = await request(build(250)).post("/x");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
    expect(Date.now() - t).toBeGreaterThanOrEqual(240);
  });

  it("does not delay a response that is already slower than the floor", async () => {
    const t = Date.now();
    await request(build(50, 150)).post("/x");
    const took = Date.now() - t;
    expect(took).toBeGreaterThanOrEqual(140);
    expect(took).toBeLessThan(400);
  });

  it("is a no-op when the floor is 0", async () => {
    const t = Date.now();
    await request(build(0)).post("/x");
    expect(Date.now() - t).toBeLessThan(150);
  });
});
