import { cq, cm } from "../../config/convexClient.js";
import { api } from "../../../convex/_generated/api.js";

// Structured Convex error codes → HTTP. Branch on err.data.code, never the
// message: Convex redacts plain error messages on production deployments.
const CODE_STATUS = {
  DUPLICATE_SCHOOL_DOMAIN: [409, "A school with that email domain already exists"],
  SCHOOL_NOT_FOUND: [404, "School not found"],
  HOSTEL_NOT_FOUND: [404, "Hostel not found"],
};

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    const mapped = CODE_STATUS[err.data?.code];
    if (mapped) return res.status(mapped[0]).json({ success: false, message: mapped[1] });
    next(err);
  }
};

export const listSchools = handle(async (req, res) => {
  res.json({ success: true, data: await cq(api.schools.list, {}) });
});

export const createSchool = handle(async (req, res) => {
  res.status(201).json({ success: true, data: await cm(api.schools.create, { ...req.body, actorId: req.user.id }) });
});

export const updateSchool = handle(async (req, res) => {
  const data = await cm(api.schools.update, { id: req.params.id, ...req.body, actorId: req.user.id });
  if (!data) return res.status(404).json({ success: false, message: "School not found" });
  res.json({ success: true, data });
});

export const deleteSchool = handle(async (req, res) => {
  const data = await cm(api.schools.remove, { id: req.params.id, actorId: req.user.id });
  if (!data) return res.status(404).json({ success: false, message: "School not found" });
  res.json({ success: true, data });
});

export const listSchoolHostels = handle(async (req, res) => {
  const data = await cq(api.schools.listHostels, { schoolId: req.params.id });
  if (!data) return res.status(404).json({ success: false, message: "School not found" });
  res.json({ success: true, data });
});

export const listUnassignedHostels = handle(async (req, res) => {
  res.json({ success: true, data: await cq(api.schools.listUnassignedHostels, {}) });
});

export const assignHostel = handle(async (req, res) => {
  await cm(api.schools.assignHostel, { schoolId: req.params.id, hostelId: req.body.hostel_id });
  res.status(201).json({ success: true, message: "Hostel attached to school" });
});

export const unassignHostel = handle(async (req, res) => {
  await cm(api.schools.unassignHostel, { schoolId: req.params.id, hostelId: req.params.hostelId });
  res.json({ success: true, message: "Hostel detached from school" });
});
