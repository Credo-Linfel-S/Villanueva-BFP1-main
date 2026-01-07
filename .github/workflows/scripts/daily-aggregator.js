// .github/scripts/daily-aggregator.js
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminUserId = process.env.ADMIN_USER_ID;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createDailySummary() {
  try {
    console.log("📊 Creating daily summary...");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split("T")[0];

    // Get counts for yesterday
    const [leaveRequests, inspections, applicants] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${yesterdayDate}T00:00:00`)
        .lte("created_at", `${yesterdayDate}T23:59:59`),

      supabase
        .from("inspections")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${yesterdayDate}T00:00:00`)
        .lte("created_at", `${yesterdayDate}T23:59:59`),

      supabase
        .from("recruitment_personnel")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${yesterdayDate}T00:00:00`)
        .lte("created_at", `${yesterdayDate}T23:59:59`),
    ]);

    const leaveCount = leaveRequests.count || 0;
    const inspectionCount = inspections.count || 0;
    const applicantCount = applicants.count || 0;

    console.log(`📈 Yesterday's activity:`);
    console.log(`   Leave Requests: ${leaveCount}`);
    console.log(`   Inspections: ${inspectionCount}`);
    console.log(`   Applicants: ${applicantCount}`);

    // Create daily summary notification
    const { error } = await supabase.from("notifications").insert({
      user_id: adminUserId,
      title: "Daily Activity Summary",
      message: `Yesterday: ${leaveCount} leave requests, ${inspectionCount} inspections, ${applicantCount} applicants`,
      type: "info",
      data: {
        source: "daily_summary",
        summary_date: yesterdayDate,
        leave_requests: leaveCount,
        inspections: inspectionCount,
        applicants: applicantCount,
        timestamp: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("Error creating daily summary:", error);
    } else {
      console.log("✅ Daily summary created");
    }
  } catch (error) {
    console.error("Error in daily aggregator:", error);
  }
}

async function main() {
  console.log("🚀 Starting daily aggregator...");
  console.log("===============================");

  await createDailySummary();

  console.log("===============================");
  console.log("✅ Daily aggregator completed");
}

main().catch(console.error);
