// server/debug-pro-rated.js
const { calculateProRatedLeave } = require("./cron/monthly-accrual");

// Test with different hire dates
console.log("🧪 Testing pro-rated formula...\n");

// Test 1: Hired on 15th of last month
const hireDate1 = "2025-12-15"; // Last month
const proRated1 = calculateProRatedLeave(hireDate1, new Date("2026-01-01"));
console.log(`Hired Dec 15, 2025: ${proRated1} days`);
console.log(`Expected: (17/31) × 1.25 = 0.685 days\n`);

// Test 2: Hired on 1st of last month
const hireDate2 = "2025-12-01";
const proRated2 = calculateProRatedLeave(hireDate2, new Date("2026-01-01"));
console.log(`Hired Dec 1, 2025: ${proRated2} days`);
console.log(`Expected: Full 1.25 days (worked all days)\n`);

// Test 3: Hired on 31st of last month
const hireDate3 = "2025-12-31";
const proRated3 = calculateProRatedLeave(hireDate3, new Date("2026-01-01"));
console.log(`Hired Dec 31, 2025: ${proRated3} days`);
console.log(`Expected: (1/31) × 1.25 = 0.040 days\n`);
