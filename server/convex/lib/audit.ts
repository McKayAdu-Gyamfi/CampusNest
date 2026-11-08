// Records an admin action inside the caller's transaction, so the log row
// exists if and only if the change was committed.
export async function audit(
  ctx: any,
  entry: { actorId?: any; action: string; targetType: string; targetId: string; summary: string },
) {
  if (!entry.actorId) return;
  await ctx.db.insert("auditLogs", {
    actor_id: entry.actorId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: String(entry.targetId),
    summary: entry.summary,
    created_at: Date.now(),
  });
}
