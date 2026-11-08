const BRAND = "KayaCampus";

// First match wins, so list the specific paths before the general ones.
const TITLES: [RegExp, string][] = [
  [/^\/$/, "Home"],
  [/^\/explore$/, "Explore hostels"],
  [/^\/hostels\/[^/]+$/, "Hostel details"],
  [/^\/saved$/, "Saved hostels"],
  [/^\/bookings$/, "My bookings"],
  [/^\/bookings\/[^/]+$/, "Booking details"],
  [/^\/checkout$/, "Complete booking"],
  [/^\/checkout\/payment$/, "Payment"],
  [/^\/checkout\/confirmation$/, "Payment received"],
  [/^\/tour$/, "360° room tour"],
  [/^\/profile$/, "My account"],
  [/^\/settings$/, "Account settings"],
  [/^\/notifications$/, "Notifications"],
  [/^\/login$/, "Sign in"],
  [/^\/signup$/, "Create your account"],
  [/^\/manager\/login$/, "Manager sign in"],
  [/^\/manager\/signup$/, "Create a manager account"],
  [/^\/manager\/dashboard$/, "Manager dashboard"],
  [/^\/manager\/properties$/, "My properties"],
  [/^\/manager\/properties\/[^/]+$/, "Property"],
  [/^\/manager\/bookings$/, "Bookings"],
  [/^\/manager\/bookings\/[^/]+\/cancel$/, "Cancel & refund"],
  [/^\/manager\/clients$/, "Clients"],
  [/^\/manager\/messages$/, "Enquiries & complaints"],
  [/^\/manager\/payouts$/, "Payouts"],
  [/^\/manager\/profile$/, "My profile"],
  [/^\/admin\/login$/, "Admin sign in"],
  [/^\/admin\/dashboard$/, "Admin dashboard"],
  [/^\/admin\/users$/, "Users"],
  [/^\/admin\/hostels$/, "Hostels"],
  [/^\/admin\/schools$/, "Schools"],
  [/^\/admin\/bookings$/, "Bookings and payments"],
  [/^\/admin\/complaints$/, "Enquiries and complaints"],
  [/^\/admin\/reviews$/, "Reviews"],
  [/^\/admin\/room-tours$/, "Room tours"],
  [/^\/admin\/audit$/, "Audit log"],
  [/^\/admin\/profile$/, "My account"],
  [/^\/admin\/settings$/, "Platform settings"],
];

export function titleFor(pathname: string): string {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const hit = TITLES.find(([re]) => re.test(clean));
  return hit ? `${hit[1]} · ${BRAND}` : `Page not found · ${BRAND}`;
}
