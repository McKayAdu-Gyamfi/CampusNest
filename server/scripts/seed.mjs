// Seeds a fresh Convex deployment with demo data.
//
// Accounts are created through better-auth (not by inserting user rows) so
// their password hashes and account records are real and the demo can
// actually sign in. Run with: node scripts/seed.mjs
import "../src/loadEnv.js";
import { auth } from "../auth.js";
import { cq, cm } from "../src/config/convexClient.js";
import { api } from "../convex/_generated/api.js";

const MANAGER = { email: "manager@campusnest.test", password: "DemoManager123!", name: "Akosua Mensah" };
const STUDENT = { email: "student@campusnest.test", password: "DemoStudent123!", name: "Kwame Asante" };
// Without a seeded ADMIN a fresh deployment has no way to approve a hostel:
// every signup is forced to STUDENT, /api/auth/register pins HOSTEL_MANAGER,
// POST /api/users (create-admin) is itself ADMIN-only, and createHostel
// hardcodes status PENDING — so every hostel stays invisible in the public
// listing forever. The only other route is hand-editing the dashboard.
const ADMIN = { email: "admin@campusnest.test", password: "DemoAdmin123!", name: "Nana Owusu" };

// Single source of truth for the pre-flight existence check, the
// partial-seed role validation, and the expected account count.
const ACCOUNTS = [
  { ...MANAGER, role: "HOSTEL_MANAGER" },
  { ...STUDENT, role: "STUDENT" },
  { ...ADMIN, role: "ADMIN" },
];

async function signUp({ email, password, name }) {
  try {
    const response = await auth.api.signUpEmail({ body: { email, password, name } });
    return response.user;
  } catch (err) {
    throw new Error(`Could not create ${email}: ${err?.message || err?.name || String(err)}`, { cause: err });
  }
}

async function patchProfile(email, id, patch) {
  const result = await cm(api.users.updateProfile, { id, patch });
  if (result === null) {
    throw new Error(`Profile patch for ${email} did not apply (user id ${id} not found); the account may be half-seeded`);
  }
}

// The accounts use publicly-known passwords, so refuse anything but a dev
// deployment. Validates the target the client will actually write to
// (CONVEX_URL), not just CONVEX_DEPLOYMENT, and fails closed on anything
// unset, unparseable or inconsistent.
function assertDevDeployment() {
  if (process.env.SEED_ALLOW_NON_DEV === "1") {
    console.warn("!!! WARNING: SEED_ALLOW_NON_DEV=1 set; guard disabled, seeding with publicly-known passwords !!!");
    return;
  }
  const deployment = process.env.CONVEX_DEPLOYMENT;
  const rawUrl = process.env.CONVEX_URL;
  const problems = [];
  let name = null;
  if (!deployment) problems.push("CONVEX_DEPLOYMENT is unset");
  else if (!deployment.startsWith("dev:")) problems.push(`deployment kind is "${deployment.split(":")[0]}", not dev`);
  else name = deployment.slice("dev:".length);

  let host = null;
  if (!rawUrl) problems.push("CONVEX_URL is unset");
  else {
    try {
      host = new URL(rawUrl).hostname;
    } catch {
      problems.push(`CONVEX_URL is unparseable (${rawUrl})`);
    }
  }
  if (name && host && host.split(".")[0] !== name) {
    problems.push(`CONVEX_URL host "${host}" does not belong to deployment "${name}" (client would write to a different deployment)`);
  }
  if (problems.length === 0) return;

  console.error(
    `Refusing to seed:\n  - ${problems.join("\n  - ")}\n` +
      `  (CONVEX_DEPLOYMENT=${deployment ?? "<unset>"}, CONVEX_URL host=${host ?? "<none>"})\n` +
      "This script creates accounts (including a HOSTEL_MANAGER and an ADMIN) with passwords published in the repo, so it is dev-only.\n" +
      "Set SEED_ALLOW_NON_DEV=1 to override deliberately.",
  );
  process.exit(1);
}

