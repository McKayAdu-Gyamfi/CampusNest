// Holds a response back until at least `ms` have passed since the request arrived.
//
// Used on the password-reset request: for an unknown email better-auth hashes a
// dummy password, for a real one it writes a token, and the two take measurably
// different times (about 0.2s apart). Always answering after the same floor stops
// the response time from revealing which emails have an account.
export function minResponseTime(ms) {
  return (req, res, next) => {
    if (!(ms > 0)) return next();
    const started = Date.now();
    const end = res.end.bind(res);
    res.end = (...args) => {
      const wait = ms - (Date.now() - started);
      if (wait > 0) setTimeout(() => end(...args), wait);
      else end(...args);
      return res;
    };
    next();
  };
}

// Comfortably above the slowest observed path (~1.3s cold). Tests turn it off.
export const PASSWORD_RESET_MIN_MS = process.env.NODE_ENV === "test" ? 0 : 1500;
