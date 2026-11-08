// A payment Paystack confirmed but whose booking could not be created
// (e.g. incomplete profile, network drop). Kept so the student can finish the
// booking instead of losing the payment. The server only accepts a reference
// once, so retrying is safe.
const KEY = "cn.pendingPayment.v1";

export interface PendingPayment {
  reference: string;
  hostelId: string;
  price: number;
  userId: string;
  hostelName?: string;
}

export const getPendingPayment = (userId: string | undefined): PendingPayment | null => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "null") as PendingPayment | null;
    return p && userId && p.userId === userId ? p : null;
  } catch {
    return null;
  }
};
export const setPendingPayment = (p: PendingPayment) => {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
};
export const clearPendingPayment = () => {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
};
