// .github/scripts/check-upcoming-inspections.js
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminUserId = process.env.ADMIN_USER_ID;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUpcomingInspections() {
  try {
    console.log("🔍 Checking upcoming inspections...");

    // Get inspections scheduled for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const dayAfterTomorrowDate = dayAfterTomorrow.toISOString().split("T")[0];

    // Check for inspections tomorrow
    const { data: inspectionsTomorrow, error: tomorrowError } = await supabase
      .from("inspections")
      .select("*")
      .eq("status", "PENDING")
      .eq("schedule_inspection_date", tomorrowDate);

    if (tomorrowError) throw tomorrowError;

    if (inspectionsTomorrow && inspectionsTomorrow.length > 0) {
      console.log(
        `📅 Found ${inspectionsTomorrow.length} inspections scheduled for tomorrow`
      );

      for (const inspection of inspectionsTomorrow) {
        // Check if notification already exists
        const { data: existingNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("data->>inspection_id", inspection.id)
          .eq("data->>reminder_type", "tomorrow")
          .single();

        if (!existingNotification) {
          // Create notification
          const { error: notificationError } = await supabase
            .from("notifications")
            .insert({
              user_id: adminUserId,
              title: "Inspection Tomorrow",
              message: `Inspection scheduled for tomorrow: ${
                inspection.inspector_name || "Unknown inspector"
              }`,
              type: "info",
              data: {
                source: "inspection",
                inspection_id: inspection.id,
                inspector_name: inspection.inspector_name,
                schedule_date: inspection.schedule_inspection_date,
                reminder_type: "tomorrow",
                timestamp: new Date().toISOString(),
              },
            });

          if (notificationError) {
            console.error("Error creating notification:", notificationError);
          } else {
            console.log(
              `✅ Created notification for inspection ${inspection.id}`
            );
          }
        }
      }
    } else {
      console.log("✅ No inspections scheduled for tomorrow");
    }

    // Check for inspections in 3 days (for weekly reminder)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysDate = threeDaysFromNow.toISOString().split("T")[0];

    const { data: inspectionsThreeDays, error: threeDaysError } = await supabase
      .from("inspections")
      .select("*")
      .eq("status", "PENDING")
      .eq("schedule_inspection_date", threeDaysDate);

    if (threeDaysError) throw threeDaysError;

    if (inspectionsThreeDays && inspectionsThreeDays.length > 0) {
      console.log(
        `📅 Found ${inspectionsThreeDays.length} inspections in 3 days`
      );

      // Create weekly summary notification
      const { error: summaryError } = await supabase
        .from("notifications")
        .insert({
          user_id: adminUserId,
          title: "Weekly Inspection Summary",
          message: `You have ${inspectionsThreeDays.length} inspection(s) coming up in 3 days`,
          type: "info",
          data: {
            source: "inspection_summary",
            count: inspectionsThreeDays.length,
            upcoming_date: threeDaysDate,
            timestamp: new Date().toISOString(),
          },
        });

      if (summaryError) {
        console.error("Error creating summary notification:", summaryError);
      } else {
        console.log("✅ Created weekly inspection summary");
      }
    }
  } catch (error) {
    console.error("Error checking inspections:", error);
  }
}

async function main() {
  console.log("🚀 Starting inspection check...");
  console.log("===============================");

  await checkUpcomingInspections();

  console.log("===============================");
  console.log("✅ Inspection check completed");
}

main().catch(console.error);
