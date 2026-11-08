import { describe, it, expect } from "vitest";
import { passwordProblem, passwordStrength } from "./password";

describe("passwordProblem", () => {
  it("accepts a normal password and rejects short, blank or mismatched ones", () => {
    expect(passwordProblem("correct horse")).toBeNull();
    expect(passwordProblem("short")).toMatch(/at least 8/);
    expect(passwordProblem("        ")).toMatch(/only spaces/);
    expect(passwordProblem("a".repeat(200))).toMatch(/128/);
    expect(passwordProblem("longenough1", "longenough2")).toMatch(/don't match/);
    expect(passwordProblem("longenough1", "longenough1")).toBeNull();
  });
});

describe("passwordStrength", () => {
  it("rises with length and variety", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("abc")).toBe(1);
    expect(passwordStrength("abcdefgh")).toBe(1);
    expect(passwordStrength("abcdefghijkl")).toBe(2);
    expect(passwordStrength("Abcdefghijkl")).toBe(3);
    expect(passwordStrength("Abcdefghijk1!")).toBe(4);
  });
});
