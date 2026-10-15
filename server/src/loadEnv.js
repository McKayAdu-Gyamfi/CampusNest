// .env.local is where `npx convex dev` auto-writes CONVEX_DEPLOYMENT/
// CONVEX_URL/CONVEX_SITE_URL (its own convention, so it can keep rewriting
// this file on every deploy without touching the user's own .env). Load it
// first, then .env for everything else — dotenv never overrides a key
// that's already set, so .env can't clobber Convex's own values.
//
// This lives in its own module (rather than inline dotenv.config() calls in
// server.js) specifically so it can be imported as a bare side-effect
// import — only `import` statements get hoisted ahead of a module's own
// code in ES modules; plain function calls do not, which was the bug this
// file fixes.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
