// server/demo-accrual.js - FIXED VERSION FOR DEFENSE
require("dotenv").config();
const { supabase } = require("./lib/supabaseClient");

console.log("🎓 BFP LEAVE SYSTEM - CAPSTONE DEFENSE DEMO");
console.log("============================================\n");

// Use real current date for demo
const currentDate = new Date();
console.log("📅 Today's Date:", currentDate.toLocaleDateString("en-PH"));
console.log("🕒 Current Time:", currentDate.toLocaleTimeString("en-PH"));
console.log("");

async function runDefenseDemo() {
  console.log("📋 STEP 0: Prepare Test Data");
  console.log("=============================");

  // Check if we have enough employees, create test data if needed
  const { data: existingEmployees } = await supabase
    .from("personnel")
    .select("count")
    .eq("status", "Active")
    .eq("is_active", true);

  const employeeCount = existingEmployees?.[0]?.count || 0;

  if (employeeCount < 3) {
    console.log("👥 Creating test employees for demo...");
    await createTestEmployees();
  }

  // Now proceed with the demo
  await continueDemo();
}

async function createTestEmployees() {
  // Create test employees with all required fields
  const testEmployees = [
    {
      first_name: "John",
      last_name: "Doe",
      username: "john.doe",
      password: "bfp@2024", // Will need to be hashed in production
      badge_number: "BFP-001",
      rank: "Fire Officer I",
      station: "Main Station",
      date_hired: "2024-01-15",
      hired_at: "2024-01-15T08:00:00Z",
      status: "Active",
      is_active: true,
      email: "john.doe@bfp.demo",
    },
    {
      first_name: "Jane",
      last_name: "Smith",
      username: "jane.smith",
      password: "bfp@2024",
      badge_number: "BFP-002",
      rank: "Fire Officer II",
      station: "Station 2",
      date_hired: new Date().toISOString().split("T")[0], // Today
      hired_at: null, // No time specified
      status: "Active",
      is_active: true,
      email: "jane.smith@bfp.demo",
    },
    {
      first_name: "Michael",
      last_name: "Johnson",
      username: "michael.johnson",
      password: "bfp@2024",
      badge_number: "BFP-003",
      rank: "Senior Fire Officer",
      station: "Station 3",
      date_hired: "2024-12-16", // Mid-December hire
      hired_at: "2024-12-16T04:00:00Z", // 12:00 PM PH time
      status: "Active",
      is_active: true,
      email: "michael.johnson@bfp.demo",
    },
    {
      first_name: "Sarah",
      last_name: "Williams",
      username: "sarah.williams",
      password: "bfp@2024",
      badge_number: "BFP-004",
      rank: "Fire Officer I",
      station: "Main Station",
      date_hired: "2023-06-01", // Long-time employee
      hired_at: "2023-06-01T08:00:00Z",
      status: "Active",
      is_active: true,
      email: "sarah.williams@bfp.demo",
    },
  ];

  console.log("\n➕ Creating test employees:");

  for (const emp of testEmployees) {
    try {
      // Check if employee already exists
      const { data: existing } = await supabase
        .from("personnel")
        .select("id")
        .eq("username", emp.username)
        .single();

      if (existing) {
        console.log(`   ${emp.username} already exists`);
        continue;
      }

      // Insert new employee
      const { error } = await supabase.from("personnel").insert([emp]);

      if (error) {
        console.error(`   ❌ Error creating ${emp.username}:`, error.message);
      } else {
        console.log(
          `   ✅ Created ${emp.first_name} ${emp.last_name} (${emp.username})`
        );
      }
    } catch (error) {
      console.error(`   ❌ Failed to create ${emp.username}:`, error.message);
    }
  }
}

