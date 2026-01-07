// .github/scripts/check-applicant-updates.js
const { supabase } = require("../lib/supabaseClient");




async function checkNewResumeUploads() {
  try {
    console.log("📄 Checking for new resume uploads...");

    // Get applicants who uploaded resume in last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: applicantsWithResume, error } = await supabase
      .from("recruitment_personnel")
      .select("*")
      .not("resume_url", "is", null)
      .gte("updated_at", twentyFourHoursAgo.toISOString())
      .order("updated_at", { ascending: false });

    if (error) throw error;

    if (applicantsWithResume && applicantsWithResume.length > 0) {
      console.log(
        `📄 Found ${applicantsWithResume.length} applicants with new resumes`
      );

      for (const applicant of applicantsWithResume) {
        // Check if notification already exists for this resume upload
        const { data: existingNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("data->>applicant_id", applicant.id)
          .eq("data->>notification_type", "resume_uploaded")
          .eq("data->>resume_url", applicant.resume_url)
          .single();

        if (!existingNotification) {
          // Create notification
          const { error: notificationError } = await supabase
            .from("notifications")
            .insert({
              user_id: adminUserId,
              title: "Resume Uploaded",
              message: `${
                applicant.full_name || applicant.candidate
              } uploaded a resume for ${applicant.position} position`,
              type: "info",
              data: {
                source: "recruitment",
                notification_type: "resume_uploaded",
                applicant_id: applicant.id,
                applicant_name: applicant.full_name || applicant.candidate,
                position: applicant.position,
                resume_url: applicant.resume_url,
                timestamp: new Date().toISOString(),
              },
            });

          if (notificationError) {
            console.error(
              "Error creating resume notification:",
              notificationError
            );
          } else {
            console.log(
              `✅ Created resume notification for applicant ${applicant.id}`
            );
          }
        }
      }
    } else {
      console.log("✅ No new resume uploads in last 24 hours");
    }
  } catch (error) {
    console.error("Error checking resume uploads:", error);
  }
}

async function checkStageChanges() {
  try {
    console.log("🔄 Checking for stage changes...");

    // Get applicants with stage changes in last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: stageChanges, error } = await supabase
      .from("recruitment_personnel")
      .select("*")
      .not("stage", "is", null)
      .gte("updated_at", twentyFourHoursAgo.toISOString())
      .order("updated_at", { ascending: false });

    if (error) throw error;

    if (stageChanges && stageChanges.length > 0) {
      console.log(
        `🔄 Found ${stageChanges.length} applicants with recent updates`
      );

      // Get old data for comparison (you might want to store audit trail in a separate table)
      // For now, we'll just notify of the current stage

      for (const applicant of stageChanges) {
        // Skip if applicant was just created (not really a stage change)
        const created = new Date(applicant.created_at);
        const updated = new Date(applicant.updated_at);
        const timeDifference = updated - created;

        // If updated within 5 minutes of creation, it's probably the initial stage
        if (timeDifference < 5 * 60 * 1000) {
          continue;
        }

        // Check if notification already exists for this stage change
        const { data: existingNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("data->>applicant_id", applicant.id)
          .eq("data->>notification_type", "stage_changed")
          .eq("data->>new_stage", applicant.stage)
          .gte("created_at", twentyFourHoursAgo.toISOString())
          .single();

        if (!existingNotification) {
          // Get stage icon
          const stageIcon = getStageIcon(applicant.stage);

          // Create notification
          const { error: notificationError } = await supabase
            .from("notifications")
            .insert({
              user_id: adminUserId,
              title: "Stage Updated",
              message: `${
                applicant.full_name || applicant.candidate
              } moved to ${applicant.stage} stage`,
              type: "info",
              data: {
                source: "recruitment",
                notification_type: "stage_changed",
                applicant_id: applicant.id,
                applicant_name: applicant.full_name || applicant.candidate,
                position: applicant.position,
                old_stage: "Unknown", // You'll need an audit table for this
                new_stage: applicant.stage,
                stage_icon: stageIcon,
                timestamp: new Date().toISOString(),
              },
            });

          if (notificationError) {
            console.error(
              "Error creating stage change notification:",
              notificationError
            );
          } else {
            console.log(
              `✅ Created stage change notification for applicant ${applicant.id}`
            );
          }
        }
      }
    } else {
      console.log("✅ No stage changes in last 24 hours");
    }
  } catch (error) {
    console.error("Error checking stage changes:", error);
  }
}

async function checkStatusChanges() {
  try {
    console.log("📊 Checking for status changes...");

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: statusChanges, error } = await supabase
      .from("recruitment_personnel")
      .select("*")
      .not("status", "is", null)
      .gte("updated_at", twentyFourHoursAgo.toISOString())
      .order("updated_at", { ascending: false });

    if (error) throw error;

    if (statusChanges && statusChanges.length > 0) {
      console.log(
        `📊 Found ${statusChanges.length} applicants with status changes`
      );

      for (const applicant of statusChanges) {
        // Important status changes
        const importantStatuses = ["Hired", "Rejected", "Offered"];

        if (importantStatuses.includes(applicant.status)) {
          // Check if notification already exists
          const { data: existingNotification } = await supabase
            .from("notifications")
            .select("id")
            .eq("data->>applicant_id", applicant.id)
            .eq("data->>notification_type", "status_changed")
            .eq("data->>new_status", applicant.status)
            .gte("created_at", twentyFourHoursAgo.toISOString())
            .single();

          if (!existingNotification) {
            const statusIcon = getStatusIcon(applicant.status);
            const isPositive =
              applicant.status === "Hired" || applicant.status === "Offered";

            const { error: notificationError } = await supabase
              .from("notifications")
              .insert({
                user_id: adminUserId,
                title: "Status Update",
                message: `${applicant.full_name || applicant.candidate} - ${
                  applicant.status
                }`,
                type: isPositive ? "success" : "warning",
                data: {
                  source: "recruitment",
                  notification_type: "status_changed",
                  applicant_id: applicant.id,
                  applicant_name: applicant.full_name || applicant.candidate,
                  position: applicant.position,
                  old_status: "Unknown",
                  new_status: applicant.status,
                  status_icon: statusIcon,
                  timestamp: new Date().toISOString(),
                },
              });

            if (notificationError) {
              console.error(
                "Error creating status notification:",
                notificationError
              );
            } else {
              console.log(
                `✅ Created status notification for applicant ${applicant.id}`
              );
            }
          }
        }
      }
    } else {
      console.log("✅ No important status changes in last 24 hours");
    }
  } catch (error) {
    console.error("Error checking status changes:", error);
  }
}

async function checkNewInterviewDates() {
  try {
    console.log("📅 Checking for new interview dates...");

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: newInterviews, error } = await supabase
      .from("recruitment_personnel")
      .select("*")
      .not("interview_date", "is", null)
      .gte("updated_at", twentyFourHoursAgo.toISOString())
      .order("interview_date", { ascending: true });

    if (error) throw error;

    if (newInterviews && newInterviews.length > 0) {
      console.log(
        `📅 Found ${newInterviews.length} applicants with new interview dates`
      );

      for (const applicant of newInterviews) {
        // Check if notification already exists
        const { data: existingNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("data->>applicant_id", applicant.id)
          .eq("data->>notification_type", "interview_scheduled")
          .eq("data->>interview_date", applicant.interview_date)
          .gte("created_at", twentyFourHoursAgo.toISOString())
          .single();

        if (!existingNotification) {
          const interviewDate = new Date(applicant.interview_date);
          const formattedDate = interviewDate.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          const { error: notificationError } = await supabase
            .from("notifications")
            .insert({
              user_id: adminUserId,
              title: "Interview Scheduled",
              message: `${
                applicant.full_name || applicant.candidate
              } - Interview on ${formattedDate}`,
              type: "info",
              data: {
                source: "recruitment",
                notification_type: "interview_scheduled",
                applicant_id: applicant.id,
                applicant_name: applicant.full_name || applicant.candidate,
                position: applicant.position,
                interview_date: applicant.interview_date,
                formatted_date: formattedDate,
                timestamp: new Date().toISOString(),
              },
            });

          if (notificationError) {
            console.error(
              "Error creating interview notification:",
              notificationError
            );
          } else {
            console.log(
              `✅ Created interview notification for applicant ${applicant.id}`
            );
          }
        }
      }
    } else {
      console.log("✅ No new interview dates in last 24 hours");
    }
  } catch (error) {
    console.error("Error checking interview dates:", error);
  }
}

async function checkUpcomingInterviews() {
  try {
    console.log("⏰ Checking upcoming interviews...");

    // Check interviews happening tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    // Check interviews happening in 2 days
    const twoDays = new Date();
    twoDays.setDate(twoDays.getDate() + 2);
    const twoDaysDate = twoDays.toISOString().split("T")[0];

    const { data: upcomingInterviews, error } = await supabase
      .from("recruitment_personnel")
      .select("*")
      .not("interview_date", "is", null)
      .or(`interview_date.eq.${tomorrowDate},interview_date.eq.${twoDaysDate}`)
      .order("interview_date", { ascending: true });

    if (error) throw error;

    if (upcomingInterviews && upcomingInterviews.length > 0) {
      console.log(`⏰ Found ${upcomingInterviews.length} upcoming interviews`);

      // Group by interview date
      const interviewsByDate = {};
      upcomingInterviews.forEach((applicant) => {
        if (!interviewsByDate[applicant.interview_date]) {
          interviewsByDate[applicant.interview_date] = [];
        }
        interviewsByDate[applicant.interview_date].push(applicant);
      });

      // Create notifications for each date
      for (const [date, applicants] of Object.entries(interviewsByDate)) {
        const interviewDate = new Date(date);
        const daysUntil = Math.ceil(
          (interviewDate - new Date()) / (1000 * 60 * 60 * 24)
        );

        // Check if reminder already exists
        const { data: existingReminder } = await supabase
          .from("notifications")
          .select("id")
          .eq("data->>reminder_date", date)
          .eq("data->>notification_type", "interview_reminder")
          .gte(
            "created_at",
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          )
          .single();

        if (!existingReminder) {
          const formattedDate = interviewDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          });

          const { error: reminderError } = await supabase
            .from("notifications")
            .insert({
              user_id: adminUserId,
              title: `Interview${
                applicants.length > 1 ? "s" : ""
              } in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`,
              message: `${applicants.length} interview${
                applicants.length !== 1 ? "s" : ""
              } scheduled for ${formattedDate}`,
              type: "info",
              data: {
                source: "recruitment",
                notification_type: "interview_reminder",
                reminder_date: date,
                days_until: daysUntil,
                interview_count: applicants.length,
                applicant_names: applicants.map(
                  (a) => a.full_name || a.candidate
                ),
                positions: [...new Set(applicants.map((a) => a.position))],
                timestamp: new Date().toISOString(),
              },
            });

          if (reminderError) {
            console.error("Error creating interview reminder:", reminderError);
          } else {
            console.log(`✅ Created interview reminder for ${date}`);
          }
        }
      }
    } else {
      console.log("✅ No upcoming interviews in next 2 days");
    }
  } catch (error) {
    console.error("Error checking upcoming interviews:", error);
  }
}

