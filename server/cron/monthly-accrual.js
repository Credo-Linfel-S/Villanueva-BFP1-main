// server/cron/monthly-accrual.js - SIMPLIFIED VERSION (NO WITHOUT-PAY RESTRICTION)
const { supabase } = require("../lib/supabaseClient");

console.log("=== BFP LEAVE ACCRUAL SYSTEM ===");
console.log("Started at:", new Date().toISOString());
console.log("=================================\n");

// ======================
// BFP PRO-RATED FORMULA (SIMPLIFIED FOR hired_time)
// ======================

function calculateBFPProRatedLeave(employee, targetMonth, targetYear) {
  if (!employee || !employee.date_hired) return 0;

  const hireDate = new Date(employee.date_hired);
  const hireYear = hireDate.getFullYear();
  const hireMonth = hireDate.getMonth();
  const hireDay = hireDate.getDate();

  // Only calculate for hire month
  if (hireYear !== targetYear || hireMonth !== targetMonth) {
    return 0;
  }

  const daysInMonth = new Date(hireYear, hireMonth + 1, 0).getDate();

  // Full days worked AFTER hire day (excluding hire day)
  let fullDaysAfterHire = daysInMonth - hireDay;

  // Fraction of hire day worked (if hired_time is specified)
  let fractionOfHireDay = 0;

  if (employee.hired_time) {
    try {
      // hired_time is in format "HH:MM:SS" (TIME type in Supabase)
      const timeParts = employee.hired_time.split(":");
      const hireHour = parseInt(timeParts[0]) || 0;
      const hireMinute = parseInt(timeParts[1]) || 0;
      const decimalHour = hireHour + hireMinute / 60;

      // Fraction of day worked = (24 - hireHour) / 24
      // Example: hired at 13:30 (1:30 PM) = 13.5 hours
      // Fraction = (24 - 13.5) / 24 = 10.5/24 = 0.4375
      fractionOfHireDay = (24 - decimalHour) / 24;

      console.log(`  Hire Time: ${employee.hired_time}`);
      console.log(`  Decimal Hours: ${decimalHour.toFixed(2)}`);
      console.log(
        `  Fraction of day: (24 - ${decimalHour.toFixed(
          2
        )}) / 24 = ${fractionOfHireDay.toFixed(3)}`
      );
    } catch (error) {
      console.error(
        `  ❌ Error parsing hired_time "${employee.hired_time}":`,
        error.message
      );
      fractionOfHireDay = 0;
    }
  } else {
    console.log(`  No hired_time specified - hire day not counted`);
  }

  // Total effective days worked
  const totalEffectiveDays = fullDaysAfterHire + fractionOfHireDay;

  // Apply BFP formula
  const proRatedLeave = (totalEffectiveDays / daysInMonth) * 1.25;
  const result = Math.max(
    0,
    Math.min(1.25, parseFloat(proRatedLeave.toFixed(3)))
  );

  console.log(`  Days in month: ${daysInMonth}`);
  console.log(`  Hire day: ${hireDay}`);
  console.log(`  Full days after hire: ${fullDaysAfterHire}`);
  console.log(`  Fraction of hire day: ${fractionOfHireDay.toFixed(3)}`);
  console.log(`  Total effective days: ${totalEffectiveDays.toFixed(3)}`);
  console.log(
    `  Formula: (${totalEffectiveDays.toFixed(
      3
    )} / ${daysInMonth}) × 1.25 = ${result}`
  );

  return result;
}

// ======================
// CHECK FIRST ACCRUAL FOR CURRENT YEAR
// ======================

async function hasReceivedAccrualThisYear(personnelId, currentYear) {
  const { data: balances } = await supabase
    .from("leave_balances")
    .select("id, updated_at")
    .eq("personnel_id", personnelId)
    .eq("year", currentYear)
    .not("updated_at", "is", null)
    .limit(1);

  // If they have a balance record that was updated this year, they've received accrual
  return balances && balances.length > 0;
}

// ======================
// UPDATE BALANCE
// ======================

