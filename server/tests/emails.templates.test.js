import { describe, it, expect, beforeEach } from "vitest";
import {
  bookingApprovedEmail,
  bookingDeclinedEmail,
  bookingRequestManagerEmail,
  bookingRequestStudentEmail,
  enquiryReplyEmail,
  welcomeManagerEmail,
  welcomeStudentEmail,
} from "../src/emails/templates.js";
import { appUrl, esc, formatDate, formatMoney, oneLine } from "../src/emails/layout.js";

const booking = {
  hostelName: "Dufie Annex",
  roomNumber: "305",
  roomType: "TWO_IN_A_ROOM",
  checkIn: "2027-01-12T00:00:00.000Z",
  checkOut: "2027-06-30T00:00:00.000Z",
};

beforeEach(() => {
  process.env.CLIENT_URL = "https://app.kayacampus.test";
});

describe("layout helpers", () => {
  it("escapes HTML and collapses line breaks", () => {
    expect(esc(`<img src=x onerror="a()">&'`)).toBe("&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;");
    expect(oneLine("Ama\r\nBcc: evil@x.com")).toBe("Ama Bcc: evil@x.com");
  });

  it("formats money and dates without a timezone shift", () => {
    expect(formatMoney(1200)).toBe("GHS 1,200.00");
    expect(formatDate("2027-01-12T00:00:00.000Z")).toBe("12 Jan 2027");
    expect(formatDate("not a date")).toBe("");
  });

  it("builds app links from CLIENT_URL, tolerating a trailing slash", () => {
    process.env.CLIENT_URL = "https://app.kayacampus.test/";
    expect(appUrl("/bookings/b1")).toBe("https://app.kayacampus.test/bookings/b1");
  });
});

describe("sign-up emails", () => {
  it("welcomes a student with a link to explore", () => {
    const m = welcomeStudentEmail({ name: "Ama Boateng", email: "ama@ashesi.edu.gh" });
    expect(m.subject).toBe("Welcome to KayaCampus, Ama");
    expect(m.html).toContain("https://app.kayacampus.test/explore");
    expect(m.text).toContain("Hi Ama,");
    expect(m.text).toContain("ama@ashesi.edu.gh");
  });

  it("welcomes a manager with a link to add a property", () => {
    const m = welcomeManagerEmail({ name: "Kwame Owusu", email: "kwame@example.com" });
    expect(m.html).toContain("https://app.kayacampus.test/manager/properties");
    expect(m.text).toMatch(/Add your property/);
  });

  it("still reads well with no name", () => {
    const m = welcomeStudentEmail({ name: "", email: "a@b.com" });
    expect(m.subject).toBe("Welcome to KayaCampus");
    expect(m.text).toContain("Hi,");
  });
});

describe("payment emails", () => {
  it("the student receipt shows the amount, reference, room and a booking link", () => {
    const m = bookingRequestStudentEmail({ studentName: "Ama Boateng", booking, amountPaid: 1500, reference: "KC-AB12CD34", bookingId: "bk1" });
    expect(m.subject).toBe("Payment received: GHS 1,500.00 · Dufie Annex");
    for (const part of ["GHS 1,500.00", "KC-AB12CD34", "Room 305", "12 Jan 2027 to 30 Jun 2027", "https://app.kayacampus.test/bookings/bk1"]) {
      expect(m.html).toContain(part);
      expect(m.text).toContain(part);
    }
    expect(m.text).toContain("Waiting for approval");
  });

  it("is a plain request confirmation when nothing was paid", () => {
    const m = bookingRequestStudentEmail({ studentName: "Ama", booking, amountPaid: undefined, bookingId: "bk1" });
    expect(m.subject).toBe("Booking request received · Dufie Annex");
    expect(m.text).not.toContain("Amount paid");
  });

  it("the manager is asked to review a paid request", () => {
    const m = bookingRequestManagerEmail({ managerName: "Kwame Owusu", studentName: "Ama Boateng", booking, amountPaid: 1500 });
    expect(m.subject).toBe("New booking request from Ama Boateng · Dufie Annex");
    expect(m.text).toContain("has paid GHS 1,500.00");
    expect(m.html).toContain("https://app.kayacampus.test/manager/bookings");
  });
});

describe("manager decision emails", () => {
  it("approval", () => {
    const m = bookingApprovedEmail({ studentName: "Ama Boateng", booking, bookingId: "bk1" });
    expect(m.subject).toBe("Your booking at Dufie Annex is approved");
    expect(m.text).toContain("Approved");
  });

  it("a declined request and a cancelled approved booking read differently", () => {
    expect(bookingDeclinedEmail({ studentName: "Ama", booking, bookingId: "b", declined: true }).subject).toBe("Your booking at Dufie Annex was declined");
    expect(bookingDeclinedEmail({ studentName: "Ama", booking, bookingId: "b", declined: false }).subject).toBe("Your booking at Dufie Annex was cancelled");
  });

  it("does not promise a refund", () => {
    const m = bookingDeclinedEmail({ studentName: "Ama", booking, bookingId: "b" });
    expect(m.text.toLowerCase()).not.toContain("refund");
  });
});

describe("enquiry reply email", () => {
  it("quotes the reply and links to the booking when there is one", () => {
    const m = enquiryReplyEmail({ studentName: "Ama Boateng", hostelName: "Dufie Annex", kind: "ENQUIRY", subject: "Water", question: "Is there running water?", reply: "Yes, 24 hours.", bookingId: "bk1", hostelId: "h1" });
    expect(m.subject).toBe("Dufie Annex replied to your enquiry");
    expect(m.text).toContain('"Yes, 24 hours."');
    expect(m.text).toContain("Is there running water?");
    expect(m.html).toContain("https://app.kayacampus.test/bookings/bk1");
  });

  it("links to the hostel when the enquiry has no booking", () => {
    const m = enquiryReplyEmail({ studentName: "Ama", hostelName: "Dufie Annex", kind: "ENQUIRY", reply: "Yes", hostelId: "h1" });
    expect(m.html).toContain("https://app.kayacampus.test/hostels/h1");
  });

  it("calls a complaint a complaint", () => {
    expect(enquiryReplyEmail({ studentName: "Ama", hostelName: "Dufie Annex", kind: "COMPLAINT", reply: "Sorted", hostelId: "h1" }).subject).toBe("Dufie Annex replied to your complaint");
  });
});

describe("user-written text can't break the email", () => {
  it("escapes HTML in names, hostel names and replies", () => {
    const evil = `<script>alert(1)</script>`;
    const m = enquiryReplyEmail({ studentName: evil, hostelName: evil, kind: "ENQUIRY", subject: evil, question: evil, reply: evil, hostelId: "h1" });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });

  it("keeps newlines out of subjects", () => {
    const m = bookingApprovedEmail({ studentName: "A", booking: { ...booking, hostelName: "Dufie\r\nBcc: x@y.com" }, bookingId: "b" });
    expect(m.subject).not.toMatch(/[\r\n]/);
    const r = bookingRequestManagerEmail({ managerName: "K", studentName: "Ama\nBcc: x@y.com", booking, amountPaid: 1 });
    expect(r.subject).not.toMatch(/[\r\n]/);
  });
});
