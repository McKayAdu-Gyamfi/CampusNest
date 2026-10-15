// server/convex/lib/toApiDoc.ts
export function toApiDoc<T extends { _id: unknown; _creationTime: number }>(
  doc: T
): Omit<T, "_id" | "_creationTime"> & { id: T["_id"] } {
  const { _id, _creationTime, ...rest } = doc;
  return { ...rest, id: _id };
}
