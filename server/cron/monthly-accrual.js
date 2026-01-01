// server/cron/monthly-accrual.js - UPDATED VERSION
const { supabase } = require("../lib/supabaseClient");

// Your exact pro-rated formula
function calculateProRatedLeave(dateHiredStr, targetDate = new Date()) {
  if (!dateHiredStr) return 0;

  const hireDate = new Date(dateHiredStr);
  const target = new Date(targetDate);

  if (hireDate > target) return 0;

  // If hired in same month as target
  if (
    hireDate.getFullYear() === target.getFullYear() &&
    hireDate.getMonth() === target.getMonth()
  ) {
    const hireDay = hireDate.getDate();
    const daysInMonth = new Date(
      hireDate.getFullYear(),
      hireDate.getMonth() + 1,
      0
    ).getDate();

    // Your formula: Days Worked = Days in Month - (Hire Day - 1)
    const daysWorked = daysInMonth - (hireDay - 1);

    // Pro-rated leave: (Days Worked / Days in Month) × 1.25
    const proRatedLeave = (daysWorked / daysInMonth) * 1.25;
    return parseFloat(proRatedLeave.toFixed(3));
  }

  const yearsDiff = target.getFullYear() - hireDate.getFullYear();
  const monthsDiff = target.getMonth() - hireDate.getMonth();
  const totalMonths = Math.max(0, yearsDiff * 12 + monthsDiff);
  const effectiveMonths = Math.min(totalMonths, 12);

  return parseFloat((effectiveMonths * 1.25).toFixed(3));
}

// Main function to run monthly accruals
async function addMonthlyAccruals() {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-11
  const currentYear = currentDate.getFullYear();

  // Only run on 1st day of month
  if (currentDate.getDate() !== 1) {
    console.log(
      `Not running: Today is ${currentDate.getDate()}, only runs on 1st`
    );
    return;
  }

  console.log(
    `🚀 Running monthly accrual for ${currentMonth + 1}/${currentYear}`
  );

  try {
    // Get all active personnel
    const { data: allPersonnel, error } = await supabase
      .from("personnel")
      .select("id, date_hired, status")
      .eq("status", "Active")
      .eq("is_active", true);

    if (error) throw error;

    console.log(`Processing ${allPersonnel?.length || 0} active employees`);

    for (const employee of allPersonnel || []) {
      await processEmployeeAccrual(employee, currentDate);
    }

    console.log("✅ Monthly accrual completed successfully");
  } catch (error) {
    console.error("❌ Error in monthly accrual:", error);
  }
}

// Process each employee's accrual
async function processEmployeeAccrual(employee, currentDate) {
  const hireDate = new Date(employee.date_hired); // CHANGED: date_hired instead of hire_date
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const hireYear = hireDate.getFullYear();
  const hireMonth = hireDate.getMonth();

  // Calculate months worked (excluding current month)
  let monthsWorked = (currentYear - hireYear) * 12 + (currentMonth - hireMonth);

  // If current day is before hire day in current month, subtract one
  if (currentDate.getDate() < hireDate.getDate()) {
    monthsWorked--;
  }

  // Skip if hired this month (will get pro-rated next month)
  if (monthsWorked < 0) {
    console.log(`Skipping ${employee.id}: Hired in future?`);
    return;
  }

  // Employee hired this month (monthsWorked = 0)
  if (monthsWorked === 0) {
    console.log(
      `Employee ${employee.id} hired this month, skipping regular accrual`
    );
    return;
  }

  // For employees who completed at least one month
  let accrualAmount = 1.25;

  // SPECIAL CASE: If hired last month, calculate pro-rated for first month
  if (monthsWorked === 1) {
    // Calculate pro-rated for the hire month
    const lastMonth = new Date(currentYear, currentMonth - 1, 1);
    const daysInHireMonth = new Date(
      hireDate.getFullYear(),
      hireDate.getMonth() + 1,
      0
    ).getDate();

    const hireDay = hireDate.getDate();
    const daysWorked = daysInHireMonth - (hireDay - 1);
    accrualAmount = (daysWorked / daysInHireMonth) * 1.25;
    accrualAmount = parseFloat(accrualAmount.toFixed(3));

    console.log(
      `Employee ${employee.id}: First month pro-rated = ${accrualAmount} days`
    );
  }

  await addAccrualToCurrentYear(
    employee.id,
    accrualAmount,
    employee.date_hired
  );
}

