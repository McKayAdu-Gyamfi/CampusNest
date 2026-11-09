// Demo seed: Dufie Annex under a demo manager, plus a demo student. No
// bookings are seeded: the manager only sees real requests from students. Idempotent. Dev deployments only:
// the accounts use publicly-known passwords.
// Run with: node scripts/seed-demo.mjs
import "../src/loadEnv.js";
import { auth } from "../auth.js";
import { cq, cm } from "../src/config/convexClient.js";
import { api } from "../convex/_generated/api.js";

const MANAGER = { email: "manager@campusnest.test", password: "DemoManager123!", name: "Kwame Owusu" };
const STUDENT = { email: "student@campusnest.test", password: "DemoStudent123!", name: "Ama Boateng" };

const ADMIN = { email: "admin@campusnest.test", password: "DemoAdmin123!", name: "Efua Mensah" };

const STANDARD = 7000, SHARED = 6500; // Dufie Annex price / startingPrice
const IMAGES = ["/images/Dufie_Annex_1.webp", "/images/Dufie_Annex_2.webp"];
const DESC =
  "Experience the layout and natural lighting of your future home. This premium hostel offers a combination of aesthetics and state-of-the-art facilities including max security, 24/7 water supply, and unlimited WiFi.";

const ROOMS = [
  { room_number: "118", room_type: "QUAD", price_per_bed: SHARED, capacity: 4, length: 5.5, width: 4.2, height: 2.7 },
  { room_number: "207", room_type: "QUAD", price_per_bed: SHARED, capacity: 4, length: 5.5, width: 4.2, height: 2.7 },
  { room_number: "210", room_type: "QUAD", price_per_bed: SHARED, capacity: 4, length: 5.5, width: 4.2, height: 2.7 },
  { room_number: "305", room_type: "DOUBLE", price_per_bed: STANDARD, capacity: 2, length: 4.5, width: 3.6, height: 2.7 },
  { room_number: "311", room_type: "DOUBLE", price_per_bed: STANDARD, capacity: 2, length: 4.5, width: 3.6, height: 2.7 },
  { room_number: "402B", room_type: "DOUBLE", price_per_bed: STANDARD, capacity: 2, length: 4.5, width: 3.6, height: 2.7 },
];


function assertDev() {
  const dep = process.env.CONVEX_DEPLOYMENT ?? "";
  if (!dep.startsWith("dev:") && process.env.SEED_ALLOW_NON_DEV !== "1") {
    console.error(`Refusing to seed non-dev deployment (${dep || "<unset>"}).`);
    process.exit(1);
  }
}

async function ensureUser({ email, password, name }, patch) {
  let user = await cq(api.users.findOne, { where: [{ field: "email", value: email }] });
  if (!user) {
    ({ user } = await auth.api.signUpEmail({ body: { email, password, name } }));
    console.log(`  created ${email}`);
  }
  await cm(api.users.updateProfile, { id: user.id, patch });
  return user;
}

async function main() {
  assertDev();
  const manager = await ensureUser(MANAGER, {
    name: MANAGER.name, user_type: "HOSTEL_MANAGER", profile_complete: true, payment_details: "MTN MoMo · 0245550100 · Kwame Owusu",
    phone: "0245550100", business_name: "Dufie Annex Hostel", payout_method: "momo",
    momo_network: "MTN MoMo", momo_number: "0245550100",
  });
  const student = await ensureUser(STUDENT, {
    name: STUDENT.name, user_type: "STUDENT", profile_complete: true, student_id: "UG-2026-0042", course: "Business",
    phone: "0200000042", institution: "Ashesi University", level: "300", gender: "Female",
    emergency_contact_name: "Yaa Boateng", emergency_contact_phone: "0200000043",
  });

  await ensureUser(ADMIN, { name: ADMIN.name, user_type: "ADMIN", profile_complete: true });

  // Dufie Annex: reuse (and take over) an existing listing, else create it.
  const all = await cq(api.hostels.listApproved, {});
  let hostel = all.find((h) => h.hostel_name === "Dufie Annex");
  if (hostel) {
    await cm(api.hostels.update, { id: hostel.id, patch: { manager_id: manager.id, status: "APPROVED" } });
  } else {
    hostel = await cm(api.hostels.create, {
      data: {
        hostel_name: "Dufie Annex", location: "Dufie Annex, Berekuso", description: DESC,
        total_rooms: 0, available_rooms: 0, distance_from_campus: 1.2, manager_id: manager.id, status: "APPROVED",
      },
    });
    await cm(api.amenities.addForHostel, { hostelId: hostel.id, names: ["WIFI", "LAUNDRY", "KITCHEN_ACCESS"] });
    await cm(api.hostels.addImages, { hostelId: hostel.id, urls: IMAGES });
  }
  console.log(`  hostel: Dufie Annex (${hostel.id})`);

  // Demo shows Dufie Annex only: take the other seeded listings off the public list.
  for (const h of all) {
    if (h.hostel_name !== "Dufie Annex") await cm(api.hostels.update, { id: h.id, patch: { status: "REJECTED" } });
  }

  // Rooms
  const existingRooms = await cq(api.rooms.list, { hostelId: hostel.id }).catch(() => []);
  const roomId = {};
  for (const r of existingRooms ?? []) roomId[r.room_number] = r.id;
  for (const spec of ROOMS) {
    if (roomId[spec.room_number]) continue;
    const room = await cm(api.rooms.create, { data: { ...spec, hostel_id: hostel.id } });
    roomId[spec.room_number] = room.id;
  }

  // No seeded reviews: a rating on the listing should come from real students
  // (a student can only review after a confirmed stay). Until then it shows "New".

  console.log(`\nManager: ${MANAGER.email} / ${MANAGER.password}\nStudent: ${STUDENT.email} / ${STUDENT.password}\nAdmin: ${ADMIN.email} / ${ADMIN.password}`);
}

main().catch((e) => { console.error("Seed failed:", e?.message || e); process.exit(1); });