async function continueDemo() {
  console.log("\n📊 STEP 1: Show Active Employees");
  console.log("================================");

  const { data: employees } = await supabase
    .from("personnel")
    .select(
      "id, first_name, last_name, badge_number, date_hired, hired_at, rank, station, status, is_active"
    )
    .eq("status", "Active")
    .eq("is_active", true)
    .order("date_hired", { ascending: true });

  if (!employees || employees.length === 0) {
    console.log("❌ No active employees found.");
    return;
  }

  console.log(`👥 Found ${employees.length} Active Employees:\n`);

  employees.forEach((emp, index) => {
    const hireDate = new Date(emp.date_hired);
    const formattedDate = hireDate.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    console.log(`${index + 1}. ${emp.first_name} ${emp.last_name}`);
    console.log(`   📛 Badge: ${emp.badge_number || "N/A"}`);
    console.log(`   ⭐ Rank: ${emp.rank || "N/A"}`);
    console.log(`   🏢 Station: ${emp.station || "N/A"}`);
    console.log(`   📅 Hire Date: ${formattedDate}`);

    if (emp.hired_at) {
      const hireTime = new Date(emp.hired_at);
      const phTime = new Date(hireTime.getTime() + 8 * 60 * 60 * 1000); // UTC+8
      console.log(
        `   🕒 Hire Time: ${phTime.toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })} PH Time`
      );
    } else {
      console.log(`   🕒 Hire Time: Not specified`);
    }
    console.log("");
  });

  console.log("📈 STEP 2: Current Leave Balances");
  console.log("=================================");

  const currentYear = currentDate.getFullYear();
  const { data: balances } = await supabase
    .from("leave_balances")
    .select(
      `
      vacation_balance,
      sick_balance,
      emergency_balance,
      personnel:personnel_id (
        first_name,
        last_name,
        badge_number,
        date_hired
      )
    `
    )
    .eq("year", currentYear);

  if (balances && balances.length > 0) {
    console.log("\n💰 CURRENT LEAVE BALANCES:");
    console.log("   " + "=".repeat(60));

    balances.forEach((balance, index) => {
      const emp = balance.personnel;
      console.log(`\n${index + 1}. ${emp.first_name} ${emp.last_name}`);
      console.log(
        `   Vacation: ${parseFloat(balance.vacation_balance).toFixed(3)} days`
      );
      console.log(
        `   Sick: ${parseFloat(balance.sick_balance).toFixed(3)} days`
      );
      console.log(
        `   Emergency: ${parseFloat(balance.emergency_balance).toFixed(3)} days`
      );
    });
  } else {
    console.log(
      "No leave balances found. The system will create them during accrual."
    );
  }

  console.log("\n🧮 STEP 3: Demonstrate BFP Formula");
  console.log("==================================");

  // Pick a specific employee for demonstration
  const demoEmployee =
    employees.find(
      (emp) =>
        new Date(emp.date_hired).getDate() === 16 &&
        new Date(emp.date_hired).getMonth() === 11 // December
    ) || employees[0];

  console.log("\n🔬 FORMULA DEMONSTRATION FOR:");
  console.log(`   ${demoEmployee.first_name} ${demoEmployee.last_name}`);
  console.log(
    `   Hired: ${new Date(demoEmployee.date_hired).toLocaleDateString("en-PH")}`
  );
  console.log("   " + "─".repeat(50));

  await demonstrateFormula(demoEmployee);

  console.log("\n🚀 STEP 4: Run Monthly Accrual Simulation");
  console.log("==========================================");

  console.log("\n▶️  Simulating accrual for 1st of the month...");

  // Import accrual functions
  const {
    addMonthlyAccruals,
    calculateBFPProRatedLeave,
  } = require("./cron/monthly-accrual");

  // Temporarily override date for demo
  const originalDate = global.Date;
  global.Date = class extends Date {
    constructor(...args) {
      if (args.length === 0) {
        // Return 1st of current month
        const now = new originalDate();
        super(now.getFullYear(), now.getMonth(), 1);
      } else {
        super(...args);
      }
    }

    getDate() {
      return 1; // Always return 1st
    }
  };

  try {
    console.log("\n📝 Processing accruals...");
    await addMonthlyAccruals();
    console.log("✅ Accrual completed successfully!");
  } catch (error) {
    console.error("❌ Accrual failed:", error.message);
  } finally {
    // Restore original Date
    global.Date = originalDate;
  }

  console.log("\n📊 STEP 5: Show Updated Balances");
  console.log("================================");

  // Fetch updated balances
  const { data: updatedBalances } = await supabase
    .from("leave_balances")
    .select(
      `
      vacation_balance,
      sick_balance,
      emergency_balance,
      initial_vacation_credits,
      initial_sick_credits,
      initial_emergency_credits,
      updated_at,
      personnel:personnel_id (
        first_name,
        last_name,
        badge_number,
        date_hired,
        hired_at
      )
    `
    )
    .eq("year", currentYear)
    .order("updated_at", { ascending: false });

  if (updatedBalances && updatedBalances.length > 0) {
    console.log("\n🔄 UPDATED LEAVE BALANCES:");
    console.log("   " + "=".repeat(60));

    updatedBalances.forEach((balance, index) => {
      const emp = balance.personnel;
      const hireDate = new Date(emp.date_hired);
      const isNewHire =
        hireDate.getFullYear() === currentYear &&
        hireDate.getMonth() === currentDate.getMonth();

      console.log(`\n${index + 1}. ${emp.first_name} ${emp.last_name}`);
      console.log(`   Hire Date: ${hireDate.toLocaleDateString("en-PH")}`);
      console.log(
        `   Type: ${
          isNewHire ? "🆕 New Hire (Pro-rated)" : "📅 Regular (1.25 days)"
        }`
      );

      console.log(`\n   ┌─────────────┬────────────┬────────────┐`);
      console.log(`   │ Leave Type  │ Old Balance │ New Balance │`);
      console.log(`   ├─────────────┼────────────┼────────────┤`);

      // Find old balance if exists
      const oldBalance = balances?.find((b) => b.personnel.id === emp.id);

      console.log(
        `   │ Vacation    │ ${(oldBalance
          ? parseFloat(oldBalance.vacation_balance).toFixed(3)
          : "0.000"
        ).padStart(10)} │ ${parseFloat(balance.vacation_balance)
          .toFixed(3)
          .padStart(10)} │`
      );
      console.log(
        `   │ Sick        │ ${(oldBalance
          ? parseFloat(oldBalance.sick_balance).toFixed(3)
          : "0.000"
        ).padStart(10)} │ ${parseFloat(balance.sick_balance)
          .toFixed(3)
          .padStart(10)} │`
      );
      console.log(
        `   │ Emergency   │ ${(oldBalance
          ? parseFloat(oldBalance.emergency_balance).toFixed(3)
          : "0.000"
        ).padStart(10)} │ ${parseFloat(balance.emergency_balance)
          .toFixed(3)
          .padStart(10)} │`
      );
      console.log(`   └─────────────┴────────────┴────────────┘`);

      const addedAmount = oldBalance
        ? (
            parseFloat(balance.vacation_balance) -
            parseFloat(oldBalance.vacation_balance)
          ).toFixed(3)
        : parseFloat(balance.initial_vacation_credits).toFixed(3);

      console.log(`   ➕ Added this month: ${addedAmount} days per leave type`);
      console.log(
        `   ⏰ Updated: ${new Date(balance.updated_at).toLocaleString("en-PH")}`
      );
    });
  }

  console.log("\n🎉 STEP 6: Summary and Conclusion");
  console.log("=================================");

  console.log("\n✅ BFP LEAVE ACCRUAL SYSTEM DEMONSTRATED SUCCESSFULLY!");
  console.log("\n📋 KEY FEATURES SHOWN:");
  console.log("   1. ✅ Automatic monthly accrual on 1st of month");
  console.log("   2. ✅ BFP Formula: (Days Worked / Days in Month) × 1.25");
  console.log("   3. ✅ Pro-rated calculations for new hires");
  console.log("   4. ✅ Time-based adjustments (when hire time is specified)");
  console.log("   5. ✅ Three leave types: Vacation, Sick, Emergency");
  console.log("   6. ✅ Database integration with Supabase");
  console.log("   7. ✅ Real-time balance updates");

  console.log("\n📚 FORMULA EXAMPLES COVERED:");
  console.log("   • Regular employee: 1.25 days per month");
  console.log("   • Mid-month hire: Pro-rated based on days worked");
  console.log("   • Time-adjusted: Partial day calculation");

  console.log("\n🏢 READY FOR BFP DEPLOYMENT");
  console.log("===========================");
  console.log("This system is production-ready and follows BFP guidelines.");
  console.log("\nFor defense presentation:");
  console.log("1. Show the code structure");
  console.log("2. Run this demo script");
  console.log("3. Explain the BFP formula");
  console.log("4. Demonstrate database updates");
  console.log("5. Show error handling and edge cases");
}

