import { appUrl, firstName, formatDate, formatMoney, oneLine, renderEmail } from "./layout.js";

// One function per email. Each takes plain data and returns { subject, text, html };
// none of them touches the database or the network, so they are easy to test and preview.

const hi = (name) => (firstName(name) ? `Hi ${firstName(name)},` : "Hi,");
const stay = (b) => [formatDate(b.checkIn), formatDate(b.checkOut)].filter(Boolean).join(" to ");

const bookingDetails = (b) => [
  ["Hostel", b.hostelName],
  ["Room", b.roomNumber ? `Room ${b.roomNumber}${b.roomType ? ` · ${String(b.roomType).toLowerCase().replace(/_/g, " ")}` : ""}` : ""],
  ["Stay", stay(b)],
].filter(([, v]) => v);

// ── Sign-up ──────────────────────────────────────────────────────────────────

export function welcomeStudentEmail({ name, email }) {
  const subject = `Welcome to KayaCampus${firstName(name) ? `, ${firstName(name)}` : ""}`;
  return {
    subject,
    ...renderEmail({
      preheader: "Find a verified hostel near campus and book it in minutes.",
      heading: "Welcome to KayaCampus",
      greeting: hi(name),
      paragraphs: ["Your account is ready. KayaCampus helps you find a hostel near campus, see it before you commit, and book it without the back and forth."],
      steps: [
        "Browse hostels near campus and open a 360° tour of the room.",
        "Pick a room, pay with mobile money or card, and send your booking request.",
        "The hostel manager approves it, and we email you the moment they do.",
      ],
      cta: { label: "Find a hostel", url: appUrl("/explore") },
      reason: `You're getting this because an account was created on KayaCampus with ${email}.`,
    }),
  };
}

export function welcomeManagerEmail({ name, email }) {
  const subject = `Welcome to KayaCampus${firstName(name) ? `, ${firstName(name)}` : ""}`;
  return {
    subject,
    ...renderEmail({
      preheader: "List your property and start receiving booking requests.",
      heading: "Welcome to KayaCampus",
      greeting: hi(name),
      paragraphs: ["Your manager account is ready. Here is how to get your first booking."],
      steps: [
        "Add your property with its rooms, prices and photos.",
        "Our team reviews it, and we email you when it goes live.",
        "Students send booking requests with their payment. You approve them from your dashboard.",
      ],
      cta: { label: "Add your property", url: appUrl("/manager/properties") },
      reason: `You're getting this because a manager account was created on KayaCampus with ${email}.`,
    }),
  };
}

// ── Payment / booking request ────────────────────────────────────────────────

/** To the student, right after their booking request is created (usually with a payment). */
export function bookingRequestStudentEmail({ studentName, booking, amountPaid, reference, bookingId }) {
  const paid = Number(amountPaid) > 0;
  const subject = oneLine(paid ? `Payment received: ${formatMoney(amountPaid)} · ${booking.hostelName}` : `Booking request received · ${booking.hostelName}`);
  return {
    subject,
    ...renderEmail({
      preheader: paid ? `We received your ${formatMoney(amountPaid)} payment. Waiting for the manager to approve.` : "Waiting for the manager to approve.",
      heading: paid ? "Payment received" : "Booking request sent",
      greeting: hi(studentName),
      paragraphs: [
        paid
          ? `Thanks, we received your payment of ${formatMoney(amountPaid)} and sent your booking request to ${booking.hostelName}.`
          : `We sent your booking request to ${booking.hostelName}.`,
      ],
      details: [...bookingDetails(booking), ...(paid ? [["Amount paid", formatMoney(amountPaid)]] : []), ...(reference ? [["Payment reference", reference]] : []), ["Status", "Waiting for approval"]],
      steps: [
        "The hostel manager reviews your request.",
        "We email you as soon as they approve or decline it.",
        "You can follow its progress any time from your bookings.",
      ],
      cta: { label: "View booking", url: appUrl(`/bookings/${bookingId}`) },
      reason: "You're getting this because you made a booking request on KayaCampus. Keep it as your receipt.",
    }),
  };
}

