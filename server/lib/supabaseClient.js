// server/lib/supabaseClient.js - CORRECTED VERSION
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

console.log("=== Checking environment variables ===");
console.log("SUPABASE_URL exists:", !!process.env.SUPABASE_URL);
console.log(
  "SUPABASE_SERVICE_ROLE_KEY exists:",
  !!process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Use the correct variable names (without VITE_ prefix)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ ERROR: Missing Supabase environment variables!");
  console.error("SUPABASE_URL:", supabaseUrl ? "✓ Found" : "✗ Missing");
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY:",
    supabaseServiceKey ? "✓ Found" : "✗ Missing"
  );
  console.error("\nPlease ensure your server/.env file contains:");
  console.error("SUPABASE_URL=https://your-project.supabase.co");
  console.error("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here");
  process.exit(1);
}

console.log("✅ Environment variables loaded successfully");
console.log("Supabase URL:", supabaseUrl.substring(0, 30) + "...");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase };
