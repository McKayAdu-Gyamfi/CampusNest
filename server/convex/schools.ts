import { v, ConvexError } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";

function normaliseDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/^@/, "");
}

function emailDomain(email: string | undefined) {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  return at === -1 ? null : email.slice(at + 1).toLowerCase();
}

async function assertDomainFree(ctx: any, domain: string, exceptId?: any) {
  const existing = await ctx.db
    .query("schools")
    .withIndex("by_email_domain", (q: any) => q.eq("email_domain", domain))
    .first();
  if (existing && existing._id !== exceptId) {
    throw new ConvexError({ code: "DUPLICATE_SCHOOL_DOMAIN" });
  }
}

// Student counts are derived at read time from email domains rather than
// stored, so they cannot drift from the users table. Exact domain match only.
export const list = secureQuery({}, async (ctx) => {
  const schools = await ctx.db.query("schools").collect();
  const users = await ctx.db.query("users").collect();
  const studentsByDomain = new Map<string, number>();
  for (const u of users) {
    if (u.user_type !== "STUDENT") continue;
    const d = emailDomain(u.email);
    if (d) studentsByDomain.set(d, (studentsByDomain.get(d) ?? 0) + 1);
  }

  const out = [];
  for (const school of schools) {
    const hostels = await ctx.db
      .query("hostels")
      .withIndex("by_school_id", (q: any) => q.eq("school_id", school._id))
      .collect();
    out.push({
      ...toApiRow(school),
      hostel_count: hostels.length,
      student_count: studentsByDomain.get(school.email_domain) ?? 0,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
});

export const create = secureMutation(
  { name: v.string(), location: v.string(), email_domain: v.string() },
  async (ctx, { name, location, email_domain }) => {
    const domain = normaliseDomain(email_domain);
    await assertDomainFree(ctx, domain);
    const now = Date.now();
    const id = await ctx.db.insert("schools", {
      name: name.trim(),
      location: location.trim(),
      email_domain: domain,
      created_at: now,
      updated_at: now,
    });
    return toApiRow((await ctx.db.get(id))!);
  }
);

export const update = secureMutation(
  {
    id: v.string(),
    name: v.optional(v.string()),
    location: v.optional(v.string()),
    email_domain: v.optional(v.string()),
  },
  async (ctx, { id, name, location, email_domain }) => {
    const schoolId = ctx.db.normalizeId("schools", id);
    if (!schoolId) return null;
    const school = await ctx.db.get(schoolId);
    if (!school) return null;

    const patch: Record<string, any> = { updated_at: Date.now() };
    if (name !== undefined) patch.name = name.trim();
    if (location !== undefined) patch.location = location.trim();
    if (email_domain !== undefined) {
      patch.email_domain = normaliseDomain(email_domain);
      await assertDomainFree(ctx, patch.email_domain, schoolId);
    }
    await ctx.db.patch(schoolId, patch);
    return toApiRow((await ctx.db.get(schoolId))!);
  }
);

async function bedTotal(ctx: any, hostelId: any) {
  const rooms = await ctx.db
    .query("rooms")
    .withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", hostelId))
    .collect();
  return rooms.reduce((sum: number, r: any) => sum + r.capacity, 0);
}

function hostelSummary(h: any, beds: number) {
  return {
    id: h._id,
    hostel_name: h.hostel_name,
    location: h.location,
    distance_from_campus: h.distance_from_campus ?? null,
    status: h.status,
    beds,
  };
}

export const listHostels = secureQuery({ schoolId: v.string() }, async (ctx, { schoolId }) => {
  const id = ctx.db.normalizeId("schools", schoolId);
  if (!id) return null;
  if (!(await ctx.db.get(id))) return null;
  const hostels = await ctx.db
    .query("hostels")
    .withIndex("by_school_id", (q: any) => q.eq("school_id", id))
    .collect();
  const out = [];
  for (const h of hostels) out.push(hostelSummary(h, await bedTotal(ctx, h._id)));
  return out;
});

// For the "Add hostel" picker: hostels attached to no school.
export const listUnassignedHostels = secureQuery({}, async (ctx) => {
  const hostels = await ctx.db.query("hostels").collect();
  return hostels
    .filter((h: any) => !h.school_id)
    .map((h: any) => hostelSummary(h, 0))
    .sort((a: any, b: any) => a.hostel_name.localeCompare(b.hostel_name));
});

// Attaching a hostel that already belongs to another school moves it.
export const assignHostel = secureMutation(
  { schoolId: v.string(), hostelId: v.string() },
  async (ctx, { schoolId, hostelId }) => {
    const sid = ctx.db.normalizeId("schools", schoolId);
    if (!sid || !(await ctx.db.get(sid))) throw new ConvexError({ code: "SCHOOL_NOT_FOUND" });
    const hid = ctx.db.normalizeId("hostels", hostelId);
    if (!hid || !(await ctx.db.get(hid))) throw new ConvexError({ code: "HOSTEL_NOT_FOUND" });
    await ctx.db.patch(hid, { school_id: sid, updated_at: Date.now() });
    return { success: true };
  }
);

// Takes the school id too and no-ops unless the hostel actually belongs to
// that school, so an admin route scoped to one school cannot detach a
// hostel from a different one.
export const unassignHostel = secureMutation(
  { schoolId: v.string(), hostelId: v.string() },
  async (ctx, { schoolId, hostelId }) => {
    const sid = ctx.db.normalizeId("schools", schoolId);
    const hid = ctx.db.normalizeId("hostels", hostelId);
    if (!sid || !hid) return { success: true };
    const hostel = await ctx.db.get(hid);
    if (!hostel || hostel.school_id !== sid) return { success: true };
    await ctx.db.patch(hid, { school_id: undefined, updated_at: Date.now() });
    return { success: true };
  }
);
