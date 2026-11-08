import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../../middlewares/auth.middleware.js";

const router = Router();
const PAYSTACK = "https://api.paystack.co";

// Paystack's secret key never leaves the server: the browser only ever gets a
// one-time access_code to open the checkout popup.
async function paystack(path, init = {}) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    const err = new Error("Payments are not configured (PAYSTACK_SECRET_KEY is missing).");
    err.statusCode = 503;
    throw err;
  }
  const res = await fetch(`${PAYSTACK}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status === false) {
    const err = new Error(body.message || `Paystack request failed (${res.status})`);
    err.statusCode = 502;
    throw err;
  }
  return body.data;
}

// Paystack rejects reserved TLDs such as the demo accounts' ".test" addresses,
// so those fall back to a placeholder address (it only identifies the customer).
const paystackEmail = (email) =>
  /\.(test|invalid|localhost|example)$/i.test(email) ? `${email.split("@")[0]}@campusnest.app` : email;

const CHANNELS = { momo: ["mobile_money"], card: ["card"] };

// POST /api/payments/initialize  { amount (GHS), method?: "momo" | "card", metadata? }
router.post("/initialize", requireAuth, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "A positive amount is required" });
    }
    const reference = `KC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const data = await paystack("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: paystackEmail(req.user.email),
        amount: Math.round(amount * 100), // Paystack takes the lowest unit (pesewas)
        currency: "GHS",
        reference,
        channels: CHANNELS[req.body.method],
        metadata: { user_id: req.user.id, ...(req.body.metadata ?? {}) },
      }),
    });
    res.json({ success: true, data: { access_code: data.access_code, reference: data.reference } });
  } catch (err) {
    next(err);
  }
});

/** Verified Paystack transaction, or throws. Amount is in GHS. */
export async function verifyTransaction(reference) {
  const data = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  return {
    status: data.status,
    reference: data.reference,
    amount: data.amount / 100,
    currency: data.currency,
    channel: data.channel,
    paid_at: data.paid_at,
    user_id: data.metadata?.user_id,
  };
}

// GET /api/payments/verify/:reference — the source of truth; never trust the popup callback alone.
router.get("/verify/:reference", requireAuth, async (req, res, next) => {
  try {
    const { user_id, ...tx } = await verifyTransaction(req.params.reference);
    if (user_id && user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "This payment belongs to another user" });
    }
    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
});

export default router;
