// server/scheduler.js
const cron = require("node-cron");
const { addMonthlyAccruals } = require("./cron/monthly-accrual");

console.log("📅 BFP Leave Management Scheduler");
console.log("Started at:", new Date().toLocaleString());
console.log("====================================");

// Run at 2:00 AM on 1st day of every month
cron.schedule("0 2 1 * *", () => {
  console.log("\n⏰ Running scheduled monthly accrual...");
  console.log("Time:", new Date().toLocaleString());
  addMonthlyAccruals()
    .then(() => {
      console.log("✅ Scheduled run completed");
    })
    .catch((error) => {
      console.error("❌ Scheduled run failed:", error);
    });
});

// Test run immediately (remove in production)
console.log("\n🧪 Running test accrual...");
addMonthlyAccruals()
  .then(() => {
    console.log("✅ Test run completed");
  })
  .catch((error) => {
    console.error("❌ Test run failed:", error);
  });

// Keep alive
console.log("\n🔄 Scheduler is running. Press Ctrl+C to stop.");
process.stdin.resume();
