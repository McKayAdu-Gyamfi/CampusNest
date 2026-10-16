// Business rows only. The four better-auth tables keep using toApiDoc,
// because better-auth's adapter does its own Date conversion and expects
// epoch numbers back from Convex.
//
// Postgres returned TIMESTAMPTZ as an ISO string, so these fields are
// stored as epoch ms (Convex has no date type) and converted on the way
// out. Returning the raw number instead breaks date rendering silently.
const DATE_FIELDS = new Set([
  "created_at",
  "updated_at",
  "createdAt",
  "updatedAt",
  "check_in_date",
  "check_out_date",
]);

export function toApiRow<T extends { _id: unknown; _creationTime: number }>(doc: T): Record<string, any> {
  const { _id, _creationTime, ...rest } = doc as any;
  const out: Record<string, any> = { id: _id };
  for (const [key, value] of Object.entries(rest)) {
    out[key] = DATE_FIELDS.has(key) && typeof value === "number" ? new Date(value).toISOString() : value;
  }
  return out;
}
