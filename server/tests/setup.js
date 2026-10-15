// Reuses the app's own env-loading module (loads .env.local, where Convex's
// CLI writes CONVEX_URL, before .env) so the test suite sees exactly the
// same environment the real server does — importing auth.js (directly or
// via app.js) now throws at import time if CONVEX_URL is missing, and the
// old .env-only loading here left it unset for every test file.
import '../src/loadEnv.js';

// Silencing logs during tests if necessary
// process.env.LOG_LEVEL = 'error';