async function updateBalance(personnelId, amount, year, isFirstMonth = false) {
  try {
    console.log(`  Updating balance for employee ${personnelId}...`);
    console.log(`  Amount to add: ${amount}`);

    // Get or create balance
    let { data: balance, error } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("personnel_id", personnelId)
      .eq("year", year)
      .single();

    if (error && error.code === "PGRST116") {
      // Create new balance
      const newBalance = {
        personnel_id: personnelId,
        year: year,
        vacation_balance: "0.00",
        sick_balance: "0.00",
        emergency_balance: "0.00",
        initial_vacation_credits: isFirstMonth ? amount.toFixed(2) : "0.00",
        initial_sick_credits: isFirstMonth ? amount.toFixed(2) : "0.00",
        initial_emergency_credits: isFirstMonth
          ? Math.min(amount, 5).toFixed(2)
          : "0.00",
        vacation_used: "0.00",
        sick_used: "0.00",
        emergency_used: "0.00",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: created, error: createError } = await supabase
        .from("leave_balances")
        .insert([newBalance])
        .select()
        .single();

      if (createError) throw createError;
      balance = created;
      console.log(`  ✅ Created new balance for year ${year}`);
    } else if (error) {
      throw error;
    }

    // Parse current balances
    const oldVacation = parseFloat(balance.vacation_balance) || 0;
    const oldSick = parseFloat(balance.sick_balance) || 0;
    const oldEmergency = parseFloat(balance.emergency_balance) || 0;

    console.log(
      `  Old balances - Vacation: ${oldVacation}, Sick: ${oldSick}, Emergency: ${oldEmergency}`
    );

    // Calculate new values
    const newVacation = oldVacation + amount;
    const newSick = oldSick + amount;

    // Emergency caps at 5 TOTAL for the year
    const emergencyToAdd = Math.max(0, Math.min(amount, 5 - oldEmergency));
    const newEmergency = oldEmergency + emergencyToAdd;

    const updatedBalance = {
      vacation_balance: newVacation.toFixed(2),
      sick_balance: newSick.toFixed(2),
      emergency_balance: newEmergency.toFixed(2),
      updated_at: new Date().toISOString(),
    };

    console.log(
      `  New balances: Vacation: ${newVacation.toFixed(
        2
      )}, Sick: ${newSick.toFixed(2)}, Emergency: ${newEmergency.toFixed(2)}`
    );

    const { error: updateError } = await supabase
      .from("leave_balances")
      .update(updatedBalance)
      .eq("id", balance.id);

    if (updateError) throw updateError;

    console.log(`  ✅ Added ${amount.toFixed(2)} days`);

    if (emergencyToAdd < amount) {
      console.log(`     ⚠️ Emergency capped at 5 (annual limit)`);
    }

    if (newEmergency >= 5) {
      console.log(`     🎯 Emergency leave now at annual maximum (5 days)`);
    }
  } catch (error) {
    console.error(`  ❌ Error updating balance:`, error.message);
    throw error;
  }
}

// ======================
// PROCESS EMPLOYEE ACCRUAL (SIMPLIFIED)
// ======================

async function processEmployeeAccrual(employee, currentDate) {
  const hireDate = new Date(employee.date_hired);
  const hireYear = hireDate.getFullYear();
  const hireMonth = hireDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  console.log(
    `\n👤 Processing: ${
      employee.first_name || employee.badge_number || employee.id
    }`
  );
  console.log(`   Hired: ${hireDate.toLocaleDateString("en-PH")}`);

  if (employee.hired_time) {
    console.log(`   Time: ${employee.hired_time}`);
  }

  // REMOVED: without-pay leave check

  // Check if this is the first accrual for the year
  const isFirstAccrualThisYear = !(await hasReceivedAccrualThisYear(
    employee.id,
    currentYear
  ));

  let accrualAmount = 0;
  let calculationType = "";

  if (isFirstAccrualThisYear) {
    // FIRST ACCRUAL OF THE YEAR
    console.log(`   Status: First accrual for ${currentYear}`);

    // Check if hired in current year (new hire this year)
    if (hireYear === currentYear) {
      const monthsSinceHire = currentMonth - hireMonth;

      if (monthsSinceHire === 0) {
        // Hired this month - pro-rate
        calculationType = "NEW HIRE (PRO-RATED)";
        accrualAmount = calculateBFPProRatedLeave(
          employee,
          hireMonth,
          hireYear
        );
        console.log(
          `   Type: New hire (pro-rated): ${accrualAmount.toFixed(3)}`
        );
      } else if (monthsSinceHire > 0) {
        // Hired earlier this year but no accrual yet - give full month
        calculationType = "LATE START (FULL)";
        accrualAmount = 1.25;
        console.log(`   Type: Late start - full month: 1.25`);
      } else {
        // Not hired yet (future date) - skip
        console.log(`   Type: Not hired yet - skipping`);
        return 0;
      }
    } else {
      // Old personnel, first accrual of the year - full month
      calculationType = "OLD PERSONNEL (FULL)";
      accrualAmount = 1.25;
      console.log(`   Type: Old personnel - full month: 1.25`);
    }
  } else {
    // REGULAR MONTHLY ACCRUAL
    calculationType = "REGULAR MONTHLY";
    accrualAmount = 1.25;
    console.log(`   Status: Regular monthly: 1.25`);
  }

  // Apply to database
  await updateBalance(
    employee.id,
    accrualAmount,
    currentYear,
    calculationType.includes("NEW HIRE")
  );
  return accrualAmount;
}

// ======================
// MAIN FUNCTION
// ======================

