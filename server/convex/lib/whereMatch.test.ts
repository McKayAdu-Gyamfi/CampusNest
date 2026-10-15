// server/convex/lib/whereMatch.test.ts
import { describe, it, expect } from "vitest";
import { matchesWhere } from "./whereMatch";

describe("matchesWhere", () => {
  it("matches a document where every equality clause holds", () => {
    const doc = { email: "a@b.com", name: "Alice" };
    expect(matchesWhere(doc, [{ field: "email", value: "a@b.com" }])).toBe(true);
  });

  it("does not match when a clause's value differs", () => {
    const doc = { email: "a@b.com" };
    expect(matchesWhere(doc, [{ field: "email", value: "wrong@b.com" }])).toBe(false);
  });

  it("requires every clause to match (AND semantics)", () => {
    const doc = { email: "a@b.com", name: "Alice" };
    expect(
      matchesWhere(doc, [
        { field: "email", value: "a@b.com" },
        { field: "name", value: "Bob" },
      ])
    ).toBe(false);
  });

  it("treats an explicit eq operator the same as omitted", () => {
    const doc = { token: "abc" };
    expect(matchesWhere(doc, [{ field: "token", value: "abc", operator: "eq" }])).toBe(true);
  });

  it("throws a clear error for an unsupported operator (Review Focus #2)", () => {
    const doc = { email: "a@b.com" };
    expect(() => matchesWhere(doc, [{ field: "email", value: "a@b.com", operator: "contains" }])).toThrow(
      /unsupported where operator "contains"/i
    );
  });

  it("throws for an unsupported operator even when an earlier clause already fails to match", () => {
    const doc = { email: "x" };
    expect(() =>
      matchesWhere(doc, [
        { field: "email", value: "y" },
        { field: "a", value: 1, operator: "contains" },
      ])
    ).toThrow(/unsupported where operator "contains"/i);
  });
});
