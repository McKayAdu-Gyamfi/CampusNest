import rateLimit from "express-rate-limit";

// Sign-in is the classic brute-force/credential-stuffing target — keep this tight.
export const signInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many sign-in attempts. Please try again later." },
});

// Password-reset requests send an email, so cap them per address to stop the
// endpoint being used to spam someone's inbox or burn the mail quota.
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many reset requests. Please try again in an hour." },
});

// Registration/sign-up is lower-frequency by nature; a looser window still
// stops automated account-creation spam without bothering real users.
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many accounts created from this address. Please try again later." },
});
