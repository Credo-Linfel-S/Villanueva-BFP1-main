// server/test-github-workflow.js
require("dotenv").config();

console.log("🧪 Testing GitHub Actions Workflow Logic");

// Simulate what GitHub Actions will run
const originalDate = global.Date;
global.Date = class extends Date {
  getDate() {
    return 1;
  } // Force 1st of month
};

console.log("Simulated date (1st of month):", new Date().toISOString());

// Test with CrystalMaiden's data
const hireDate = "2025-12-31";
const hireDateObj = new Date(hireDate);
const currentDate = new Date("2026-01-01"); // Simulated 1st

console.log("\n🔍 Testing CrystalMaiden (hired Dec 31):");
console.log(`Hire: ${hireDate}`);
console.log(`Current: ${currentDate.toISOString().split("T")[0]}`);

// Simple logic check
const hireYear = hireDateObj.getFullYear();
const hireMonth = hireDateObj.getMonth();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth();

console.log(`Hire month: ${hireMonth + 1} (${hireYear})`);
console.log(`Current month: ${currentMonth + 1} (${currentYear})`);

// Check if hired in previous month
const isPreviousMonth =
  (hireYear === currentYear && hireMonth === currentMonth - 1) ||
  (hireYear === currentYear - 1 && hireMonth === 11 && currentMonth === 0);

console.log(
  `\nHired in previous month? ${
    isPreviousMonth ? "YES → Pro-rated" : "NO → Regular 1.25"
  }`
);

if (isPreviousMonth) {
  const daysInHireMonth = new Date(hireYear, hireMonth + 1, 0).getDate();
  const hireDay = hireDateObj.getDate();
  const daysWorked = daysInHireMonth - (hireDay - 1);
  const proRated = (daysWorked / daysInHireMonth) * 1.25;

  console.log(`Days in Dec: ${daysInHireMonth}`);
  console.log(`Hire day: ${hireDay}`);
  console.log(`Days worked: ${daysWorked}`);
  console.log(
    `Pro-rated: (${daysWorked}/${daysInHireMonth}) × 1.25 = ${proRated.toFixed(
      3
    )} days`
  );
}

console.log("\n🎯 CrystalMaiden should get: 0.04 days (pro-rated)");

// Restore Date
global.Date = originalDate;
