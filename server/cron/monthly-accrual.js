// server/cron/monthly-accrual.js - UPDATED WITH BFP FORMULA
const { supabase } = require("../lib/supabaseClient");

// ======================
// BFP PRO-RATED FORMULA
// ======================

/**
 * Calculate pro-rated leave credits for BFP
 * Formula: (Days Worked in Month / Total Days in Month) × 1.25
 * Days Worked = Total days from day AFTER hire to month-end + partial hire day (if time specified)
 */
function calculateBFPProRatedLeave(employee, targetMonth, targetYear) {
  if (!employee || !employee.date_hired) return 0;

  const hireDate = new Date(employee.date_hired);
  const hireYear = hireDate.getFullYear();
  const hireMonth = hireDate.getMonth();
  const hireDay = hireDate.getDate();

  // Check if hire date is in target month
  if (hireYear !== targetYear || hireMonth !== targetMonth) {
    return 0; // Not in target month
  }

  // Days in hire month
  const daysInMonth = new Date(hireYear, hireMonth + 1, 0).getDate();

  // Basic days worked (excluding hire day)
  let daysWorked = daysInMonth - hireDay;

  console.log(`  Hire Day: ${hireDay}, Days in Month: ${daysInMonth}`);
  console.log(`  Basic Days Worked (excluding hire day): ${daysWorked}`);

  // =========================================
  // TIME ADJUSTMENT (if hired_at is available)
  // =========================================
  if (employee.hired_at) {
    try {
      const hiredAt = new Date(employee.hired_at);
      console.log(`  Hired at timestamp: ${hiredAt.toISOString()}`);

      // Extract hour (0-23) from timestamp
      const hireHour = hiredAt.getUTCHours();

      // Philippine time adjustment (UTC+8)
      let phHour = hireHour + 8;
      if (phHour >= 24) phHour -= 24;

      console.log(`  Hour (UTC): ${hireHour}, Hour (PH): ${phHour}`);

      // Calculate fraction of hire day worked
      // Formula: (24 - hireHour) / 24
      const fractionOfDay = (24 - phHour) / 24;

      console.log(`  Fraction of hire day worked: ${fractionOfDay.toFixed(3)}`);

      // Add fraction to days worked (hire day is partially counted)
      daysWorked += fractionOfDay;

      console.log(
        `  Total Days Worked (with time adjustment): ${daysWorked.toFixed(3)}`
      );
    } catch (error) {
      console.error(
        `  Error processing hired_at for employee ${employee.id}:`,
        error
      );
      // Fallback: don't count hire day at all
    }
  } else {
    console.log(`  No hired_at timestamp - hire day not counted`);
    // Without timestamp, hire day is NOT counted (document says: "is not counted")
  }

  // Apply BFP formula
  const proRatedLeave = (daysWorked / daysInMonth) * 1.25;
  const result = parseFloat(proRatedLeave.toFixed(3));

  console.log(
    `  Pro-rated Leave: (${daysWorked.toFixed(
      3
    )}/${daysInMonth}) × 1.25 = ${result}`
  );

  return result;
}

// ======================
// MAIN ACCRUAL FUNCTION
// ======================

async function addMonthlyAccruals() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-11
  const currentDay = currentDate.getDate();

  // Only run on 1st day of month
  if (currentDay !== 1) {
    console.log(`Not running: Today is ${currentDay}, only runs on 1st`);
    return;
  }

  console.log(
    `🚀 Running BFP Monthly Accrual for ${currentMonth + 1}/${currentYear}`
  );

  try {
    // Get all active personnel WITH hired_at timestamp
    const { data: allPersonnel, error } = await supabase
      .from("personnel")
      .select("id, date_hired, hired_at, status, badge_number")
      .eq("status", "Active")
      .eq("is_active", true);

    if (error) throw error;

    console.log(`Processing ${allPersonnel?.length || 0} active employees`);

    for (const employee of allPersonnel || []) {
      await processEmployeeAccrual(employee, currentMonth, currentYear);
    }

    console.log("✅ Monthly accrual completed successfully");
  } catch (error) {
    console.error("❌ Error in monthly accrual:", error);
  }
}

// ======================
// PROCESS EACH EMPLOYEE
// ======================

async function processEmployeeAccrual(employee, currentMonth, currentYear) {
  console.log(`\n📋 Processing ${employee.badge_number || employee.id}`);

  const hireDate = new Date(employee.date_hired);
  const hireYear = hireDate.getFullYear();
  const hireMonth = hireDate.getMonth();

  console.log(`  Hire Date: ${employee.date_hired}`);
  console.log(`  Hired At: ${employee.hired_at || "Not specified"}`);

  // Determine accrual amount
  let accrualAmount = 0;

  // SCENARIO 1: Hired in current month (first month)
  if (hireYear === currentYear && hireMonth === currentMonth) {
    // This is the hire month - calculate pro-rated
    console.log(`  ↳ Hired this month - calculating pro-rated leave`);
    accrualAmount = calculateBFPProRatedLeave(employee, hireMonth, hireYear);
  }
  // SCENARIO 2: Regular monthly accrual
  else {
    // Standard monthly accrual
    accrualAmount = 1.25;
    console.log(`  ↳ Regular monthly accrual: ${accrualAmount} days`);
  }

  if (accrualAmount > 0) {
    await addAccrualToBalance(employee.id, accrualAmount, currentYear);
  }
}

