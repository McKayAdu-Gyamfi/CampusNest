import { describe, it, expect } from "vitest";
import { missingProfileFields, isProfileComplete } from "./profileCompleteness.js";

const student = {
  student_id: "1", course: "CS", institution: "Ashesi", level: "300",
  phone: "0200000000", emergency_contact_name: "A", emergency_contact_phone: "0200000001",
};

describe("profile completeness", () => {
  it("student needs id, programme, school, level, phone and emergency contact", () => {
    expect(isProfileComplete(student, "STUDENT")).toBe(true);
    expect(missingProfileFields({ student_id: "1", course: "CS" }, "STUDENT").map((m) => m.key))
      .toEqual(["institution", "level", "phone", "emergency_contact_name", "emergency_contact_phone"]);
  });
  it("manager needs phone, business name and one full payout account", () => {
    const base = { phone: "0245550100", business_name: "H" };
    expect(missingProfileFields(base, "HOSTEL_MANAGER").map((m) => m.key)).toEqual(["payout"]);
    expect(isProfileComplete({ ...base, momo_network: "MTN", momo_number: "0245550100" }, "HOSTEL_MANAGER")).toBe(true);
    expect(isProfileComplete({ ...base, bank_name: "GCB", bank_account_number: "123456", bank_account_name: "X" }, "HOSTEL_MANAGER")).toBe(true);
    expect(isProfileComplete({ ...base, bank_name: "GCB" }, "HOSTEL_MANAGER")).toBe(false);
  });
  it("whitespace does not count as filled", () => {
    expect(isProfileComplete({ ...student, phone: "   " }, "STUDENT")).toBe(false);
  });
});
