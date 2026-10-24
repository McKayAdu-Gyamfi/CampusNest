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

async function signUp({ email, password, name }) {
  const response = await auth.api.signUpEmail({ body: { email, password, name } });
  if (response.error) {
    throw new Error(`Could not create ${email}: ${response.error.message}`);
  }
  return response.user;
}

async function main() {
  console.log("Seeding Convex deployment...");

  const manager = await signUp(MANAGER);
  await cm(api.users.updateProfile, {
    id: manager.id,
    patch: { user_type: "HOSTEL_MANAGER", profile_complete: true, payment_details: "Demo Bank 0123456789" },
  });
  console.log(`  manager: ${MANAGER.email} / ${MANAGER.password}`);

  const student = await signUp(STUDENT);
  await cm(api.users.updateProfile, {
    id: student.id,
    patch: { user_type: "STUDENT", profile_complete: true, student_id: "UG-2026-0042", course: "Computer Science" },
  });
  console.log(`  student: ${STUDENT.email} / ${STUDENT.password}`);

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
  console.error("\nSeeding failed:", err.message);
  process.exit(1);
});
