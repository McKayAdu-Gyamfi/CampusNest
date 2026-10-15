// better-auth's own internal adapter (findVerificationValue, session-list
// helpers) always sends sortBy as { field, direction } — never a string or
// an array of sort keys. This is the only shape this adapter needs to
// support; anything else throws rather than silently ignoring the sort.
export interface SortBy {
  field: string;
  direction?: "asc" | "desc";
}

export function applySort<T extends Record<string, any>>(docs: T[], sortBy: unknown): T[] {
  if (sortBy === undefined) return docs;

  const s = sortBy as Partial<SortBy>;
  if (
    typeof s !== "object" ||
    s === null ||
    typeof s.field !== "string" ||
    (s.direction !== undefined && s.direction !== "asc" && s.direction !== "desc")
  ) {
    throw new Error(`Unsupported sortBy shape: ${JSON.stringify(sortBy)}`);
  }

  const { field, direction } = s as SortBy;
  return [...docs].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    let cmp = 0;
    if (av < bv) cmp = -1;
    else if (av > bv) cmp = 1;
    return direction === "desc" ? -cmp : cmp;
  });
}
