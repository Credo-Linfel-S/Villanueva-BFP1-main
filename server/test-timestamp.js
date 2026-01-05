// server/test-timestamp.js
require("dotenv").config();
const { supabase } = require("./lib/supabaseClient");

async function testTimestamp() {
  console.log("🧪 Testing hired_at timestamp parsing\n");

  // Get a sample employee with hired_at
  const { data: employees } = await supabase
    .from("personnel")
    .select("id, first_name, date_hired, hired_at")
    .not("hired_at", "is", null)
    .limit(3);

  employees?.forEach((emp) => {
    console.log(`Employee: ${emp.first_name}`);
    console.log(`date_hired: ${emp.date_hired}`);
    console.log(`hired_at: ${emp.hired_at}`);

    // Parse the timestamp
    const hiredAt = new Date(emp.hired_at);
    console.log(`Parsed as Date: ${hiredAt.toISOString()}`);
    console.log(`Valid date? ${!isNaN(hiredAt.getTime())}`);

    if (!isNaN(hiredAt.getTime())) {
      console.log(`UTC Hours: ${hiredAt.getUTCHours()}`);
      console.log(`UTC Minutes: ${hiredAt.getUTCMinutes()}`);
      console.log(
        `PH Time: ${hiredAt.getUTCHours() + 8}:${hiredAt.getUTCMinutes()}`
      );
    }

    console.log("---\n");
  });
}

testTimestamp().catch(console.error);
