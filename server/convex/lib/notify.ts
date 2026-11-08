// Inserts an in-app notification inside the caller's transaction, so it
// exists if and only if the event that caused it was committed.
export async function notify(
  ctx: any,
  userId: any,
  n: { type: string; title: string; message: string; bookingId?: any; link?: string },
) {
  if (!userId) return;
  await ctx.db.insert("notifications", {
    user_id: userId,
    type: n.type,
    title: n.title,
    message: n.message,
    read: false,
    booking_id: n.bookingId ?? undefined,
    link: n.link ?? undefined,
    created_at: Date.now(),
  });
}

/** Tells every admin (e.g. a hostel is waiting for approval). */
export async function notifyAdmins(
  ctx: any,
  n: { type: string; title: string; message: string; link?: string },
) {
  const users = await ctx.db.query("users").collect();
  for (const u of users) {
    if (u.user_type === "ADMIN" && !u.suspended_at) await notify(ctx, u._id, n);
  }
}