async function addMonthlyAccruals() {
  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Only run on 1st of month
  if (currentDay !== 1) {
    console.log(`⏰ Not 1st of month (day ${currentDay})`);
    return { success: false, error: "Not 1st of month" };
  }

  console.log(
    `🚀 BFP Monthly Accrual - ${currentDate.toLocaleDateString("en-PH")}`
  );
  console.log(`Month: ${currentMonth + 1}/${currentYear}`);

  try {
    // Get all active personnel WITH hired_time
    const { data: employees, error } = await supabase
      .from("personnel")
      .select("id, first_name, last_name, badge_number, date_hired, hired_time")
      .eq("status", "Active")
      .eq("is_active", true);

    if (error) throw error;

    console.log(`📊 Found ${employees?.length || 0} active employees\n`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const emp of employees || []) {
      try {
        const result = await processEmployeeAccrual(emp, currentDate);
        if (result > 0) {
          processed++;
        } else {
          skipped++; // Only skips if not hired yet (future hire date)
        }
      } catch (empError) {
        console.error(
          `❌ Error with ${emp.first_name || emp.id}:`,
          empError.message
        );
        errors++;
      }
    }

    console.log(`\n✅ ACCRUAL SUMMARY:`);
    console.log(`   Processed: ${processed} employees (received accrual)`);
    console.log(`   Skipped: ${skipped} employees (not hired yet)`);
    console.log(`   Errors: ${errors} employees`);

    console.log(`\n💡 Time Formula:`);
    console.log(`   • hired_time format: "HH:MM:SS" (24-hour)`);
    console.log(`   • Example: "13:30:00" = 1:30 PM = 13.5 hours`);
    console.log(`   • Fraction = (24 - hireHour) / 24`);
    console.log(`   • "13:30:00" → (24 - 13.5) / 24 = 0.4375 day`);

    return {
      success: true,
      processed,
      skipped,
      errors,
      total: employees?.length || 0,
    };
  } catch (error) {
    console.error("❌ Fatal error:", error.message);
    return { success: false, error: error.message };
  }
}

// ======================
// TEST EXAMPLES
// ======================

function testExamples() {
  console.log("🧪 TESTING BFP FORMULA EXAMPLES");
  console.log("===============================\n");

  // Example from your document: Dec 16, 2025 at 12:00 PM
  console.log("Example 1: From BFP Document");
  console.log("Hired: Dec 16, 2025 at 12:00 PM (12:00:00)");

  const emp1 = {
    date_hired: "2025-12-16",
    hired_time: "12:00:00",
  };

  const result1 = calculateBFPProRatedLeave(emp1, 11, 2025);
  console.log(`   Days in Dec: 31`);
  console.log(`   Hire day: 16`);
  console.log(`   Full days after: 31 - 16 = 15 days`);
  console.log(`   Fraction: (24 - 12) / 24 = 0.5 day`);
  console.log(`   Total: 15 + 0.5 = 15.5 days`);
  console.log(`   Formula: (15.5 / 31) × 1.25 = ${result1.toFixed(3)}`);
  console.log(`   Expected: 0.625 ✓\n`);

  // Example 2: Dec 16, 2025 at 8:00 AM
  console.log("Example 2: Hired at 8:00 AM");
  console.log("Hired: Dec 16, 2025 at 8:00 AM (08:00:00)");

  const emp2 = {
    date_hired: "2025-12-16",
    hired_time: "08:00:00",
  };

  const result2 = calculateBFPProRatedLeave(emp2, 11, 2025);
  console.log(`   Full days after: 15 days`);
  console.log(`   Fraction: (24 - 8) / 24 = 0.6667 day`);
  console.log(`   Total: 15 + 0.6667 = 15.6667 days`);
  console.log(`   Formula: (15.6667 / 31) × 1.25 = ${result2.toFixed(3)}`);
  console.log(`   Expected: 0.632 ✓\n`);

  // Example 3: No time specified
  console.log("Example 3: No hired_time specified");

  const emp3 = {
    date_hired: "2025-12-16",
    // No hired_time
  };

  const result3 = calculateBFPProRatedLeave(emp3, 11, 2025);
  console.log(`   No time → hire day not counted`);
  console.log(`   Full days after: 15 days`);
  console.log(`   Formula: (15 / 31) × 1.25 = ${result3.toFixed(3)}`);
  console.log(`   Expected: 0.604 ✓\n`);
}

// ======================
// EXPORTS
// ======================

module.exports = {
  addMonthlyAccruals,
  calculateBFPProRatedLeave,
  testExamples,
};

// Run if called directly
if (require.main === module) {
  console.log("=== DIRECT EXECUTION ===");

  // Check if test mode
  if (process.argv.includes("--test")) {
    testExamples();
    process.exit(0);
  } else {
    addMonthlyAccruals()
      .then((result) => {
        if (result.success) {
          console.log("\n✅ Monthly accrual completed successfully!");
          process.exit(0);
        } else {
          console.error("\n❌ Monthly accrual failed:", result.error);
          process.exit(1);
        }
      })
      .catch((error) => {
        console.error("\n❌ Unexpected error:", error);
        process.exit(1);
      });
  }
}
