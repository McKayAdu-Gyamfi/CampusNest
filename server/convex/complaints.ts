// server/convex/complaints.ts
import { v } from "convex/values";
import { toApiRow } from "./lib/toApiRow";
import { secureQuery, secureMutation } from "./lib/secureFunction";

const complaintStatus = v.union(v.literal("OPEN"), v.literal("IN_PROGRESS"), v.literal("RESOLVED"));

async function withUser(ctx: any, complaint: any, includeHostel: boolean) {
  const row = toApiRow(complaint);

  const student = await ctx.db.get(complaint.student_id);
  row.USERS = student ? { email: student.email, profile_complete: student.profile_complete } : null;

  if (includeHostel) {
    const hostel = await ctx.db.get(complaint.hostel_id);
    row.HOSTEL = hostel ? { hostel_name: hostel.hostel_name } : null;
  }
  return row;
}

export const list = secureQuery(
  {
    studentId: v.optional(v.string()),
    hostelId: v.optional(v.string()),
    hostelManagerId: v.optional(v.string()),
  },
  async (ctx, { studentId, hostelId, hostelManagerId }) => {
    let rows;
    if (studentId !== undefined) {
      const id = ctx.db.normalizeId("users", studentId);
      if (!id) return [];
      rows = await ctx.db
        .query("complaints")
        .withIndex("by_student_id", (q: any) => q.eq("student_id", id))
        .collect();
    } else if (hostelManagerId !== undefined) {
      const id = ctx.db.normalizeId("users", hostelManagerId);
      if (!id) return [];
      rows = await ctx.db
        .query("complaints")
        .withIndex("by_hostel_manager_id", (q: any) => q.eq("hostel_manager_id", id))
        .collect();
    } else if (hostelId !== undefined) {
      const id = ctx.db.normalizeId("hostels", hostelId);
      if (!id) return [];
      rows = await ctx.db
        .query("complaints")
        .withIndex("by_hostel_id", (q: any) => q.eq("hostel_id", id))
        .collect();
    } else {
      rows = await ctx.db.query("complaints").collect();
    }

    // The remaining filters narrow whatever the index returned, so every
    // combination the controller can send is honored.
    if (hostelManagerId !== undefined && studentId !== undefined) {
      const managerId = ctx.db.normalizeId("users", hostelManagerId);
      rows = rows.filter((c: any) => c.hostel_manager_id === managerId);
    }
    if (hostelId !== undefined && (studentId !== undefined || hostelManagerId !== undefined)) {
      const hid = ctx.db.normalizeId("hostels", hostelId);
      rows = rows.filter((c: any) => c.hostel_id === hid);
    }

    return await Promise.all(rows.map((c: any) => withUser(ctx, c, true)));
  }
);

export const getByIdWithUser = secureQuery({ id: v.string() }, async (ctx, { id }) => {
  const complaintId = ctx.db.normalizeId("complaints", id);
  if (!complaintId) return null;
  const complaint = await ctx.db.get(complaintId);
  if (!complaint) return null;
  return await withUser(ctx, complaint, false);
});

export const create = secureMutation({ data: v.any() }, async (ctx, { data }) => {
  const hostelId = ctx.db.normalizeId("hostels", data.hostel_id);
  if (!hostelId) throw new Error("Hostel not found");
  const studentId = ctx.db.normalizeId("users", data.student_id);
  if (!studentId) throw new Error("Student not found");
  const managerId = data.hostel_manager_id
    ? ctx.db.normalizeId("users", data.hostel_manager_id)
    : null;

  const now = Date.now();
  const complaintId = await ctx.db.insert("complaints", {
    content: data.content,
    status: "OPEN",
    student_id: studentId,
    hostel_manager_id: managerId ?? undefined,
    hostel_id: hostelId,
    created_at: now,
    updated_at: now,
  });
  return toApiRow((await ctx.db.get(complaintId))!);
});

export const updateStatus = secureMutation(
  { id: v.string(), status: complaintStatus },
  async (ctx, { id, status }) => {
    const complaintId = ctx.db.normalizeId("complaints", id);
    if (!complaintId) return null;
    const complaint = await ctx.db.get(complaintId);
    if (!complaint) return null;
    await ctx.db.patch(complaintId, { status, updated_at: Date.now() });
    return toApiRow((await ctx.db.get(complaintId))!);
  }
);
