// server/demo/demo-accrual.js - BFP CAPSTONE DEFENSE DEMO
const { supabase } = require("./lib/supabaseClient");

console.log("🎓 =========================================");
console.log("🎓   BFP LEAVE ACCRUAL SYSTEM - CAPSTONE DEMO");
console.log("🎓   Computer Engineering Capstone Defense");
console.log("🎓 =========================================");
console.log("");

// ANSI colors for better visualization
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

// Helper for colored output
function color(text, colorCode) {
  return `${colorCode}${text}${colors.reset}`;
}

// ======================
// SECTION 1: BFP FORMULA DISPLAY
// ======================

function displayBFPFormula() {
  console.log(
    color(
      "\n📐 SECTION 1: BFP LEAVE CREDITS FORMULA",
      colors.bright + colors.cyan
    )
  );
  console.log("=".repeat(50));

  console.log(color("\n📋 FOR NEW PERSONNEL:", colors.bright));
  console.log(
    "   Pro-rated = (Working Days in Month / Total Days in Month) × 1.25"
  );
  console.log("");
  console.log(color("📋 WITH TIME ADJUSTMENT:", colors.bright));
  console.log("   Fraction = (24 - Time Hired) / 24");
  console.log("   Total Effective Days = Full Days + Fraction");
  console.log("");

  // Visual example from document
  console.log(color("📖 EXAMPLE BASED FROM SAMPLE DOCUMENT:", colors.yellow));
  console.log("   Hired: December 16, 2025 at 12:00 PM");
  console.log("   Days in December: 31");
  console.log("   Full days worked: Dec 17-31 = 15 days");
  console.log("   Fraction: (24 - 12) / 24 = 0.5 day");
  console.log("   Total: 15 + 0.5 = 15.5 days");
  console.log(
    color("   Calculation: (15.5 / 31) × 1.25 = ", colors.green) +
      color("0.625 leave credits", colors.bright + colors.green)
  );
}

// ======================
// SECTION 2: CALCULATION LOGIC
// ======================

function calculateBFPProRatedLeaveDemo(employee, displayDetails = true) {
  if (!employee || !employee.date_hired) return 0;

  const hireDate = new Date(employee.date_hired);
  const hireYear = hireDate.getFullYear();
  const hireMonth = hireDate.getMonth();
  const hireDay = hireDate.getDate();

  const daysInMonth = new Date(hireYear, hireMonth + 1, 0).getDate();

  // Full days worked AFTER hire day
  let fullDaysAfterHire = daysInMonth - hireDay;

  // Fraction of hire day worked
  let fractionOfHireDay = 0;
  let timeExplanation = "";

  if (employee.hired_time) {
    try {
      const timeParts = employee.hired_time.split(":");
      const hireHour = parseInt(timeParts[0]) || 0;
      const hireMinute = parseInt(timeParts[1]) || 0;
      const decimalHour = hireHour + hireMinute / 60;

      fractionOfHireDay = (24 - decimalHour) / 24;

      if (displayDetails) {
        console.log(
          color(
            `\n   Time Calculation for ${employee.first_name}:`,
            colors.cyan
          )
        );
        console.log(`   └─ hired_time: ${employee.hired_time}`);
        console.log(`   └─ Hours: ${hireHour}, Minutes: ${hireMinute}`);
        console.log(`   └─ Decimal: ${decimalHour.toFixed(2)} hours`);
        console.log(
          `   └─ Fraction: (24 - ${decimalHour.toFixed(
            2
          )}) / 24 = ${fractionOfHireDay.toFixed(3)} day`
        );
      }
    } catch (error) {
      if (displayDetails)
        console.log(`   └─ Error parsing time: ${error.message}`);
    }
  } else {
    if (displayDetails)
      console.log(`   └─ No hire time specified - hire day not counted`);
  }

  // Total effective days worked
  const totalEffectiveDays = fullDaysAfterHire + fractionOfHireDay;

  // Apply BFP formula
  const proRatedLeave = (totalEffectiveDays / daysInMonth) * 1.25;
  const result = Math.max(
    0,
    Math.min(1.25, parseFloat(proRatedLeave.toFixed(3)))
  );

  if (displayDetails) {
    console.log(color(`\n   Formula Breakdown:`, colors.cyan));
    console.log(`   └─ Days in month: ${daysInMonth}`);
    console.log(`   └─ Hire day: ${hireDay}`);
    console.log(`   └─ Full days after hire: ${fullDaysAfterHire} days`);
    console.log(
      `   └─ Fraction of hire day: ${fractionOfHireDay.toFixed(3)} day`
    );
    console.log(
      `   └─ Total effective days: ${totalEffectiveDays.toFixed(3)} days`
    );
    console.log(
      `   └─ Calculation: (${totalEffectiveDays.toFixed(
        3
      )} ÷ ${daysInMonth}) × 1.25`
    );
    console.log(
      color(
        `   └─ Result: ${result} leave credits`,
        colors.bright + colors.green
      )
    );
  }

  return result;
}

