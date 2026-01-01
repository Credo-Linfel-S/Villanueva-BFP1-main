// server/test-github-runner.js
process.env.GITHUB_ACTIONS = "true";
process.env.NODE_ENV = "production";

// Load your actual .env file
require("dotenv").config();

console.log("🧪 Testing GitHub Actions runner...");
console.log("SUPABASE_URL loaded:", !!process.env.SUPABASE_URL);
console.log("GITHUB_ACTIONS:", process.env.GITHUB_ACTIONS);

// Force 1st of month
const originalDate = global.Date;
global.Date = class extends Date {
  getDate() {
    return 1;
  }
};

// Run accrual
const { addMonthlyAccruals } = require("./cron/monthly-accrual");

addMonthlyAccruals()
  .then(() => {
    console.log("✅ Test passed! Ready for GitHub Actions.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  });
