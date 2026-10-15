import "./loadEnv.js";
import app from "./app.js";
import { supabase } from "./config/db.js";

const PORT = process.env.PORT || 5000;

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
  
  console.log("---------------------------------------------------");
});