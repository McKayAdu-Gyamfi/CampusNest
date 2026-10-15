// server/convex/lib/whereMatch.ts
export interface WhereClause {
  field: string;
  value: unknown;
  operator?: string;
}

export function validateWhere(where: WhereClause[]): void {
  for (const clause of where) {
    if (clause.operator && clause.operator !== "eq") {
      throw new Error(
        `Unsupported where operator "${clause.operator}" on field "${clause.field}" — this adapter only supports equality ("eq") lookups.`
      );
    }
  }
}

export function matchesWhere(doc: Record<string, unknown>, where: WhereClause[]): boolean {
  validateWhere(where);
  return where.every((clause) => doc[clause.field] === clause.value);
}
