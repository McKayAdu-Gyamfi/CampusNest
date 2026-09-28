import "dotenv/config";
import { Pool } from "pg";

console.log("Connecting to database...");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query("SELECT NOW()", (err, res) => {
  if (err) console.error("Error:", err);
  else console.log("Success:", res.rows[0]);
  pool.end();
});
