import "./loadEnv.js";
import app from "./app.js";
import { convex } from "./config/convex.js";
import { api } from "../convex/_generated/api.js";

const PORT = process.env.PORT || 5000;
const CONVEX_ADAPTER_SECRET = process.env.CONVEX_ADAPTER_SECRET;

app.listen(PORT, async () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);

  try {
    // Cheap ping: findMany with an empty where clause on the smallest
    // auth table, same CONVEX_ADAPTER_SECRET every real adapter call uses
    // — proves both network reachability and secret correctness.
    await convex.query(api.verifications.findMany, { where: [], limit: 1, secret: CONVEX_ADAPTER_SECRET });
    console.log("✅ Convex is connected and operational.");
  } catch (error) {
    console.error("❌ Convex connection failed:", error.message);
  }

  console.log("---------------------------------------------------");
});