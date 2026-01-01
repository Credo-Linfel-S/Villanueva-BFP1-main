// server/test-fixed-formula.js
function calculateProRatedLeave(dateHiredStr, targetDate = new Date()) {
  if (!dateHiredStr) return 0;

  const hireDate = new Date(dateHiredStr);
  const target = new Date(targetDate);

  if (hireDate > target) return 0;

  // Get the hire month
  const hireMonth = hireDate.getMonth();
  const hireYear = hireDate.getFullYear();

  // Days in the hire month
  const daysInHireMonth = new Date(hireYear, hireMonth + 1, 0).getDate();

  // Hire day (1-31)
  const hireDay = hireDate.getDate();

  // Days worked in hire month: Days in Month - (Hire Day - 1)
  const daysWorked = daysInHireMonth - (hireDay - 1);

  // Pro-rated leave for hire month
  const proRatedLeave = (daysWorked / daysInHireMonth) * 1.25;

  console.log(`Hired: ${dateHiredStr}`);
  console.log(`Hire day: ${hireDay}`);
  console.log(`Days in month: ${daysInHireMonth}`);
  console.log(`Days worked: ${daysWorked}`);
  console.log(`Formula: (${daysWorked}/${daysInHireMonth}) × 1.25`);

  return parseFloat(proRatedLeave.toFixed(3));
}

console.log("🧪 Testing FIXED formula...\n");

// Test cases
const tests = [
  { hire: "2025-12-01", expected: 1.25 },
  { hire: "2025-12-15", expected: 0.685 },
  { hire: "2025-12-31", expected: 0.04 },
  { hire: "2025-12-20", expected: 0.484 },
];

tests.forEach((test) => {
  console.log(`\n--- Test: Hired ${test.hire} ---`);
  const result = calculateProRatedLeave(test.hire, new Date("2026-01-01"));
  console.log(`Result: ${result} days`);
  console.log(`Expected: ${test.expected} days`);
  console.log(`Match: ${result === test.expected ? "✅" : "❌"}`);
});
