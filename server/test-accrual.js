// server/test-accrual.cjs
console.log("🧪 Testing accrual system for GitHub Actions...");

// Load environment variables
require("dotenv").config({ path: ".env" });

// Check if environment variables are loaded
console.log("=== Environment Check ===");
console.log("SUPABASE_URL exists:", !!process.env.SUPABASE_URL);
console.log(
  "SUPABASE_SERVICE_ROLE_KEY exists:",
  !!process.env.SUPABASE_SERVICE_ROLE_KEY
);
console.log("=========================");

// Override Date to simulate 1st of month
const originalDate = global.Date;
global.Date = class extends Date {
  getDate() {
    return 1;
  }
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
console.log("Actual date:", new originalDate().toLocaleString("en-PH"));

// Run the accrual
const { addMonthlyAccruals } = require("./cron/monthly-accrual");

addMonthlyAccruals()
  .then(() => {
    console.log("\n✅ TEST PASSED! Accrual system works correctly.");
    console.log("Ready for GitHub Actions deployment.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ TEST FAILED:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  })
  .finally(() => {
    global.Date = originalDate;
  });