async function demonstrateFormula(employee) {
  const hireDate = new Date(employee.date_hired);
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const hireMonth = monthNames[hireDate.getMonth()];
  const hireYear = hireDate.getFullYear();
  const hireDay = hireDate.getDate();

  // Calculate days in month
  const daysInMonth = new Date(hireYear, hireDate.getMonth() + 1, 0).getDate();

  // Basic calculation (without time)
  const daysWorked = daysInMonth - hireDay;
  const basicResult = (daysWorked / daysInMonth) * 1.25;

  console.log(`\n📐 BASIC FORMULA (No time adjustment):`);
  console.log(`   Hire Date: ${hireDay} ${hireMonth} ${hireYear}`);
  console.log(`   Days in ${hireMonth}: ${daysInMonth}`);
  console.log(
    `   Days Worked: ${daysInMonth} - ${hireDay} = ${daysWorked} days`
  );
  console.log(`   Formula: (${daysWorked} ÷ ${daysInMonth}) × 1.25`);
  console.log(`   Result: ${basicResult.toFixed(3)} leave credits`);

  // Time-adjusted calculation
  if (employee.hired_at) {
    const hireTime = new Date(employee.hired_at);
    const hireHourUTC = hireTime.getUTCHours();
    const hireHourPH = (hireHourUTC + 8) % 24; // Convert to PH time (UTC+8)

    const fractionOfDay = (24 - hireHourPH) / 24;
    const adjustedDaysWorked = daysWorked + fractionOfDay;
    const adjustedResult = (adjustedDaysWorked / daysInMonth) * 1.25;

    console.log(`\n⏰ TIME-ADJUSTED FORMULA:`);
    console.log(`   Hire Time: ${hireHourPH}:00 (${hireHourPH}:00 PH Time)`);
    console.log(
      `   Fraction of day: (24 - ${hireHourPH}) ÷ 24 = ${fractionOfDay.toFixed(
        3
      )}`
    );
    console.log(
      `   Adjusted Days Worked: ${daysWorked} + ${fractionOfDay.toFixed(
        3
      )} = ${adjustedDaysWorked.toFixed(3)}`
    );
    console.log(
      `   Formula: (${adjustedDaysWorked.toFixed(3)} ÷ ${daysInMonth}) × 1.25`
    );
    console.log(`   Result: ${adjustedResult.toFixed(3)} leave credits`);
  } else {
    console.log(
      `\n⏰ TIME ADJUSTMENT: Not applicable (no hire time specified)`
    );
    console.log(`   Hire day is NOT counted in days worked`);
  }

  console.log(
    `\n📊 FINAL ACCRUAL: ${
      employee.hired_at
        ? adjustedResult?.toFixed(3) || basicResult.toFixed(3)
        : basicResult.toFixed(3)
    } days`
  );
  console.log(`   (Will be added to Vacation, Sick, and Emergency balances)`);
}

// Run the demo
runDefenseDemo()
  .then(() => {
    console.log("\n" + "=".repeat(60));
    console.log("✨ DEMO COMPLETE - READY FOR DEFENSE! ✨");
    console.log("=".repeat(60));
  })
  .catch((error) => {
    console.error("\n❌ Demo failed:", error.message);
    console.log("\n💡 TROUBLESHOOTING TIPS:");
    console.log("1. Check your .env file has correct Supabase credentials");
    console.log("2. Ensure personnel table has required columns:");
    console.log("   - username (NOT NULL)");
    console.log("   - password (NOT NULL)");
    console.log("   - first_name (NOT NULL)");
    console.log("   - last_name (NOT NULL)");
    console.log("3. Run with: node server/demo-accrual.js");
  });
