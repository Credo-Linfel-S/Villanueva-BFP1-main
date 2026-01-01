// server/final-test.js
require("dotenv").config();
const { supabase } = require("./lib/supabaseClient");

// Import the FIXED function
const {
  calculateProRatedLeave,
  addMonthlyAccruals,
} = require("./cron/monthly-accrual");

console.log("🎯 FINAL TEST - CrystalMaiden Fix");
console.log("=================================\n");

async function runTest() {
  // 1. Check current balance
  const { data: currentBalance } = await supabase
    .from("leave_balances")
    .select("*")
    .eq("personnel_id", "f6b37406-303a-476e-a0e8-75fa6d1f7864")
    .single();

  console.log("📊 CURRENT BALANCE:");
  console.log(`Vacation: ${currentBalance?.vacation_balance || 0}`);
  console.log(`Sick: ${currentBalance?.sick_balance || 0}`);
  console.log(`Emergency: ${currentBalance?.emergency_balance || 0}`);

  // 2. Test the formula
  console.log("\n🧮 FORMULA TEST:");
  const hireDate = "2025-12-31";
  const proRated = calculateProRatedLeave(hireDate, new Date("2026-01-01"));
  console.log(`Hire Date: ${hireDate}`);
  console.log(`Correct pro-rated amount: ${proRated} days`);
  console.log(`Expected: (1/31) × 1.25 = 0.04 days`);

  // 3. Reset balance for test (optional)
  console.log("\n🔄 Resetting balance for test...");
  await supabase
    .from("leave_balances")
    .update({
      vacation_balance: 0,
      sick_balance: 0,
      emergency_balance: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("personnel_id", "f6b37406-303a-476e-a0e8-75fa6d1f7864");

  // 4. Run accrual
  console.log("\n🚀 Running monthly accrual...");
  const originalDate = global.Date;
  global.Date = class extends Date {
    getDate() {
      return 1;
    }
  };

  await addMonthlyAccruals();

  global.Date = originalDate;

  // 5. Check updated balance
  console.log("\n✅ CHECKING RESULT:");
  const { data: updatedBalance } = await supabase
    .from("leave_balances")
    .select("*")
    .eq("personnel_id", "f6b37406-303a-476e-a0e8-75fa6d1f7864")
    .single();

  console.log(
    `Vacation: ${updatedBalance?.vacation_balance} (should be ${proRated})`
  );
  console.log(`Sick: ${updatedBalance?.sick_balance} (should be ${proRated})`);
  console.log(
    `Emergency: ${updatedBalance?.emergency_balance} (should be ${proRated})`
  );

  const isCorrect =
    parseFloat(updatedBalance?.vacation_balance) === proRated &&
    parseFloat(updatedBalance?.sick_balance) === proRated &&
    parseFloat(updatedBalance?.emergency_balance) === proRated;

  console.log(
    isCorrect
      ? "\n🎉 SUCCESS! Formula works correctly!"
      : "\n❌ FAILED! Still getting wrong amount."
  );
}

runTest().catch(console.error);
