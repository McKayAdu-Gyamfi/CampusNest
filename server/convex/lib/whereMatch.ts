// server/convex/lib/whereMatch.ts
export interface WhereClause {
  field: string;
  value: unknown;
  operator?: string;
}

export function matchesWhere(doc: Record<string, unknown>, where: WhereClause[]): boolean {
  return where.every((clause) => {
    if (clause.operator && clause.operator !== "eq") {
      throw new Error(
        `Unsupported where operator "${clause.operator}" on field "${clause.field}" — this adapter only supports equality ("eq") lookups.`
      );
    }
    return doc[clause.field] === clause.value;
  });
}