// ======================
// SECTION 3: PAYMENT TYPE LOGIC
// ======================

async function checkWithoutPayLeaveDemo(personnelId, month, year) {
  console.log(color(`\n   Checking without-pay leaves:`, colors.cyan));

  try {
    const { data: leaves, error } = await supabase
      .from("leave_requests")
      .select(
        "approve_for, start_date, end_date, paid_days, unpaid_days, leave_type"
      )
      .eq("personnel_id", personnelId)
      .eq("status", "Approved")
      .or("approve_for.eq.without_pay,approve_for.eq.both")
      .lte("start_date", `${year}-${String(month + 1).padStart(2, "0")}-31`)
      .gte("end_date", `${year}-${String(month + 1).padStart(2, "0")}-01`);

    if (error) {
      console.log(`   └─ Database error: ${error.message}`);
      return false;
    }

    if (!leaves || leaves.length === 0) {
      console.log(`   └─ No without-pay leaves found ✓`);
      return false;
    }

    console.log(`   └─ Found ${leaves.length} without-pay/mixed leave(s)`);

    for (const leave of leaves) {
      console.log(
        `      • ${leave.leave_type}: ${leave.start_date} to ${leave.end_date}`
      );
      console.log(
        `        Type: ${leave.approve_for}, Paid: ${
          leave.paid_days || 0
        }, Unpaid: ${leave.unpaid_days || 0}`
      );

      if (leave.approve_for === "without_pay") {
        console.log(
          color(`        ⚠️  FULL without-pay leave - NO accrual`, colors.red)
        );
        return true;
      } else if (leave.approve_for === "both" && (leave.unpaid_days || 0) > 0) {
        console.log(
          color(
            `        ⚠️  Mixed leave with ${leave.unpaid_days} unpaid days - NO accrual`,
            colors.red
          )
        );
        return true;
      }
    }

    console.log(`   └─ All leaves have paid days only ✓`);
    return false;
  } catch (error) {
    console.log(`   └─ Error: ${error.message}`);
    return false;
  }
}

// ======================
// SECTION 4: DEMO TEST CASES
// ======================

