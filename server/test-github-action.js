// server/test-github-action.js
// Simulates what GitHub Actions will do

console.log("🧪 Simulating GitHub Actions environment...");

// Set environment variables
process.env.SUPABASE_URL = "your_url_here";
process.env.SUPABASE_SERVICE_ROLE_KEY = "your_key_here";

// Temporarily override Date to bypass "1st of month" check
const originalDate = global.Date;
global.Date = class extends Date {
  getDate() {
    return 1;
  } // Always return 1st
  getMonth() {
    return new originalDate().getMonth();
  }
  getFullYear() {
    return new originalDate().getFullYear();
  }
  toISOString() {
    return new originalDate().toISOString();
  }
  toLocaleString(locale, options) {
    return new originalDate().toLocaleString(locale, options);
  }
};

console.log(
  "Simulated date (1st of month):",
  new Date().toLocaleString("en-PH")
);

// Run accrual
const { addMonthlyAccruals } = require("./cron/monthly-accrual");

addMonthlyAccruals()
  .then(() => {
    console.log("✅ Test passed! Ready for GitHub Actions.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  })
  .finally(() => {
    global.Date = originalDate;
  });
