import { apiFetch } from "./apiClient";

const SCRIPT_SRC = "https://js.paystack.co/v2/inline.js";

interface PaystackPopup {
  resumeTransaction: (
    accessCode: string,
    callbacks: { onSuccess?: (tx: { reference: string }) => void; onCancel?: () => void; onError?: (e: { message?: string }) => void },
  ) => void;
}
declare global {
  interface Window { PaystackPop?: new () => PaystackPopup }
}

function loadScript(): Promise<void> {
  if (window.PaystackPop) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SCRIPT_SRC;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Couldn't load Paystack. Check your connection and try again."));
    document.head.appendChild(el);
  });
}

export interface PaymentResult { reference: string; amount: number; channel: string }

/**
 * Charges `amount` (GHS) through Paystack. The server creates the transaction
 * with the secret key and, after the popup reports success, verifies it with
 * Paystack before this resolves. Resolves null if the user closes the popup.
 */
export async function payWithPaystack(amount: number, method: "momo" | "card"): Promise<PaymentResult | null> {
  const [init] = await Promise.all([
    apiFetch<{ access_code: string; reference: string }>("/payments/initialize", {
      method: "POST",
      body: JSON.stringify({ amount, method }),
    }),
    loadScript(),
  ]);

  const outcome = await new Promise<"success" | "cancelled">((resolve, reject) => {
    new window.PaystackPop!().resumeTransaction(init.access_code, {
      onSuccess: () => resolve("success"),
      onCancel: () => resolve("cancelled"),
      onError: (e) => reject(new Error(e?.message || "Payment failed")),
    });
  });
  if (outcome === "cancelled") return null;

  const v = await apiFetch<{ status: string; reference: string; amount: number; channel: string }>(
    `/payments/verify/${init.reference}`,
  );
  if (v.status !== "success") throw new Error("Payment was not completed.");
  return { reference: v.reference, amount: v.amount, channel: v.channel };
}
