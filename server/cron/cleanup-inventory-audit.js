const { createClient } = require("@supabase/supabase-js");

console.log("=== Loading Supabase Client ===");

// Load .env file
require("dotenv").config({ path: "./.env" });

// Get environment variables - try multiple names
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_KEY;

console.log("Environment check:");
console.log("SUPABASE_URL:", supabaseUrl ? "✓ Found" : "✗ Missing");
console.log(
  "SUPABASE_SERVICE_ROLE_KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "✓ Found" : "✗ Missing"
);
console.log(
  "SUPABASE_SERVICE_KEY:",
  process.env.SUPABASE_SERVICE_KEY ? "✓ Found" : "✗ Missing"
);
console.log(
  "SUPABASE_KEY:",
  process.env.SUPABASE_KEY ? "✓ Found" : "✗ Missing"
);
console.log("Selected key:", supabaseKey ? "✓ Found" : "✗ Missing");

if (!supabaseUrl || !supabaseKey) {
  console.error("\n❌ ERROR: Missing Supabase environment variables!");
  console.error("Please check your .env file or GitHub Secrets.");
  console.error("");
  console.error("For GitHub Actions, make sure you have:");
  console.error("1. SUPABASE_URL");
  console.error("2. SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)");
  console.error("");
  console.error("Current process.env keys that contain 'SUPABASE':");
  Object.keys(process.env).forEach((key) => {
    if (key.includes("SUPABASE")) {
      console.error(`   ${key}: ${process.env[key].substring(0, 10)}...`);
    }
  });
  process.exit(1);
}

console.log("✅ Supabase client created successfully");
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
