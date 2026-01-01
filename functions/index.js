// functions/index.js
const functions = require("firebase-functions");
const { addMonthlyAccruals } = require("./monthly-accrual");

// MAIN SCHEDULED FUNCTION: Runs on 1st of every month at 2:00 AM Manila time
exports.monthlyAccrualJob = functions.pubsub
  .schedule("0 2 1 * *") // Cron: 0 minute, 2 hour, 1st day, every month
  .timeZone("Asia/Manila")
  .onRun(async (context) => {
    console.log("🚀 Running monthly leave accrual...");
    console.log("Date:", new Date().toISOString());

    try {
      await addMonthlyAccruals();
      console.log("✅ Monthly accrual completed successfully");
      return null;
    } catch (error) {
      console.error("❌ Monthly accrual failed:", error);
      throw error; // This will appear in Firebase logs
    }
  });

// MANUAL TRIGGER: For testing
exports.manualAccrual = functions.https.onRequest(async (req, res) => {
  console.log("🔧 Manual accrual triggered");

  try {
    await addMonthlyAccruals();
    res.json({
      success: true,
      message: "Manual accrual completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Manual accrual error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
