// server/test-accrual.js
const { addMonthlyAccruals } = require("./cron/monthly-accrual");

// Test with a specific employee
async function testAccrual() {
  console.log("🧪 Testing accrual system...");

  // Temporarily modify to run for any date
  const originalDate = Date;
  global.Date = class extends Date {
    getDate() {
      return 1;
    } // Force it to think it's the 1st
  };

  await addMonthlyAccruals();

  global.Date = originalDate;
  console.log("✅ Test completed");
}

testAccrual().catch(console.error);
