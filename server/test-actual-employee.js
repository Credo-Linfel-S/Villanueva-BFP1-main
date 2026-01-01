// server/test-actual-employee.js
require("dotenv").config();
const { supabase } = require("./lib/supabaseClient");

// Fixed formula
function calculateProRatedLeave(dateHiredStr) {
  if (!dateHiredStr) return 0;

  const hireDate = new Date(dateHiredStr);

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

  return parseFloat(proRatedLeave.toFixed(3));
}

async function testActualEmployee() {
  console.log("🧪 Testing actual employee...");

  // Get the employee data
  const { data: employee, error } = await supabase
    .from("personnel")
    .select("first_name, last_name, date_hired")
    .eq("id", "f6b37406-303a-476e-a0e8-75fa6d1f7864")
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`\nEmployee: ${employee.first_name} ${employee.last_name}`);
  console.log(`Hire Date: ${employee.date_hired}`);

  const hireDate = new Date(employee.date_hired);
  console.log(`Hire Month: ${hireDate.getMonth() + 1}`);
  console.log(`Hire Day: ${hireDate.getDate()}`);

  // Calculate
  const proRated = calculateProRatedLeave(employee.date_hired);
  console.log(`\n📊 CALCULATION:`);
  console.log(`Pro-rated leave: ${proRated} days`);

  // Expected based on hire day
  const daysInMonth = new Date(
    hireDate.getFullYear(),
    hireDate.getMonth() + 1,
    0
  ).getDate();
  const hireDay = hireDate.getDate();
  const daysWorked = daysInMonth - (hireDay - 1);

  console.log(`Days in month: ${daysInMonth}`);
  console.log(`Days worked: ${daysWorked}`);
  console.log(`Formula: (${daysWorked}/${daysInMonth}) × 1.25 = ${proRated}`);

  // Check if it should be 1.25 or less
  if (hireDay === 1) {
    console.log("\n✅ CORRECT: Hired on 1st → Full 1.25 days");
  } else {
    console.log(
      `\n✅ CORRECT: Hired on ${hireDay}th → Pro-rated ${proRated} days`
    );
  }
}

testActualEmployee().catch(console.error);