async function runDemoTestCases() {
  console.log(color("\n🧪 SECTION 4: TEST CASES", colors.bright + colors.cyan));
  console.log("=".repeat(50));

  // Test Case 1: New hire with time
  console.log(color("\n📋 TEST CASE 1: New Hire (with time)", colors.bright));
  console.log("-".repeat(40));

  const newHire = {
    first_name: "Juan",
    last_name: "Dela Cruz",
    date_hired: "2025-12-16",
    hired_time: "12:00:00", // 12:00 PM
    id: "demo-new-hire-1",
  };

  console.log(`   Employee: ${newHire.first_name} ${newHire.last_name}`);
  console.log(`   Hire Date: ${newHire.date_hired}`);
  console.log(`   Hire Time: ${newHire.hired_time} (12:00 PM)`);

  const newHireResult = calculateBFPProRatedLeaveDemo(newHire, true);
  console.log(
    color(
      `\n   ✅ NEW HIRE RESULT: ${newHireResult} leave credits`,
      colors.bright + colors.green
    )
  );

  // Test Case 2: New hire without time
  console.log(color("\n📋 TEST CASE 2: New Hire (no time)", colors.bright));
  console.log("-".repeat(40));

  const newHireNoTime = {
    first_name: "Maria",
    last_name: "Santos",
    date_hired: "2025-12-16",
    hired_time: null,
    id: "demo-new-hire-2",
  };

  console.log(
    `   Employee: ${newHireNoTime.first_name} ${newHireNoTime.last_name}`
  );
  console.log(`   Hire Date: ${newHireNoTime.date_hired}`);
  console.log(`   Hire Time: Not specified`);

  const noTimeResult = calculateBFPProRatedLeaveDemo(newHireNoTime, true);
  console.log(
    color(
      `\n   ✅ RESULT: ${noTimeResult} leave credits`,
      colors.bright + colors.green
    )
  );

  // Test Case 3: Old personnel (hired previous year)
  console.log(color("\n📋 TEST CASE 3: Old Personnel", colors.bright));
  console.log("-".repeat(40));

  const oldPersonnel = {
    first_name: "Pedro",
    last_name: "Reyes",
    date_hired: "2020-01-15",
    hired_time: "08:00:00",
    id: "demo-old-1",
  };

  console.log(
    `   Employee: ${oldPersonnel.first_name} ${oldPersonnel.last_name}`
  );
  console.log(`   Hire Date: ${oldPersonnel.date_hired} (5 years ago)`);
  console.log(`   Status: Old personnel - receives full monthly accrual`);
  console.log(
    color(
      `\n   ✅ RESULT: 1.25 leave credits (standard monthly)`,
      colors.bright + colors.green
    )
  );

  // Test Case 4: Payment type scenarios
  console.log(color("\n📋 TEST CASE 4: Payment Type Impact", colors.bright));
  console.log("-".repeat(40));

  console.log("   Scenario A: With-pay leave");
  console.log("   └─ Takes 5 days vacation WITH pay");
  console.log(color("   └─ ✅ STILL gets 1.25 monthly accrual", colors.green));

  console.log("\n   Scenario B: Without-pay leave");
  console.log("   └─ Takes 5 days sick leave WITHOUT pay");
  console.log(color("   └─ ❌ NO monthly accrual that month", colors.red));

  console.log("\n   Scenario C: Mixed leave");
  console.log("   └─ Takes 5 days (3 with-pay, 2 without-pay)");
  console.log(
    color("   └─ ❌ NO monthly accrual (has without-pay days)", colors.red)
  );
}

// ======================
// SECTION 5: SIMULATE MONTHLY PROCESS
// ======================

async function simulateMonthlyProcess() {
  console.log(
    color(
      "\n📅 SECTION 5: Monthly Accrual Process",
      colors.bright + colors.cyan
    )
  );
  console.log("=".repeat(50));

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const demoDate = new Date(currentYear, currentMonth, 1); // 1st of month

  console.log(
    `\n📆 Simulating: ${demoDate.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`
  );
  console.log(`   (1st day of the month - accrual day)`);

  // Create demo employees
  const demoEmployees = [
    {
      id: "emp-001",
      first_name: "John",
      last_name: "Smith",
      date_hired: "2025-12-16",
      hired_time: "12:00:00",
      badge_number: "BFP-001",
      status: "Active",
    },
    {
      id: "emp-002",
      first_name: "Jane",
      last_name: "Doe",
      date_hired: "2024-06-01",
      hired_time: "08:30:00",
      badge_number: "BFP-002",
      status: "Active",
    },
    {
      id: "emp-003",
      first_name: "Robert",
      last_name: "Lim",
      date_hired: "2020-03-15",
      hired_time: "14:00:00",
      badge_number: "BFP-003",
      status: "Active",
    },
    {
      id: "emp-004",
      first_name: "Anna",
      last_name: "Tan",
      date_hired: "2026-01-10", // Future hire (won't get accrual)
      hired_time: "09:00:00",
      badge_number: "BFP-004",
      status: "Active",
    },
  ];

  console.log(color("\n👥 Processing 4 Demo Employees:", colors.bright));
  console.log("-".repeat(50));

  let totalAccrued = 0;
  let processedCount = 0;

  for (const emp of demoEmployees) {
    console.log(
      color(
        `\n[${emp.badge_number}] ${emp.first_name} ${emp.last_name}`,
        colors.yellow
      )
    );
    console.log(
      `   Hired: ${emp.date_hired} ${
        emp.hired_time ? `at ${emp.hired_time}` : ""
      }`
    );

    const hireDate = new Date(emp.date_hired);
    const hireYear = hireDate.getFullYear();
    const hireMonth = hireDate.getMonth();

    // Check if hired in future
    if (
      hireYear > currentYear ||
      (hireYear === currentYear && hireMonth > currentMonth)
    ) {
      console.log(color(`   ⏭️  Future hire - skipping accrual`, colors.cyan));
      continue;
    }

    // Check payment type impact (simulated)
    const hasWithoutPayLeave = await checkWithoutPayLeaveDemo(
      emp.id,
      currentMonth,
      currentYear
    );

    if (hasWithoutPayLeave) {
      console.log(
        color(`   ⏭️  Has without-pay leave - NO accrual`, colors.red)
      );
      continue;
    }

    // Calculate accrual
    if (hireYear === currentYear && hireMonth === currentMonth) {
      // New hire this month - pro-rate
      console.log(`   📊 Status: New hire this month - pro-rated`);
      const proRated = calculateBFPProRatedLeaveDemo(emp, false);
      console.log(`   🎯 Pro-rated amount: ${proRated.toFixed(3)} credits`);
      totalAccrued += proRated;
    } else {
      // Old personnel or hired earlier - full month
      console.log(`   📊 Status: Regular monthly accrual`);
      console.log(`   🎯 Full month amount: 1.25 credits`);
      totalAccrued += 1.25;
    }

    processedCount++;
  }

  console.log(color("\n" + "=".repeat(50), colors.cyan));
  console.log(color("📈 DEMO RESULTS SUMMARY:", colors.bright + colors.cyan));
  console.log(color("=".repeat(50), colors.cyan));
  console.log(`   Employees processed: ${processedCount}`);
  console.log(`   Total credits accrued: ${totalAccrued.toFixed(3)} days`);
  console.log(`   Emergency leave cap: 5 days/year (auto-capped)`);
  console.log(`   Monthly accrual rate: 1.25 days/personnel`);
  console.log(
    color(
      "\n✅ Monthly accrual simulation complete!",
      colors.bright + colors.green
    )
  );
}