// Add accrual to current year's balance
async function addAccrualToCurrentYear(personnelId, accrualAmount, dateHired) {
  const currentYear = new Date().getFullYear();

  try {
    // Get current year's balance
    const { data: currentBalance, error } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("personnel_id", personnelId)
      .eq("year", currentYear)
      .single();

    // If no record exists, create initial balance
    if (error && error.code === "PGRST116") {
      console.log(`Creating initial balance for employee ${personnelId}`);
      await createInitialBalanceForYear(personnelId, currentYear, dateHired);
      return addAccrualToCurrentYear(personnelId, accrualAmount, dateHired); // Retry
    }

    if (error) throw error;

    // Annual maximums (NEW allocations per year, but carry-forward is unlimited)
    const annualVacationMax = 15;
    const annualSickMax = 15;
    const annualEmergencyMax = 5;

    // Calculate current NEW allocation for this year (excluding carry-forward)
    const currentNewVacation =
      parseFloat(currentBalance.initial_vacation_credits) || 0;
    const currentNewSick = parseFloat(currentBalance.initial_sick_credits) || 0;
    const currentNewEmergency =
      parseFloat(currentBalance.initial_emergency_credits) || 0;

    // Calculate new allocations after adding accrual
    let newVacationAllocation = Math.min(
      currentNewVacation + accrualAmount,
      annualVacationMax
    );
    let newSickAllocation = Math.min(
      currentNewSick + accrualAmount,
      annualSickMax
    );
    let newEmergencyAllocation = Math.min(
      currentNewEmergency + accrualAmount,
      annualEmergencyMax
    );

    // Total balance = Previous year's balance + new allocation
    const previousYearBalance = await getPreviousYearBalance(
      personnelId,
      currentYear
    );

    const updatedBalance = {
      vacation_balance: (
        previousYearBalance.vacation + newVacationAllocation
      ).toFixed(3),
      sick_balance: (previousYearBalance.sick + newSickAllocation).toFixed(3),
      emergency_balance: (
        previousYearBalance.emergency + newEmergencyAllocation
      ).toFixed(3),
      initial_vacation_credits: newVacationAllocation.toFixed(3),
      initial_sick_credits: newSickAllocation.toFixed(3),
      initial_emergency_credits: newEmergencyAllocation.toFixed(3),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("leave_balances")
      .update(updatedBalance)
      .eq("id", currentBalance.id);

    if (updateError) throw updateError;

    console.log(`Added ${accrualAmount} days to employee ${personnelId}:`, {
      vacation: updatedBalance.vacation_balance,
      sick: updatedBalance.sick_balance,
      emergency: updatedBalance.emergency_balance,
    });
  } catch (error) {
    console.error(`Error processing employee ${personnelId}:`, error);
  }
}

// Get previous year's ending balance for carry-forward
async function getPreviousYearBalance(personnelId, currentYear) {
  const previousYear = currentYear - 1;

  try {
    const { data: prevBalance } = await supabase
      .from("leave_balances")
      .select("vacation_balance, sick_balance, emergency_balance")
      .eq("personnel_id", personnelId)
      .eq("year", previousYear)
      .single();

    if (prevBalance) {
      return {
        vacation: parseFloat(prevBalance.vacation_balance) || 0,
        sick: parseFloat(prevBalance.sick_balance) || 0,
        emergency: parseFloat(prevBalance.emergency_balance) || 0,
      };
    }
  } catch (err) {
    // No previous year balance
  }

  return { vacation: 0, sick: 0, emergency: 0 };
}

// Create initial balance for a year
async function createInitialBalanceForYear(personnelId, year, dateHired) {
  // Get employee hire date
  const { data: employee, error } = await supabase
    .from("personnel")
    .select("date_hired") // CHANGED: date_hired instead of hire_date
    .eq("id", personnelId)
    .single();

  if (error) throw error;

  const hireDate = new Date(employee.date_hired); // CHANGED: date_hired
  const hireYear = hireDate.getFullYear();

  let initialVacation = 0;
  let initialSick = 0;
  let initialEmergency = 0;

  if (hireYear < year) {
    // Hired before this year → eligible for full annual allocation
    initialVacation = 0; // Will be added monthly
    initialSick = 0;
    initialEmergency = 0;
  } else if (hireYear === year) {
    // Hired in this year → calculate pro-rated
    const proRated = calculateProRatedLeave(employee.date_hired); // CHANGED: date_hired
    initialVacation = Math.min(proRated, 15);
    initialSick = Math.min(proRated, 15);
    initialEmergency = Math.min(proRated, 5);
  }

  // Get previous year's balance for carry-forward
  const previousBalance = await getPreviousYearBalance(personnelId, year);

  const newBalance = {
    personnel_id: personnelId,
    year: year,
    vacation_balance: (previousBalance.vacation + initialVacation).toFixed(3),
    sick_balance: (previousBalance.sick + initialSick).toFixed(3),
    emergency_balance: (previousBalance.emergency + initialEmergency).toFixed(
      3
    ),
    initial_vacation_credits: initialVacation.toFixed(3),
    initial_sick_credits: initialSick.toFixed(3),
    initial_emergency_credits: initialEmergency.toFixed(3),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: createdBalance, error: createError } = await supabase
    .from("leave_balances")
    .insert([newBalance])
    .select()
    .single();

  if (createError) throw createError;

  return createdBalance;
}

// Export for testing or manual execution
module.exports = { addMonthlyAccruals, calculateProRatedLeave };
{/*
// If this file is run directly
if (require.main === module) {
  addMonthlyAccruals()
    .then(() => {
      console.log("✅ Cron job execution completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Fatal error in cron job:", error);
      process.exit(1);
    });
}
*/}