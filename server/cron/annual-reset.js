// server/cron/annual-reset.js - Annual Emergency Leave Reset
const { supabase } = require("../lib/supabaseClient");

console.log("=== BFP ANNUAL EMERGENCY LEAVE RESET ===");
console.log("Started at:", new Date().toISOString());
console.log("=========================================\n");

async function resetEmergencyBalances() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentDay = currentDate.getDate();
  const currentMonth = currentDate.getMonth(); // 0 = January

  // Only run on January 1st
  if (currentMonth !== 0 || currentDay !== 1) {
    console.log(
      `⏰ Not January 1st (${currentDate.toLocaleDateString("en-PH")})`
    );
    return {
      success: false,
      error: "Not January 1st",
      date: currentDate.toISOString(),
    };
  }

  console.log(`🎉 NEW YEAR ${currentYear}! Resetting emergency leave balances`);
  console.log(`Date: ${currentDate.toLocaleDateString("en-PH")}`);

  try {
    // Get all leave balances for the current year
    const { data: balances, error: fetchError } = await supabase
      .from("leave_balances")
      .select(
        "id, personnel_id, emergency_balance, personnel:personnel_id(first_name, last_name)"
      )
      .eq("year", currentYear);

    if (fetchError) throw fetchError;

    console.log(`📊 Found ${balances?.length || 0} leave balances to check\n`);

    let resetCount = 0;
    let skippedCount = 0;
    let errors = 0;

   for (const balance of balances || []) {
     try {
       const oldEmergency = parseFloat(balance.emergency_balance) || 0;

       // ALWAYS reset to 0 for new year, regardless of current value
       console.log(
         `🔄 Resetting ${balance.personnel?.first_name || "Unknown"} ${
           balance.personnel?.last_name || ""
         }`
       );
       console.log(`   Old emergency balance: ${oldEmergency.toFixed(2)}`);

       const { error: updateError } = await supabase
         .from("leave_balances")
         .update({
           emergency_balance: "0.00",
           emergency_used: "0.00", // Also reset used emergency
           updated_at: new Date().toISOString(),
         })
         .eq("id", balance.id);

       if (updateError) {
         console.error(`   ❌ Error:`, updateError.message);
         errors++;
       } else {
         console.log(`   ✅ Reset to 0.00`);
         resetCount++;
       }
     } catch (empError) {
       console.error(
         `❌ Error with balance ID ${balance.id}:`,
         empError.message
       );
       errors++;
     }
   }

    console.log(`\n✅ ANNUAL RESET COMPLETED:`);
    console.log(`   Reset: ${resetCount} employees`);
    console.log(`   Skipped: ${skippedCount} employees`);
    console.log(`   Errors: ${errors} employees`);

    return {
      success: true,
      resetCount,
      skippedCount,
      errors,
      total: balances?.length || 0,
      year: currentYear,
    };
  } catch (error) {
    console.error("❌ Fatal error:", error.message);
    return {
      success: false,
      error: error.message,
      year: currentYear,
    };
  }
}

// Export for use in other files
module.exports = {
  resetEmergencyBalances,
};

// Run if called directly
if (require.main === module) {
  console.log("=== DIRECT EXECUTION ===");
  resetEmergencyBalances()
    .then((result) => {
      if (result.success) {
        console.log(
          "\n✅ Annual emergency leave reset completed successfully!"
        );
        process.exit(0);
      } else {
        console.error("\n❌ Annual reset failed:", result.error);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("\n❌ Unexpected error:", error);
      process.exit(1);
    });
}