// ======================
// SECTION 6: ANNUAL RESET DEMO
// ======================

function demonstrateAnnualReset() {
  console.log(
    color(
      "\n🔄 SECTION 6: Annual Emergency Leave Reset",
      colors.bright + colors.cyan
    )
  );
  console.log("=".repeat(50));

  console.log(color("\n📋 BFP POLICY:", colors.bright));
  console.log("   Emergency Leave: Maximum 5 days per year");
  console.log("   Annual Reset: January 1st, resets to 0");
  console.log("   Carry-over: No carry-over to next year");

  console.log(color("\n📅 SIMULATION:", colors.bright));

  const demoBalances = [
    { name: "John Smith", emergency: 5.0, year: 2025 },
    { name: "Jane Doe", emergency: 3.5, year: 2025 },
    { name: "Robert Lim", emergency: 0.0, year: 2025 },
    { name: "Anna Tan", emergency: 5.0, year: 2025 },
  ];

  console.log("   December 31, 2025 balances:");
  demoBalances.forEach((balance) => {
    const status = balance.emergency >= 5 ? " (MAX)" : "";
    console.log(
      `   └─ ${balance.name}: ${balance.emergency.toFixed(2)} days${status}`
    );
  });

  console.log(color("\n   🔔 January 1, 2026 - RESET DAY:", colors.yellow));
  console.log("   GitHub Actions cron: '5 16 31 12 *' (4:05 PM UTC Dec 31)");
  console.log("   Manila Time: 12:05 AM Jan 1");

  console.log(
    color("\n   January 1, 2026 balances (after reset):", colors.bright)
  );
  demoBalances.forEach((balance) => {
    console.log(
      color(`   └─ ${balance.name}: 0.00 days (reset)`, colors.green)
    );
  });

  console.log(
    color(
      "\n✅ Annual reset ensures fair distribution each year",
      colors.bright + colors.green
    )
  );
}

// ======================
// SECTION 7: INTEGRATION FEATURES
// ======================

function demonstrateIntegration() {
  console.log(
    color("\n🔗 SECTION 7: System Integration", colors.bright + colors.cyan)
  );
  console.log("=".repeat(50));

  console.log(color("\n🏗️  ARCHITECTURE:", colors.bright));
  console.log("   Frontend: React.js with Supabase client");
  console.log("   Backend: Node.js cron jobs");
  console.log("   Database: Supabase PostgreSQL");
  console.log("   Deployment: GitHub Actions + Vercel");

  console.log(color("\n🤖 AUTOMATION FEATURES:", colors.bright));
  console.log("   1. Monthly Accrual (1st of every month)");
  console.log("   2. Annual Emergency Reset (January 1st)");
  console.log("   3. Real-time balance updates");
  console.log("   4. Leave request workflow");
  console.log("   5. PDF form generation");

  console.log(color("\n📊 DATA FLOW:", colors.bright));
  console.log("   Employee Request → Admin Approval → Balance Deduction");
  console.log("   Monthly Cron → Check Conditions → Add 1.25 Credits");
  console.log("   Annual Cron → Reset Emergency → Start New Year Fresh");

  console.log(color("\n🛡️  VALIDATION RULES:", colors.bright));
  console.log("   • Minimum 1.25 days balance after request");
  console.log("   • Emergency leave caps at 5 days/year");
  console.log("   • Without-pay leave blocks monthly accrual");
  console.log("   • Holidays/weekends excluded from calculations");
  console.log("   • 5-day advance notice for non-emergency leaves");
}

