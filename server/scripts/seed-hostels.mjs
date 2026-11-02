// Loads the hostels the frontend used to hard-code (client/src/data/hostels.ts)
// into Convex, so the public listing serves them from the real backend.
//
// Everything is APPROVED and owned by the demo manager account from
// scripts/seed.mjs (created here if it doesn't exist yet). Safe to re-run:
// hostels that already exist by name are skipped.
// Run with: node scripts/seed-hostels.mjs
import "../src/loadEnv.js";
import { auth } from "../auth.js";
import { cq, cm } from "../src/config/convexClient.js";
import { api } from "../convex/_generated/api.js";

const MANAGER = { email: "manager@campusnest.test", password: "DemoManager123!", name: "Akosua Mensah" };

const FEW_ROOMS_LEFT = 2;

const img = (file) => `/images/${file}.webp`;

const HOSTELS = [
  {
    name: "Dufie Annex", location: "Dufie Annex, Berekuso", distance: 1.2, price: 7000, startingPrice: 6500,
    availability: "AVAILABLE", amenities: ["WIFI", "LAUNDRY", "KITCHEN_ACCESS"],
    images: [img("Dufie_Annex_1"), img("Dufie_Annex_2")],
  },
  {
    name: "Dufie Platinum", location: "Dufie Platinum, Berekuso", distance: 0.5, price: 6500, startingPrice: 6000,
    availability: "FEW ROOMS LEFT", amenities: ["WIFI", "KITCHEN_ACCESS"],
    images: [img("Dufie_Platinum_1"), img("Dufie_Platinum_2"), img("Dufie_Platinum_3")],
    desc: "Classic on-campus experience with modern facilities. Live right on campus where everything is close by.",
  },
  {
    name: "Tanko", location: "Tanko Apartment, Berekuso", distance: 0.5, price: 8000, startingPrice: 7500,
    availability: "AVAILABLE", amenities: ["WIFI", "GYM", "LAUNDRY", "RESERVED_1", "AIR_CONDITIONING"],
    images: [img("Tanko_1"), img("Tanko_2"), img("Tanko_3"), img("Tanko_4"), img("Tanko_5")],
  },
  {
    name: "New Hosanna", location: "New Hosanna, Berekuso", distance: 0.5, price: 8000, startingPrice: 6000,
    availability: "FULL", amenities: ["WIFI", "RESERVED_1"],
    images: ["/images/New%20Hosanna_1.webp", "/images/New_Hosanna_2png.webp", img("New_Hosanna_3")],
  },
  {
    name: "Old Hosanna", location: "Old Hosanna, Berekuso", distance: 0.5, price: 8000, startingPrice: 5000,
    availability: "AVAILABLE", amenities: ["RESERVED_1", "LAUNDRY"],
    images: [img("Old_Hosanna_1")],
  },
];

const DEFAULT_DESC =
  "Experience the layout and natural lighting of your future home. This premium hostel offers a combination of aesthetics and state-of-the-art facilities including max security, 24/7 water supply, and unlimited WiFi.";

// Same rule as seed.mjs: this creates an account with a publicly-known
// password, so only run against a dev or purely local deployment.
function assertLocalOrDev() {
  const deployment = process.env.CONVEX_DEPLOYMENT ?? "";
  let host = "";
  try {
    host = new URL(process.env.CONVEX_URL).hostname;
  } catch {
    // fall through to the refusal below
  }
  const isLocal = host === "127.0.0.1" || host === "localhost";
  if (deployment.startsWith("dev:") || isLocal) return;
  console.error(
    `Refusing to seed: CONVEX_DEPLOYMENT=${deployment || "<unset>"}, CONVEX_URL host=${host || "<none>"} is neither a dev nor a local deployment.`,
  );
  process.exit(1);
}

async function ensureManager() {
  const existing = await cq(api.users.findOne, { where: [{ field: "email", value: MANAGER.email }] });
  if (existing) return existing;

  const { user } = await auth.api.signUpEmail({ body: MANAGER });
  await cm(api.users.updateProfile, {
    id: user.id,
    patch: { user_type: "HOSTEL_MANAGER", profile_complete: true, payment_details: "Demo Bank 0123456789" },
  });
  console.log(`Created manager ${MANAGER.email} / ${MANAGER.password}`);
  return user;
}

async function main() {
  assertLocalOrDev();
  const manager = await ensureManager();
  const existing = new Set((await cq(api.hostels.listApproved, {})).map((h) => h.hostel_name));

  for (const spec of HOSTELS) {
    if (existing.has(spec.name)) {
      console.log(`  skip ${spec.name} (already exists)`);
      continue;
    }

    const hostel = await cm(api.hostels.create, {
      data: {
        hostel_name: spec.name, location: spec.location, description: spec.desc ?? DEFAULT_DESC,
        total_rooms: 0, available_rooms: 0, distance_from_campus: spec.distance,
        manager_id: manager.id, status: "APPROVED",
      },
    });
    await cm(api.amenities.addForHostel, { hostelId: hostel.id, names: spec.amenities });
    await cm(api.hostels.addImages, { hostelId: hostel.id, urls: spec.images });

    // Priced so the listing's cheapest/dearest room match the old
    // startingPrice/price figures.
    const mid = Math.round((spec.startingPrice + spec.price) / 2);
    const rooms = [
      { room_number: "A1", room_type: "SINGLE", price_per_bed: spec.price, capacity: 1 },
      { room_number: "B1", room_type: "DOUBLE", price_per_bed: mid, capacity: 2 },
      { room_number: "C1", room_type: "QUAD", price_per_bed: spec.startingPrice, capacity: 4 },
    ];
    for (const room of rooms) {
      await cm(api.rooms.create, { data: { ...room, hostel_id: hostel.id } });
    }

    // rooms.create always leaves every room available; the old availability
    // badge is reproduced by setting the hostel's free-room counter directly.
    const available = { AVAILABLE: rooms.length, "FEW ROOMS LEFT": FEW_ROOMS_LEFT, FULL: 0 }[spec.availability];
    await cm(api.hostels.update, { id: hostel.id, patch: { available_rooms: available } });

    console.log(`  added ${spec.name} (${spec.availability})`);
  }

  const listed = await cq(api.hostels.listApproved, {});
  console.log(`\nDone. Public listing shows ${listed.length} approved hostel(s).`);
}

main().catch((err) => {
  console.error("\nSeeding failed:", err?.message || err?.name || err?.cause?.message || String(err));
  process.exit(1);
});
