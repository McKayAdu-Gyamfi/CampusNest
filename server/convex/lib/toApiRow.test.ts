import { describe, it, expect } from "vitest";
import { toApiRow } from "./toApiRow";

describe("toApiRow", () => {
  it("renames _id to id and drops _creationTime", () => {
    const row = toApiRow({ _id: "abc123", _creationTime: 1700000000000, hostel_name: "Unity" } as any);
    expect(row.id).toBe("abc123");
    expect(row).not.toHaveProperty("_id");
    expect(row).not.toHaveProperty("_creationTime");
    expect(row.hostel_name).toBe("Unity");
  });

  it("converts date fields from epoch ms to ISO strings", () => {
    const row = toApiRow({
      _id: "x", _creationTime: 0,
      created_at: 1760608200000, updated_at: 1760608200000,
      check_in_date: 1760608200000, check_out_date: 1760608200000,
      createdAt: 1760608200000, updatedAt: 1760608200000,
    } as any);
    for (const f of ["created_at", "updated_at", "check_in_date", "check_out_date", "createdAt", "updatedAt"]) {
      expect(typeof row[f]).toBe("string");
      expect(row[f]).toBe("2025-10-16T09:50:00.000Z");
      expect(Number.isNaN(Date.parse(row[f]))).toBe(false);
    }
  });

  it("leaves non-date numbers alone", () => {
    const row = toApiRow({ _id: "x", _creationTime: 0, price_per_bed: 450.5, capacity: 4 } as any);
    expect(row.price_per_bed).toBe(450.5);
    expect(row.capacity).toBe(4);
  });

  it("passes through a date field that is already a string", () => {
    const row = toApiRow({ _id: "x", _creationTime: 0, created_at: "2026-01-01T00:00:00.000Z" } as any);
    expect(row.created_at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("preserves an explicitly null optional field", () => {
    const row = toApiRow({ _id: "x", _creationTime: 0, description: null } as any);
    expect(row.description).toBeNull();
  });
});
