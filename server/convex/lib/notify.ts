// Inserts an in-app notification inside the caller's transaction, so it
// exists if and only if the event that caused it was committed.
export async function notify(
  ctx: any,
  userId: any,
  n: { type: string; title: string; message: string; bookingId?: any },
) {
  if (!userId) return;
  await ctx.db.insert("notifications", {
    user_id: userId,
    type: n.type,
    title: n.title,
    message: n.message,
    read: false,
    booking_id: n.bookingId ?? undefined,
    created_at: Date.now(),
  });
}