/** To the hostel manager: a paid booking request needs a decision. */
export function bookingRequestManagerEmail({ managerName, studentName, booking, amountPaid }) {
  const paid = Number(amountPaid) > 0;
  return {
    subject: oneLine(`New booking request from ${studentName || "a student"} · ${booking.hostelName}`),
    ...renderEmail({
      preheader: `${studentName || "A student"} requested ${booking.roomNumber ? `room ${booking.roomNumber}` : "a room"}${paid ? ` and paid ${formatMoney(amountPaid)}` : ""}.`,
      heading: "New booking request",
      greeting: hi(managerName),
      paragraphs: [`${studentName || "A student"} requested a room at ${booking.hostelName}${paid ? ` and has paid ${formatMoney(amountPaid)}` : ""}. Please approve or decline it.`],
      details: [["Student", studentName || "A student"], ...bookingDetails(booking), ...(paid ? [["Amount paid", formatMoney(amountPaid)]] : [])],
      cta: { label: "Review request", url: appUrl("/manager/bookings") },
      reason: "You're getting this because a student booked a room at one of your properties.",
    }),
  };
}

// ── Manager decisions ────────────────────────────────────────────────────────

export function bookingApprovedEmail({ studentName, booking, bookingId }) {
  return {
    subject: oneLine(`Your booking at ${booking.hostelName} is approved`),
    ...renderEmail({
      preheader: "Good news: your room is secured.",
      heading: "Your booking is approved",
      greeting: hi(studentName),
      paragraphs: [`Good news: ${booking.hostelName} approved your booking, so your room is secured.`],
      details: [...bookingDetails(booking), ["Status", "Approved"]],
      cta: { label: "View booking", url: appUrl(`/bookings/${bookingId}`) },
      reason: "You're getting this because the hostel manager updated your booking on KayaCampus.",
    }),
  };
}

/** `declined` is true when the request was turned down before approval; false when an approved booking was cancelled. */
export function bookingDeclinedEmail({ studentName, booking, bookingId, declined = true }) {
  const word = declined ? "declined" : "cancelled";
  return {
    subject: oneLine(`Your booking at ${booking.hostelName} was ${word}`),
    ...renderEmail({
      preheader: `${booking.hostelName} ${word} your booking.`,
      heading: `Your booking was ${word}`,
      greeting: hi(studentName),
      paragraphs: [
        `${booking.hostelName} ${word} your booking request. You can look at other rooms and book again whenever you're ready.`,
        "If you paid, open the booking to see its details and payment reference.",
      ],
      details: [...bookingDetails(booking), ["Status", declined ? "Declined" : "Cancelled"]],
      cta: { label: "View booking", url: appUrl(`/bookings/${bookingId}`) },
      reason: "You're getting this because the hostel manager updated your booking on KayaCampus.",
    }),
  };
}

// ── Enquiries ────────────────────────────────────────────────────────────────

export function enquiryReplyEmail({ studentName, hostelName, kind, subject: topic, question, reply, bookingId, hostelId }) {
  const what = kind === "ENQUIRY" ? "enquiry" : "complaint";
  const link = bookingId ? appUrl(`/bookings/${bookingId}`) : hostelId ? appUrl(`/hostels/${hostelId}`) : appUrl("/bookings");
  return {
    subject: oneLine(`${hostelName} replied to your ${what}`),
    ...renderEmail({
      preheader: reply.length > 90 ? `${reply.slice(0, 87)}...` : reply,
      heading: `${hostelName} replied`,
      greeting: hi(studentName),
      paragraphs: [
        `The manager answered your ${what}${topic ? ` about "${oneLine(topic)}"` : ""}.`,
        ...(question ? [`You asked: "${oneLine(question).length > 160 ? `${oneLine(question).slice(0, 157)}...` : oneLine(question)}"`] : []),
      ],
      quote: reply,
      quoteLabel: `Reply from ${hostelName}`,
      cta: { label: "View reply", url: link },
      reason: `You're getting this because you sent an ${what === "enquiry" ? "enquiry" : "complaint"} through KayaCampus.`,
    }),
  };
}
