const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();
const { program } = require("commander"); // Add commander for CLI options

// Initialize commander
program
  .option("--dry-run", "Show what would be deleted without actually deleting")
  .parse(process.argv);

const options = program.opts();

async function cleanupOldInventoryAudit() {
  console.log("🚀 Starting inventory audit cleanup...");
  console.log(
    `Mode: ${options.dryRun ? "DRY RUN (no deletions)" : "LIVE (will delete)"}`
  );

  // Get environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase environment variables");
    console.error(
      "   Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set"
    );
    process.exit(1);
  }

  console.log("✅ Supabase credentials loaded");

  // Create Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Calculate date 1 year ago in Philippine Time
    const now = new Date();
    console.log(`\n📅 Current time (UTC): ${now.toISOString()}`);
    console.log(
      `📅 Current time (PH): ${new Date(now.getTime() + 8 * 60 * 60 * 1000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", " PH Time")}`
    );

    // Set to Philippine Time (UTC+8) for calculation
    const nowPH = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const oneYearAgoPH = new Date(nowPH);
    oneYearAgoPH.setFullYear(oneYearAgoPH.getFullYear() - 1);

    // Convert back to UTC for database query
    const oneYearAgoUTC = new Date(oneYearAgoPH.getTime() - 8 * 60 * 60 * 1000);

    console.log(`\n🗑️  Will delete records older than:`);
    console.log(
      `   - Philippine Time: ${oneYearAgoPH
        .toISOString()
        .replace("T", " ")
        .replace("Z", "")}`
    );
    console.log(
      `   - UTC: ${oneYearAgoUTC
        .toISOString()
        .replace("T", " ")
        .replace("Z", "")}`
    );

    // Count records to be deleted
    const { count, error: countError } = await supabase
      .from("inventory_audit")
      .select("*", { count: "exact", head: true })
      .lt("performed_at", oneYearAgoUTC.toISOString());

    if (countError) {
      console.error("❌ Error counting records:", countError.message);
      throw countError;
    }

    console.log(`\n📊 Found ${count} records older than 1 year`);

    if (count > 0) {
      // Get sample of records that would be deleted
      const { data: sampleRecords, error: sampleError } = await supabase
        .from("inventory_audit")
        .select("id, item_name, item_code, action, performed_at")
        .lt("performed_at", oneYearAgoUTC.toISOString())
        .order("performed_at", { ascending: true })
        .limit(5);

      if (!sampleError && sampleRecords && sampleRecords.length > 0) {
        console.log("\n📝 Sample of oldest records to be deleted:");
        sampleRecords.forEach((record, index) => {
          const date = new Date(record.performed_at);
          const phDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
          console.log(
            `   ${index + 1}. ${record.item_name} (${record.item_code}) - ${
              record.action
            } on ${phDate
              .toISOString()
              .replace("T", " ")
              .replace("Z", " PH Time")}`
          );
        });
      }

      if (!options.dryRun) {
        console.log("\n🗑️  Deleting records...");

        // Delete in batches to avoid timeout for large datasets
        const BATCH_SIZE = 1000;
        let totalDeleted = 0;
        let hasMore = true;

        while (hasMore) {
          const { data: batch, error: deleteError } = await supabase
            .from("inventory_audit")
            .delete()
            .lt("performed_at", oneYearAgoUTC.toISOString())
            .limit(BATCH_SIZE)
            .select("id");

          if (deleteError) {
            console.error("❌ Error deleting batch:", deleteError.message);
            throw deleteError;
          }

          const batchDeleted = batch ? batch.length : 0;
          totalDeleted += batchDeleted;

          console.log(
            `   Deleted batch: ${batchDeleted} records (Total: ${totalDeleted})`
          );

          if (batchDeleted < BATCH_SIZE) {
            hasMore = false;
          }

          // Small delay between batches
          if (hasMore) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        console.log(
          `\n✅ Successfully deleted ${totalDeleted} old inventory audit records`
        );

        // Log the cleanup
        try {
          await supabase.from("system_logs").insert({
            action: "cleanup_inventory_audit",
            details: {
              deleted_count: totalDeleted,
              cutoff_date_utc: oneYearAgoUTC.toISOString(),
              cutoff_date_ph: oneYearAgoPH.toISOString(),
              executed_at: new Date().toISOString(),
              was_dry_run: false,
            },
            performed_by: "github_workflow",
            performed_at: new Date().toISOString(),
          });

          console.log("📝 Cleanup logged to system_logs table");
        } catch (logError) {
          console.warn(
            "⚠️  Could not log to system_logs table:",
            logError.message
          );
        }
      } else {
        console.log("\n⚠️  DRY RUN: No records were actually deleted");

        // Log dry run
        try {
          await supabase.from("system_logs").insert({
            action: "cleanup_inventory_audit_dry_run",
            details: {
              would_delete_count: count,
              cutoff_date_utc: oneYearAgoUTC.toISOString(),
              cutoff_date_ph: oneYearAgoPH.toISOString(),
              executed_at: new Date().toISOString(),
              was_dry_run: true,
            },
            performed_by: "github_workflow_dry_run",
            performed_at: new Date().toISOString(),
          });
        } catch (logError) {
          // Ignore if system_logs doesn't exist
        }
      }
    } else {
      console.log("\n✅ No records older than 1 year found");
    }

    console.log("\n🎉 Cleanup process completed");
  } catch (error) {
    console.error("\n❌ Cleanup failed:", error.message);

    // Send notification (optional - add your notification service here)
    // Example: Slack, Discord, Email

    process.exit(1);
  }
}

// Run the cleanup
cleanupOldInventoryAudit();