async function checkNewApplicationDates() {
  try {
    console.log("📝 Checking for new application dates...");

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: newApplications, error } = await supabase
      .from("recruitment_personnel")
      .select("*")
      .not("application_date", "is", null)
      .gte("updated_at", twentyFourHoursAgo.toISOString())
      .order("application_date", { ascending: false });

    if (error) throw error;

    if (newApplications && newApplications.length > 0) {
      console.log(`📝 Found ${newApplications.length} new application dates`);

      for (const applicant of newApplications) {
        // Check if notification already exists
        const { data: existingNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("data->>applicant_id", applicant.id)
          .eq("data->>notification_type", "application_date_set")
          .eq("data->>application_date", applicant.application_date)
          .gte("created_at", twentyFourHoursAgo.toISOString())
          .single();

        if (!existingNotification) {
          const appDate = new Date(applicant.application_date);
          const formattedDate = appDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          const { error: notificationError } = await supabase
            .from("notifications")
            .insert({
              user_id: adminUserId,
              title: "Application Date Recorded",
              message: `${
                applicant.full_name || applicant.candidate
              } applied on ${formattedDate}`,
              type: "info",
              data: {
                source: "recruitment",
                notification_type: "application_date_set",
                applicant_id: applicant.id,
                applicant_name: applicant.full_name || applicant.candidate,
                position: applicant.position,
                application_date: applicant.application_date,
                formatted_date: formattedDate,
                timestamp: new Date().toISOString(),
              },
            });

          if (notificationError) {
            console.error(
              "Error creating application date notification:",
              notificationError
            );
          } else {
            console.log(
              `✅ Created application date notification for applicant ${applicant.id}`
            );
          }
        }
      }
    } else {
      console.log("✅ No new application dates in last 24 hours");
    }
  } catch (error) {
    console.error("Error checking application dates:", error);
  }
}

// Helper functions
function getStageIcon(stage) {
  const icons = {
    Applied: "📝",
    Screening: "🔍",
    Interview: "💬",
    Assessment: "📊",
    "Background Check": "🔎",
    "Final Review": "👨‍⚖️",
    Offered: "📜",
    Hired: "🎉",
    Rejected: "❌",
  };
  return icons[stage] || "👤";
}

function getStatusIcon(status) {
  const icons = {
    Active: "✅",
    Inactive: "⏸️",
    Hired: "🎉",
    Rejected: "❌",
    Offered: "📜",
    Withdrawn: "🚪",
    "On Hold": "⏳",
  };
  return icons[status] || "📋";
}

async function main() {
  console.log("🚀 Starting recruitment applicant check...");
  console.log("===============================");

  await checkNewResumeUploads();
  console.log("---");

  await checkStageChanges();
  console.log("---");

  await checkStatusChanges();
  console.log("---");

  await checkNewInterviewDates();
  console.log("---");

  await checkUpcomingInterviews();
  console.log("---");

  await checkNewApplicationDates();

  console.log("===============================");
  console.log("✅ Recruitment applicant check completed");
}

// Run the script
main().catch(console.error);
