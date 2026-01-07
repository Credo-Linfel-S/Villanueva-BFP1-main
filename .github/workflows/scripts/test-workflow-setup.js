// scripts/test-workflow-setup.js
const fs = require("fs");
const path = require("path");

console.log("🧪 Testing workflow setup...\n");

// Check if all files exist
const requiredFiles = [
  ".github/workflows/check-pending-requests.yml",
  ".github/workflows/daily-notifications.yml",
  ".github/workflows/weekly-summary.yml",
  ".github/scripts/check-pending-requests.js",
  ".github/scripts/check-upcoming-inspections.js",
  ".github/scripts/check-new-applicants.js",
  ".github/scripts/daily-aggregator.js",
  "scripts/create-workflow-scripts.js",
  "package.json",
];

let allFilesExist = true;

requiredFiles.forEach((file) => {
  const exists = fs.existsSync(file);
  console.log(`${exists ? "✅" : "❌"} ${file}`);
  if (!exists) allFilesExist = false;
});

console.log("\n📦 Checking package.json scripts...");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const requiredScripts = [
  "create-workflow-scripts",
  "check-pending-requests",
  "check-upcoming-inspections",
  "check-new-applicants",
  "daily-aggregator",
  "setup-workflows",
];

requiredScripts.forEach((script) => {
  const hasScript = packageJson.scripts && packageJson.scripts[script];
  console.log(`${hasScript ? "✅" : "❌"} npm run ${script}`);
  if (!hasScript) allFilesExist = false;
});

if (allFilesExist) {
  console.log("\n🎉 All files and scripts are properly set up!");
  console.log("\n🚀 To create notifications:");
  console.log("1. Set environment variables:");
  console.log('   export SUPABASE_URL="your_url"');
  console.log('   export SUPABASE_SERVICE_ROLE_KEY="your_key"');
  console.log('   export ADMIN_USER_ID="00000000-0000-0000-0000-000000000001"');
  console.log("\n2. Run any script:");
  console.log("   npm run check-pending-requests");
  console.log("   npm run check-upcoming-inspections");
  console.log("   npm run daily-aggregator");
} else {
  console.log("\n❌ Some files are missing. Run: npm run setup-workflows");
}