async function main() {
  assertDevDeployment();

  const found = [];
  for (const acct of ACCOUNTS) {
    const user = await cq(api.users.findOne, { where: [{ field: "email", value: acct.email }] });
    if (user) found.push({ ...acct, user });
  }
  if (found.length > 0) {
    const broken = found.filter(({ user, role }) => user.user_type !== role || user.profile_complete !== true);
    if (broken.length === 0 && found.length === ACCOUNTS.length) {
      console.log(`Seed data already present (found ${found.map((f) => f.email).join(", ")}). Nothing was written.`);
      console.log("To re-seed, clear the deployment from the Convex dashboard first.");
      process.exit(0);
    }
    console.error("Deployment is PARTIALLY SEEDED; nothing was written.");
    for (const f of found) {
      console.error(`  ${f.email}: user_type=${f.user.user_type} (expected ${f.role}), profile_complete=${f.user.profile_complete} (expected true)`);
    }
    if (found.length < ACCOUNTS.length) {
      const missing = ACCOUNTS.filter((a) => !found.some((f) => f.email === a.email)).map((a) => a.email);
      console.error(`  missing seed account(s): ${missing.join(", ")}`);
    }
    console.error("Clear the deployment from the Convex dashboard before re-seeding.");
    process.exit(1);
  }

  console.log("Seeding Convex deployment...");

  const manager = await signUp(MANAGER);
  await patchProfile(MANAGER.email, manager.id, {
    user_type: "HOSTEL_MANAGER", profile_complete: true, payment_details: "Demo Bank 0123456789",
  });
  console.log(`  manager: ${MANAGER.email} / ${MANAGER.password}`);

  const student = await signUp(STUDENT);
  await patchProfile(STUDENT.email, student.id, {
    user_type: "STUDENT", profile_complete: true, student_id: "UG-2026-0042", course: "Computer Science",
  });
  console.log(`  student: ${STUDENT.email} / ${STUDENT.password}`);

  const admin = await signUp(ADMIN);
  await patchProfile(ADMIN.email, admin.id, { user_type: "ADMIN", profile_complete: true });
  console.log(`  admin:   ${ADMIN.email} / ${ADMIN.password}  (approves hostels via PATCH /api/hostels/:id/status)`);

  const unity = await cm(api.hostels.create, {
    data: {
      hostel_name: "Unity Hall Annex", location: "North Campus, Legon",
      description: "Five minutes from the main gate, with a quiet study room on each floor.",
      total_rooms: 0, available_rooms: 0, distance_from_campus: 0.8,
      manager_id: manager.id, status: "APPROVED",
    },
  });
  const pentagon = await cm(api.hostels.create, {
    data: {
      hostel_name: "Pentagon Lodge", location: "Madina Road",
      description: "Budget rooms with running water and parking.",
      total_rooms: 0, available_rooms: 0, distance_from_campus: 3.2,
      manager_id: manager.id, status: "PENDING",
    },
  });
  console.log(`  hostels: "${unity.hostel_name}" (APPROVED), "${pentagon.hostel_name}" (PENDING)`);

  await cm(api.amenities.addForHostel, {
    hostelId: unity.id, names: ["WIFI", "RUNNING_WATER", "STUDY_ROOM", "LAUNDRY"],
  });
  await cm(api.amenities.addForHostel, { hostelId: pentagon.id, names: ["RUNNING_WATER", "PARKING"] });

  await cm(api.hostels.addImages, {
    hostelId: unity.id,
    urls: [
      "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=1200",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200",
    ],
  });

  const rooms = [];
  for (const spec of [
    { room_number: "A1", room_type: "SINGLE", price_per_bed: 3500, capacity: 1 },
    { room_number: "A2", room_type: "DOUBLE", price_per_bed: 2400, capacity: 2 },
    { room_number: "B1", room_type: "QUAD", price_per_bed: 1500, capacity: 4 },
  ]) {
    const room = await cm(api.rooms.create, {
      data: { ...spec, hostel_id: unity.id, length: 4.2, width: 3.1, height: 2.8 },
    });
    rooms.push(room);
    await cm(api.amenities.addForRoom, { roomId: room.id, names: ["WIFI", "AIR_CONDITIONING"] });
    await cm(api.rooms.addImages, {
      roomId: room.id,
      urls: ["https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1200"],
    });
  }
  console.log(`  rooms: ${rooms.map((r) => r.room_number).join(", ")}`);

  const booking = await cm(api.bookings.create, {
    data: {
      check_in_date: new Date("2026-11-01").getTime(),
      check_out_date: new Date("2027-06-30").getTime(),
      student_id: student.id,
      room_id: rooms[1].id,
    },
  });
  await cm(api.bookings.updateStatus, { id: booking.id, status: "CONFIRMED" });
  console.log(`  booking: ${STUDENT.name} CONFIRMED into room ${rooms[1].room_number}`);

  const listed = await cq(api.hostels.listApproved, {});
  console.log(`\nDone. Public listing shows ${listed.length} approved hostel(s).`);
}

main().catch((err) => {
  const message = err?.message || err?.name || err?.cause?.message || String(err);
  console.error("\nSeeding failed:", message);
  if (err?.cause) console.error("Caused by:", err.cause);
  process.exit(1);
});
