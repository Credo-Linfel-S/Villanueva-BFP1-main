// server/test.js
require("dotenv").config();
const path = require("path");

console.log("Current directory:", __dirname);
console.log("Environment file path:", path.resolve(__dirname, ".env"));
console.log(
  "File exists:",
  require("fs").existsSync(path.resolve(__dirname, ".env"))
);

console.log("\n=== ENVIRONMENT VARIABLES ===");
console.log(
  "VITE_SUPABASE_URL:",
  process.env.VITE_SUPABASE_URL ? "EXISTS" : "NOT FOUND"
);
console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "EXISTS" : "NOT FOUND");
console.log(
  "VITE_SUPABASE_SERVICE_ROLE_KEY:",
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    ? "EXISTS (first 10 chars: " +
        process.env.VITE_SUPABASE_SERVICE_ROLE_KEY.substring(0, 10) +
        "...)"
    : "NOT FOUND"
);
console.log(
  "SUPABASE_SERVICE_ROLE_KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "EXISTS" : "NOT FOUND"
);