// ======================
// ADD ACCRUAL TO BALANCE
// ======================

async function addAccrualToBalance(personnelId, accrualAmount, year) {
  try {
    // Get or create balance for year
    let { data: balance, error } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("personnel_id", personnelId)
      .eq("year", year)
      .single();

    // If no balance exists, create one
    if (error && error.code === "PGRST116") {
      console.log(`  Creating initial balance for year ${year}`);
      balance = await createInitialBalance(personnelId, year);
    } else if (error) {
      throw error;
    }

    // Update balances (cumulative)
    const updatedBalance = {
      vacation_balance: (
        parseFloat(balance.vacation_balance) + accrualAmount
      ).toFixed(3),
      sick_balance: (parseFloat(balance.sick_balance) + accrualAmount).toFixed(
        3
      ),
      emergency_balance: (
        parseFloat(balance.emergency_balance) + accrualAmount
      ).toFixed(3),
      vacation_used: balance.vacation_used || "0.00",
      sick_used: balance.sick_used || "0.00",
      emergency_used: balance.emergency_used || "0.00",
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("leave_balances")
      .update(updatedBalance)
      .eq("id", balance.id);

    if (updateError) throw updateError;

    console.log(`  ✅ Added ${accrualAmount} days to employee ${personnelId}`);
    console.log(`     Vacation: ${updatedBalance.vacation_balance}`);
    console.log(`     Sick: ${updatedBalance.sick_balance}`);
    console.log(`     Emergency: ${updatedBalance.emergency_balance}`);
  } catch (error) {
    console.error(
      `  ❌ Error updating balance for ${personnelId}:`,
      error.message
    );
  }
}

// ======================
// CREATE INITIAL BALANCE
// ======================

async function createInitialBalance(personnelId, year) {
  const newBalance = {
    personnel_id: personnelId,
    year: year,
    vacation_balance: "0.00",
    sick_balance: "0.00",
    emergency_balance: "0.00",
    initial_vacation_credits: "0.00",
    initial_sick_credits: "0.00",
    initial_emergency_credits: "0.00",
    vacation_used: "0.00",
    sick_used: "0.00",
    emergency_used: "0.00",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("leave_balances")
    .insert([newBalance])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ======================
// TEST FUNCTION
// ======================

async function testBFPFormula() {
  console.log("\n🧪 TESTING BFP FORMULA\n");

  // Test Case 1: Hired Nov 16, 2025, no time specified
  const test1 = {
    id: "test-1",
    date_hired: "2025-11-16",
    hired_at: null,
    badge_number: "TEST001",
  };

  console.log("Test 1: Hired Nov 16, 2025 (no time)");
  const result1 = calculateBFPProRatedLeave(test1, 10, 2025); // Nov = month 10
  console.log(`Result: ${result1} (Expected: 0.583)\n`);

  // Test Case 2: Hired Nov 16, 2025 at 10:00 AM
  const test2 = {
    id: "test-2",
    date_hired: "2025-11-16",
    hired_at: "2025-11-16T02:00:00Z", // 10:00 AM PH time (UTC+8)
    badge_number: "TEST002",
  };

  console.log("Test 2: Hired Nov 16, 2025 at 10:00 AM");
  const result2 = calculateBFPProRatedLeave(test2, 10, 2025);
  console.log(`Result: ${result2} (Expected: 0.607)\n`);

  // Test Case 3: Hired Dec 16, 2020 (your example)
  const test3 = {
    id: "test-3",
    date_hired: "2020-12-16",
    hired_at: "2020-12-16T04:00:00Z", // 12:00 PM PH time (UTC+8)
    badge_number: "TEST003",
  };

  console.log("Test 3: Hired Dec 16, 2020 at 12:00 PM");
  const result3 = calculateBFPProRatedLeave(test3, 11, 2020); // Dec = month 11
  console.log(`Result: ${result3} (Expected: 0.625)\n`);
}

// ======================
// EXPORTS
// ======================

module.exports = {
  addMonthlyAccruals,
  calculateBFPProRatedLeave,
  testBFPFormula,
};

// Manual test execution
if (require.main === module) {
  console.log("=== BFP LEAVE ACCRUAL SYSTEM ===");

  // Run test cases
  testBFPFormula().then(() => {
    console.log("✅ Formula tests completed");

    // Run actual accrual
    addMonthlyAccruals()
      .then(() => {
        console.log("✅ Accrual process completed");
        process.exit(0);
      })
      .catch((error) => {
        console.error("❌ Accrual process failed:", error);
        process.exit(1);
      });
  });
}
