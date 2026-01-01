// test-fixed-timezone.js
require("dotenv").config();
const { supabase } = require("./lib/supabaseClient");

// Fixed calculation with UTC
function calculateMonthsWorked(hireDateStr, currentDate) {
  const hireDate = new Date(hireDateStr + "T00:00:00Z");
  const currentDateUTC = new Date(
    Date.UTC(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate()
    )
  );

  const currentMonth = currentDateUTC.getUTCMonth();
  const currentYear = currentDateUTC.getUTCFullYear();
  const hireYear = hireDate.getUTCFullYear();
  const hireMonth = hireDate.getUTCMonth();

  let monthsWorked = (currentYear - hireYear) * 12 + (currentMonth - hireMonth);

  if (currentDateUTC.getUTCDate() < hireDate.getUTCDate()) {
    monthsWorked--;
  }

  return monthsWorked;
}

console.log("🧪 Testing Fixed Timezone Calculation");

const tests = [
  { hire: "2025-12-31", current: "2026-01-01", expected: 1 },
  { hire: "2025-12-01", current: "2026-01-01", expected: 1 },
  { hire: "2025-12-15", current: "2026-01-01", expected: 1 },
  { hire: "2025-11-30", current: "2026-01-01", expected: 2 },
  { hire: "2026-01-01", current: "2026-01-01", expected: 0 },
];

tests.forEach((test) => {
  const months = calculateMonthsWorked(test.hire, new Date(test.current));
  console.log(
    `Hire ${test.hire}, Current ${test.current}: ${months} months ${
      months === test.expected ? "✅" : "❌"
    }`
  );
});

// Test CrystalMaiden
console.log("\n🔍 CrystalMaiden Test:");
const crystalMonths = calculateMonthsWorked(
  "2025-12-31",
  new Date("2026-01-01")
);
console.log(`Months worked: ${crystalMonths}`);
console.log(`Should be: 1 month (pro-rated)`);
console.log(crystalMonths === 1 ? "✅ FIXED!" : "❌ Still broken");
