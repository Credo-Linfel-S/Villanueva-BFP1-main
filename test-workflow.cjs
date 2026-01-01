// test-workflow.js - Run this to simulate GitHub Actions
console.log("🧪 Testing GitHub Actions workflow locally...");

// Set environment variables (use your actual values)
process.env.SUPABASE_URL = "https://wqjzbyblmcrxafcbljij.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxanpieWJsbWNyeGFmY2JsamlqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTE4ODQ4MCwiZXhwIjoyMDgwNzY0NDgwfQ.1Ahk-0tyu5NrNJLC4_pyAPmPf9_aZj1YpPWfgn4mftk";

// Temporarily modify Date
const originalDate = global.Date;
global.Date = class extends Date {
  getDate() {
    return 1;
  }
};

console.log("Simulating 1st of month...");

// Import and run your accrual
const { addMonthlyAccruals } = require("./server/cron/monthly-accrual");

addMonthlyAccruals()
  .then(() => {
    console.log("✅ Local test PASSED! Ready for GitHub Actions.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Local test FAILED:", error);
    process.exit(1);
  })
  .finally(() => {
    global.Date = originalDate;
  });
