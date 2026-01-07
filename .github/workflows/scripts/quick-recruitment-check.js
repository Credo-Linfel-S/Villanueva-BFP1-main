// .github/scripts/quick-recruitment-check.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminUserId = process.env.ADMIN_USER_ID;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUrgentRecruitmentUpdates() {
  try {
    console.log("⚡ Running quick recruitment check...");

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    // Check for URGENT status changes (Hired/Rejected/Offered)
    const { data: urgentUpdates, error } = await supabase
      .from("recruitment_personnel")
      .select("*")
      .in("status", ["Hired", "Rejected", "Offered"])
      .gte("updated_at", oneHourAgo.toISOString())
      .order("updated_at", { ascending: false });

    if (error) throw error;

    if (urgentUpdates && urgentUpdates.length > 0) {
      console.log(
        `⚡ Found ${urgentUpdates.length} urgent updates in last hour`
      );

      for (const applicant of urgentUpdates) {
        // Check if notification exists
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("data->>applicant_id", applicant.id)
          .eq("data->>new_status", applicant.status)
          .gte("created_at", oneHourAgo.toISOString())
          .single();

        if (!existing) {
          const isPositive =
            applicant.status === "Hired" || applicant.status === "Offered";

          await supabase.from("notifications").insert({
            user_id: adminUserId,
            title: "URGENT: Status Update",
            message: `${applicant.full_name || applicant.candidate} - ${
              applicant.status
            }`,
            type: isPositive ? "success" : "warning",
            data: {
              source: "recruitment_urgent",
              applicant_id: applicant.id,
              applicant_name: applicant.full_name || applicant.candidate,
              new_status: applicant.status,
              timestamp: new Date().toISOString(),
            },
          });

          console.log(`⚡ Created urgent notification for ${applicant.id}`);
        }
      }
    }

    // Check for interviews happening TODAY
    const today = new Date().toISOString().split("T")[0];
    const { data: todaysInterviews, error: interviewError } = await supabase
      .from("recruitment_personnel")
      .select("*")
      .eq("interview_date", today)
      .order("created_at", { ascending: true });

    if (interviewError) throw interviewError;

    if (todaysInterviews && todaysInterviews.length > 0) {
      // Check if today's reminder exists
      const { data: existingReminder } = await supabase
        .from("notifications")
        .select("id")
        .eq("data->>reminder_date", today)
        .eq("data->>notification_type", "interview_today")
        .gte("created_at", oneHourAgo.toISOString())
        .single();

      if (!existingReminder) {
        await supabase.from("notifications").insert({
          user_id: adminUserId,
          title: "Interviews Today",
          message: `${todaysInterviews.length} interview${
            todaysInterviews.length !== 1 ? "s" : ""
          } scheduled for today`,
          type: "info",
          data: {
            source: "recruitment_today",
            reminder_date: today,
            interview_count: todaysInterviews.length,
            applicant_names: todaysInterviews.map(
              (a) => a.full_name || a.candidate
            ),
            timestamp: new Date().toISOString(),
          },
        });

        console.log(`📅 Created today's interview reminder`);
      }
    }

    console.log("✅ Quick recruitment check completed");
  } catch (error) {
    console.error("Error in quick check:", error);
  }
}

// Run the script
checkUrgentRecruitmentUpdates().catch(console.error);
