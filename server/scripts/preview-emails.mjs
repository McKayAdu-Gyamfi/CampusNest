// Renders every platform email to an HTML file so you can look at them in a browser.
//   node scripts/preview-emails.mjs [outputDir]
// Nothing is sent. Uses sample data; the output folder defaults to the OS temp dir.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  bookingApprovedEmail,
  bookingDeclinedEmail,
  bookingRequestManagerEmail,
  bookingRequestStudentEmail,
  enquiryReplyEmail,
  welcomeManagerEmail,
  welcomeStudentEmail,
} from "../src/emails/templates.js";
import { passwordResetEmail } from "../src/utils/mailer.js";

const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), "kayacampus-email-previews"));
fs.mkdirSync(out, { recursive: true });

const booking = { hostelName: "Dufie Annex", roomNumber: "305", roomType: "TWO_IN_A_ROOM", checkIn: "2027-01-12T00:00:00.000Z", checkOut: "2027-06-30T00:00:00.000Z" };

const emails = {
  "welcome-student": welcomeStudentEmail({ name: "Ama Boateng", email: "ama@ashesi.edu.gh" }),
  "welcome-manager": welcomeManagerEmail({ name: "Kwame Owusu", email: "kwame@example.com" }),
  "payment-receipt-student": bookingRequestStudentEmail({ studentName: "Ama Boateng", booking, amountPaid: 1500, reference: "KC-AB12CD34", bookingId: "bk1" }),
  "booking-request-manager": bookingRequestManagerEmail({ managerName: "Kwame Owusu", studentName: "Ama Boateng", booking, amountPaid: 1500 }),
  "booking-approved": bookingApprovedEmail({ studentName: "Ama Boateng", booking, bookingId: "bk1" }),
  "booking-declined": bookingDeclinedEmail({ studentName: "Ama Boateng", booking, bookingId: "bk1" }),
  "enquiry-reply": enquiryReplyEmail({ studentName: "Ama Boateng", hostelName: "Dufie Annex", kind: "ENQUIRY", subject: "Running water", question: "Is there running water in the rooms, and is there a backup tank?", reply: "Yes, water runs 24 hours and there is a backup tank.\nYou are welcome to visit on a weekday afternoon.", bookingId: "bk1", hostelId: "h1" }),
  "password-reset": passwordResetEmail({ name: "Ama Boateng", url: "https://app.kayacampus.com/reset-password?token=example" }),
};

for (const [name, mail] of Object.entries(emails)) fs.writeFileSync(path.join(out, `${name}.html`), mail.html);
fs.writeFileSync(
  path.join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Email previews</title><body style="font-family:sans-serif;padding:24px"><h1>Email previews</h1><ul>${Object.entries(emails)
    .map(([name, mail]) => `<li><a href="${name}.html">${name}</a> <small>${mail.subject.replace(/</g, "&lt;")}</small></li>`)
    .join("")}</ul>`,
);
console.log(`Wrote ${Object.keys(emails).length} previews to ${out}`);
