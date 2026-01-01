// test-accrual-windows.js
console.log("Testing accrual on Windows...");

// Set environment
process.env.SUPABASE_URL = "YOUR_URL_HERE";
process.env.SUPABASE_SERVICE_ROLE_KEY = "YOUR_KEY_HERE";
process.env.GITHUB_ACTIONS = "true";

// Force 1st of month
const originalDate = global.Date;
global.Date = class extends Date {
  getDate() {
    return 1;
  }
};

const { addMonthlyAccruals } = require("./cron/monthly-accrual");

addMonthlyAccruals()
  .then(() => {
    console.log("✅ Test passed!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Test failed:", err.message);
    process.exit(1);
  });