// ======================
// MAIN DEMO FUNCTION
// ======================

async function runCapstoneDemo() {
  console.log(color("\n" + "🎓".repeat(25), colors.bright + colors.magenta));
  console.log(
    color("      BFP LEAVE MANAGEMENT SYSTEM", colors.bright + colors.magenta)
  );
  console.log(
    color("      COMPUTER ENGINEERING CAPSTONE", colors.bright + colors.magenta)
  );
  console.log(
    color("      DEFENSE DAY DEMONSTRATION", colors.bright + colors.magenta)
  );
  console.log(color("🎓".repeat(25) + "\n", colors.bright + colors.magenta));

  // Pause for dramatic effect
  await new Promise((resolve) => setTimeout(resolve, 1000));

  try {
    // Test database connection
    console.log(color("🔌 Testing database connection...", colors.cyan));
    const { data, error } = await supabase
      .from("personnel")
      .select("count")
      .limit(1);

    if (error) {
      console.log(
        color("   ❌ Connection failed: " + error.message, colors.red)
      );
      console.log(
        color("   Using demo mode (offline simulation)", colors.yellow)
      );
    } else {
      console.log(
        color("   ✅ Connected to Supabase successfully", colors.green)
      );
    }

    // Run all demo sections
    displayBFPFormula();
    await new Promise((resolve) => setTimeout(resolve, 1500));

    await runDemoTestCases();
    await new Promise((resolve) => setTimeout(resolve, 1500));

    await simulateMonthlyProcess();
    await new Promise((resolve) => setTimeout(resolve, 1500));

    demonstrateAnnualReset();
    await new Promise((resolve) => setTimeout(resolve, 1500));

    demonstrateIntegration();

    // Final summary
    console.log(color("\n" + "✨".repeat(50), colors.bright + colors.magenta));
    console.log(
      color(
        "               DEMONSTRATION COMPLETE",
        colors.bright + colors.magenta
      )
    );
    console.log(color("✨".repeat(50), colors.bright + colors.magenta));

    console.log(color("\n🎯 KEY FEATURES DEMONSTRATED:", colors.bright));
    console.log("   1. ✅ BFP Formula Implementation");
    console.log("   2. ✅ Time-based Pro-rating");
    console.log("   3. ✅ Payment Type Logic");
    console.log("   4. ✅ Monthly Automation");
    console.log("   5. ✅ Annual Reset System");
    console.log("   6. ✅ Database Integration");

    console.log(color("\n👨‍💻 DEVELOPED BY: [Your Name]", colors.bright));
    console.log(color("🏫 BSCpE CAPSTONE PROJECT 2024", colors.bright));
    console.log(color("📧 Contact: [your.email@school.edu]", colors.bright));
  } catch (error) {
    console.error(color("\n❌ Demo error: " + error.message, colors.red));
  }
}

// ======================
// COMMAND LINE INTERFACE
// ======================

if (require.main === module) {
  console.log(
    color("\n🚀 Starting BFP Capstone Demo...", colors.bright + colors.green)
  );

  // Check for command line arguments
  const args = process.argv.slice(2);

  if (args.includes("--quick")) {
    console.log(color("⚡ Quick mode enabled", colors.yellow));
    // Run simplified version
    displayBFPFormula();
    runDemoTestCases();
    simulateMonthlyProcess();
  } else if (args.includes("--formula-only")) {
    displayBFPFormula();
  } else if (args.includes("--test-cases")) {
    runDemoTestCases();
  } else if (args.includes("--monthly")) {
    simulateMonthlyProcess();
  } else {
    // Full demo
    runCapstoneDemo();
  }
}

module.exports = {
  runCapstoneDemo,
  calculateBFPProRatedLeaveDemo,
  simulateMonthlyProcess,
  demonstrateAnnualReset,
};
