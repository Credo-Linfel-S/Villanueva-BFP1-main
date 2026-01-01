// server/test-connection.js
const { supabase } = require("./lib/supabaseClient");

async function testConnection() {
  console.log("Testing database connection...");
  try {
    // Try a simple query
    const { data, error } = await supabase
      .from("personnel")
      .select("id")
      .limit(1);

    if (error) {
      console.error("❌ Database error:", error.message);
      return false;
    }

    console.log(
      `✅ Connected successfully! Found ${data?.length || 0} records`
    );
    return true;
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    return false;
  }
}

testConnection();
