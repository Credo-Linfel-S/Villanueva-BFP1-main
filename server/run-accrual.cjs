// server/run-accrual.cjs
require("dotenv").config();
console.log("Starting accrual runner...");

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
    console.log("✅ Success");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  })
  .finally(() => {
    global.Date = originalDate;
  });
