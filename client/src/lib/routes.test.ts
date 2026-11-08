import { describe, it, expect } from "vitest";
import { ROUTES, LEGACY_REDIRECTS, ROLE_HOME, authPath, landingFor, roleOfPath } from "./routes";
import { titleFor } from "./pageTitle";

describe("landingFor (where to go after signing in)", () => {
  it("honours the page they were headed to when it is in their own area", () => {
    expect(landingFor("student", "/bookings/abc")).toBe("/bookings/abc");
    expect(landingFor("manager", "/manager/properties?addRoom=1")).toBe("/manager/properties?addRoom=1");
    expect(landingFor("admin", "/admin/users")).toBe("/admin/users");
  });

  it("falls back to the role's home for another role's area", () => {
    expect(landingFor("student", "/manager/dashboard")).toBe(ROLE_HOME.student);
    expect(landingFor("manager", "/admin/users")).toBe(ROLE_HOME.manager);
    expect(landingFor("admin", "/bookings")).toBe(ROLE_HOME.admin);
  });

  it("never sends someone back to a sign-in page (no redirect loop)", () => {
    for (const p of [ROUTES.student.login, ROUTES.student.signup, ROUTES.manager.login, ROUTES.manager.signup, ROUTES.admin.login]) {
      expect(landingFor(roleOfPath(p), p)).toBe(ROLE_HOME[roleOfPath(p)]);
    }
  });

  it("ignores anything that isn't an in-app path (no open redirect)", () => {
    for (const bad of ["//evil.com", "https://evil.com/x", "javascript:alert(1)", "evil", "", undefined, null, 42]) {
      expect(landingFor("student", bad)).toBe(ROLE_HOME.student);
    }
  });
});

describe("roleOfPath", () => {
  it("matches whole path segments only", () => {
    expect(roleOfPath("/admin")).toBe("admin");
    expect(roleOfPath("/admin/users")).toBe("admin");
    expect(roleOfPath("/manager/x")).toBe("manager");
    expect(roleOfPath("/administrator")).toBe("student");
    expect(roleOfPath("/managers")).toBe("student");
    expect(roleOfPath("/bookings")).toBe("student");
  });
});

describe("authPath", () => {
  it("has one sign-in and sign-up page per self-service role", () => {
    expect(authPath("student", "signin")).toBe("/login");
    expect(authPath("student", "signup")).toBe("/signup");
    expect(authPath("manager", "signin")).toBe("/manager/login");
    expect(authPath("manager", "signup")).toBe("/manager/signup");
  });
});

describe("ROUTES", () => {
  const all: string[] = Object.values(ROUTES).flatMap((group) =>
    Object.values(group).map((v) => (typeof v === "function" ? v("abc123") : v)),
  );

  it("are lowercase kebab-case with no trailing slash", () => {
    for (const p of all) {
      expect(p, p).toMatch(/^\/[a-z0-9/_-]*$|^\/[a-z0-9/_-]*abc123[a-z0-9/_-]*$/);
      if (p !== "/") expect(p.endsWith("/"), p).toBe(false);
    }
  });

  it("are unique", () => {
    expect(new Set(all).size).toBe(all.length);
  });

  it("every page has a browser title", () => {
    for (const p of all) expect(titleFor(p), p).not.toMatch(/^Page not found/);
    expect(titleFor("/no/such/page")).toMatch(/^Page not found/);
  });

  it("builders put the id in the path", () => {
    expect(ROUTES.student.booking("b1")).toBe("/bookings/b1");
    expect(ROUTES.student.hostel("h1")).toBe("/hostels/h1");
    expect(ROUTES.manager.cancelBooking("b1")).toBe("/manager/bookings/b1/cancel");
  });
});

describe("LEGACY_REDIRECTS", () => {
  it("point at pages that exist, never at themselves, and keep :params", () => {
    const real = new Set<string>(
      Object.values(ROUTES).flatMap((g) => Object.values(g).map((v) => (typeof v === "function" ? v(":id") : v))),
    );
    for (const { from, to } of LEGACY_REDIRECTS) {
      expect(from).not.toBe(to);
      expect(real.has(to), `${from} -> ${to}`).toBe(true);
      expect(from.match(/:\w+/g) ?? []).toEqual(to.match(/:\w+/g) ?? []);
    }
  });
});
