import "./loadEnv.js";
import app from "./app.js";
import { supabase } from "./config/db.js";
import { convex } from "./config/convex.js";
import { api } from "../convex/_generated/api.js";

const PORT = process.env.PORT || 5000;
const CONVEX_ADAPTER_SECRET = process.env.CONVEX_ADAPTER_SECRET;

app.listen(PORT, async () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);

  try {
    // Check Supabase Connection (using a simple auth api call or selecting a single row from a known table)
    // We'll just check if the client instantiated properly and can reach the REST API endpoint.
    // The easiest way to check if the Supabase URL/KEY works is fetching a row from a built-in table or one we expect.
    // Alternatively, we can check `supabase.auth.getSession()` or a simple select.
    const { error } = await supabase.from('user').select('id').limit(1);
    
    // If the error is simply because the table doesn't exist yet, it still contacted the server.
    // A network connection error or invalid key would error differently, but this is a good enough check.
    if (error && error.code !== '42P01' && error.code !== 'PGRST116') { // 42P01/PGRST116 mean table missing but connected
       console.error("⚠️ Supabase connected, but returned an error:", error.message);
    } else {
       console.log("✅ Supabase is connected and operational.");
    }
  } catch (error) {
    console.error("❌ Supabase connection failed:", error.message);
  }

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