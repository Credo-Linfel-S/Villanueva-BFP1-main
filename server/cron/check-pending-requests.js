// .github/scripts/check-pending-requests.js
const { createClient } = require("@supabase/supabase-js");

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminUserId = process.env.ADMIN_USER_ID;

if (!supabaseUrl || !supabaseKey || !adminUserId) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPendingLeaveRequests() {
  try {
    console.log("🔍 Checking pending leave requests...");

    // Get leave requests pending for more than 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: pendingRequests, error } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "Pending")
      .lte("created_at", twentyFourHoursAgo.toISOString());

    if (error) throw error;

    if (pendingRequests && pendingRequests.length > 0) {
      console.log(
        `📋 Found ${pendingRequests.length} leave requests pending for 24+ hours`
      );

      for (const request of pendingRequests) {
        // Check if notification already exists for this request
        const { data: existingNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("data->>leave_request_id", request.id)
          .eq("type", "warning")
          .single();

        if (!existingNotification) {
          // Create notification for admin
          const { error: notificationError } = await supabase
            .from("notifications")
            .insert({
              user_id: adminUserId,
              title: "Pending Leave Request - Urgent",
              message: `Leave request from ${request.employee_name} has been pending for 24+ hours`,
              type: "warning",
              data: {
                source: "leave_request",
                leave_request_id: request.id,
                employee_name: request.employee_name,
                days_pending: 1,
                timestamp: new Date().toISOString(),
              },
            });

          if (notificationError) {
            console.error("Error creating notification:", notificationError);
          } else {
            console.log(
              `✅ Created notification for leave request ${request.id}`
            );
          }
        }
      }
    } else {
      console.log("✅ No leave requests pending for 24+ hours");
    }
  } catch (error) {
    console.error("Error checking leave requests:", error);
  }
}

async function checkNewLeaveRequests() {
  try {
    console.log("🔍 Checking for new leave requests...");

    // Get leave requests created in the last 1 hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { data: newRequests, error } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("status", "Pending")
      .gte("created_at", oneHourAgo.toISOString());

    if (error) throw error;

    if (newRequests && newRequests.length > 0) {
      console.log(`📋 Found ${newRequests.length} new leave requests`);

      for (const request of newRequests) {
        // Check if notification already exists
        const { data: existingNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("data->>leave_request_id", request.id)
          .eq("type", "warning")
          .single();

        if (!existingNotification) {
          // Create notification
          const { error: notificationError } = await supabase
            .from("notifications")
            .insert({
              user_id: adminUserId,
              title: "New Leave Request",
              message: `${
                request.employee_name
              } submitted a ${request.leave_type.toLowerCase()} leave request`,
              type: "warning",
              data: {
                source: "leave_request",
                leave_request_id: request.id,
                employee_name: request.employee_name,
                leave_type: request.leave_type,
                num_days: request.num_days,
                timestamp: new Date().toISOString(),
              },
            });

          if (notificationError) {
            console.error("Error creating notification:", notificationError);
          } else {
            console.log(
              `✅ Created notification for new leave request ${request.id}`
            );
          }
        }
      }
    } else {
      console.log("✅ No new leave requests in the last hour");
    }
  } catch (error) {
    console.error("Error checking new leave requests:", error);
  }
}

async function main() {
  console.log("🚀 Starting notification check...");
  console.log("===============================");

  await checkNewLeaveRequests();
  console.log("---");
  await checkPendingLeaveRequests();

  console.log("===============================");
  console.log("✅ Notification check completed");
}

// Run the script
main().catch(console.error);
