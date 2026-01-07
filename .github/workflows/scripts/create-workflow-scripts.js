// scripts/create-workflow-scripts.js
const fs = "fs";
const path = "path";

console.log("🚀 Creating GitHub Workflow scripts...");

// Ensure directories exist
const dirs = [".github/workflows", ".github/scripts", "scripts"];

dirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// 1. Check Pending Requests Workflow
const checkPendingRequestsWorkflow = `name: Check Pending Requests and Create Notifications
on:
  schedule:
    # Runs every 30 minutes
    - cron: '*/30 * * * *'
  workflow_dispatch:

jobs:
  check-requests:
    runs-on: ubuntu-latest
    
    env:
      SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      ADMIN_USER_ID: '00000000-0000-0000-0000-000000000001'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run notification checker
        run: npm run check-pending-requests`;

// 2. Daily Notifications Workflow
const dailyNotificationsWorkflow = `name: Daily Notification Aggregator
on:
  schedule:
    # Runs daily at 9 AM UTC (5 PM PH Time)
    - cron: '0 9 * * *'
  workflow_dispatch:

jobs:
  daily-notifications:
    runs-on: ubuntu-latest
    
    env:
      SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      ADMIN_USER_ID: '00000000-0000-0000-0000-000000000001'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run daily aggregator
        run: npm run daily-aggregator`;

// 3. Weekly Summary Workflow
const weeklySummaryWorkflow = `name: Weekly System Summary
on:
  schedule:
    # Runs every Monday at 9 AM UTC
    - cron: '0 9 * * 1'
  workflow_dispatch:

jobs:
  weekly-summary:
    runs-on: ubuntu-latest
    
    env:
      SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      ADMIN_USER_ID: '00000000-0000-0000-0000-000000000001'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run all weekly checks
        run: |
          npm run check-pending-requests
          npm run check-upcoming-inspections
          npm run check-new-applicants
          npm run daily-aggregator`;

// Write workflow files
const workflows = {
  "check-pending-requests.yml": checkPendingRequestsWorkflow,
  "daily-notifications.yml": dailyNotificationsWorkflow,
  "weekly-summary.yml": weeklySummaryWorkflow,
};

Object.entries(workflows).forEach(([filename, content]) => {
  const filepath = `.github/workflows/${filename}`;
  fs.writeFileSync(filepath, content);
  console.log(`✅ Created: ${filepath}`);
});

// Create the script files
const scripts = {
  // 1. Check Pending Requests
  "check-pending-requests.js": `// .github/scripts/check-pending-requests.js
const { createClient } = require('@supabase/supabase-js');

console.log('🚀 Starting pending requests check...');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminUserId = process.env.ADMIN_USER_ID;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPendingLeaveRequests() {
  try {
    console.log('🔍 Checking pending leave requests...');
    
    // Get leave requests pending for more than 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    const { data: pendingRequests, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'Pending')
      .lte('created_at', twentyFourHoursAgo.toISOString());

    if (error) throw error;

    if (pendingRequests && pendingRequests.length > 0) {
      console.log(\`📋 Found \${pendingRequests.length} leave requests pending for 24+ hours\`);
      
      for (const request of pendingRequests) {
        // Check if notification already exists for this request
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('data->>leave_request_id', request.id)
          .eq('type', 'warning')
          .single();

        if (!existingNotification) {
          // Create notification for admin
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              user_id: adminUserId,
              title: 'Pending Leave Request - Urgent',
              message: \`Leave request from \${request.employee_name} has been pending for 24+ hours\`,
              type: 'warning',
              data: {
                source: 'leave_request',
                leave_request_id: request.id,
                employee_name: request.employee_name,
                days_pending: 1,
                timestamp: new Date().toISOString()
              }
            });

          if (notificationError) {
            console.error('Error creating notification:', notificationError);
          } else {
            console.log(\`✅ Created notification for leave request \${request.id}\`);
          }
        }
      }
    } else {
      console.log('✅ No leave requests pending for 24+ hours');
    }
  } catch (error) {
    console.error('Error checking leave requests:', error);
  }
}

async function checkNewLeaveRequests() {
  try {
    console.log('🔍 Checking for new leave requests...');
    
    // Get leave requests created in the last 1 hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const { data: newRequests, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'Pending')
      .gte('created_at', oneHourAgo.toISOString());

    if (error) throw error;

    if (newRequests && newRequests.length > 0) {
      console.log(\`📋 Found \${newRequests.length} new leave requests\`);
      
      for (const request of newRequests) {
        // Check if notification already exists
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('data->>leave_request_id', request.id)
          .eq('type', 'warning')
          .single();

        if (!existingNotification) {
          // Create notification
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              user_id: adminUserId,
              title: 'New Leave Request',
              message: \`\${request.employee_name} submitted a \${request.leave_type.toLowerCase()} leave request\`,
              type: 'warning',
              data: {
                source: 'leave_request',
                leave_request_id: request.id,
                employee_name: request.employee_name,
                leave_type: request.leave_type,
                num_days: request.num_days,
                timestamp: new Date().toISOString()
              }
            });

          if (notificationError) {
            console.error('Error creating notification:', notificationError);
          } else {
            console.log(\`✅ Created notification for new leave request \${request.id}\`);
          }
        }
      }
    } else {
      console.log('✅ No new leave requests in the last hour');
    }
  } catch (error) {
    console.error('Error checking new leave requests:', error);
  }
}

async function main() {
  console.log('🚀 Starting notification check...');
  console.log('===============================');
  
  await checkNewLeaveRequests();
  console.log('---');
  await checkPendingLeaveRequests();
  
  console.log('===============================');
  console.log('✅ Notification check completed');
}

main().catch(console.error);`,

  // 2. Check Upcoming Inspections
  "check-upcoming-inspections.js": `// .github/scripts/check-upcoming-inspections.js
const { createClient } = require('@supabase/supabase-js');

console.log('🚀 Starting inspection check...');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminUserId = process.env.ADMIN_USER_ID;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUpcomingInspections() {
  try {
    console.log('🔍 Checking upcoming inspections...');
    
    // Get inspections scheduled for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    // Check for inspections tomorrow
    const { data: inspectionsTomorrow, error: tomorrowError } = await supabase
      .from('inspections')
      .select('*')
      .eq('status', 'PENDING')
      .eq('schedule_inspection_date', tomorrowDate);

    if (tomorrowError) throw tomorrowError;

    if (inspectionsTomorrow && inspectionsTomorrow.length > 0) {
      console.log(\`📅 Found \${inspectionsTomorrow.length} inspections scheduled for tomorrow\`);
      
      for (const inspection of inspectionsTomorrow) {
        // Check if notification already exists
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('data->>inspection_id', inspection.id)
          .eq('data->>reminder_type', 'tomorrow')
          .single();

        if (!existingNotification) {
          // Create notification
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              user_id: adminUserId,
              title: 'Inspection Tomorrow',
              message: \`Inspection scheduled for tomorrow: \${inspection.inspector_name || 'Unknown inspector'}\`,
              type: 'info',
              data: {
                source: 'inspection',
                inspection_id: inspection.id,
                inspector_name: inspection.inspector_name,
                schedule_date: inspection.schedule_inspection_date,
                reminder_type: 'tomorrow',
                timestamp: new Date().toISOString()
              }
            });

          if (notificationError) {
            console.error('Error creating notification:', notificationError);
          } else {
            console.log(\`✅ Created notification for inspection \${inspection.id}\`);
          }
        }
      }
    } else {
      console.log('✅ No inspections scheduled for tomorrow');
    }

    // Check for inspections in 3 days (for weekly reminder)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysDate = threeDaysFromNow.toISOString().split('T')[0];

    const { data: inspectionsThreeDays, error: threeDaysError } = await supabase
      .from('inspections')
      .select('*')
      .eq('status', 'PENDING')
      .eq('schedule_inspection_date', threeDaysDate);

    if (threeDaysError) throw threeDaysError;

    if (inspectionsThreeDays && inspectionsThreeDays.length > 0) {
      console.log(\`📅 Found \${inspectionsThreeDays.length} inspections in 3 days\`);
      
      // Create weekly summary notification
      const { error: summaryError } = await supabase
        .from('notifications')
        .insert({
          user_id: adminUserId,
          title: 'Weekly Inspection Summary',
          message: \`You have \${inspectionsThreeDays.length} inspection(s) coming up in 3 days\`,
          type: 'info',
          data: {
            source: 'inspection_summary',
            count: inspectionsThreeDays.length,
            upcoming_date: threeDaysDate,
            timestamp: new Date().toISOString()
          }
        });

      if (summaryError) {
        console.error('Error creating summary notification:', summaryError);
      } else {
        console.log('✅ Created weekly inspection summary');
      }
    }

  } catch (error) {
    console.error('Error checking inspections:', error);
  }
}

async function main() {
  console.log('🚀 Starting inspection check...');
  console.log('===============================');
  
  await checkUpcomingInspections();
  
  console.log('===============================');
  console.log('✅ Inspection check completed');
}

main().catch(console.error);`,

  // 3. Check New Applicants
  "check-new-applicants.js": `// .github/scripts/check-new-applicants.js
const { createClient } = require('@supabase/supabase-js');

console.log('🚀 Starting recruitment check...');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminUserId = process.env.ADMIN_USER_ID;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNewRecruitmentApplicants() {
  try {
    console.log('🔍 Checking new recruitment applicants...');
    
    // Get applicants added in the last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    const { data: newApplicants, error } = await supabase
      .from('recruitment_personnel')
      .select('*')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (newApplicants && newApplicants.length > 0) {
      console.log(\`👥 Found \${newApplicants.length} new applicants in last 24 hours\`);
      
      // Group by day for summary
      const applicantsByDay = {};
      newApplicants.forEach(applicant => {
        const day = applicant.created_at.split('T')[0];
        if (!applicantsByDay[day]) {
          applicantsByDay[day] = [];
        }
        applicantsByDay[day].push(applicant);
      });

      // Create daily summary
      for (const [day, dayApplicants] of Object.entries(applicantsByDay)) {
        // Check if summary already exists for this day
        const { data: existingSummary } = await supabase
          .from('notifications')
          .select('id')
          .eq('data->>summary_day', day)
          .eq('type', 'info')
          .single();

        if (!existingSummary && dayApplicants.length > 0) {
          const { error: summaryError } = await supabase
            .from('notifications')
            .insert({
              user_id: adminUserId,
              title: 'Daily Recruitment Summary',
              message: \`\${dayApplicants.length} new applicant(s) on \${day}\`,
              type: 'info',
              data: {
                source: 'recruitment_summary',
                summary_day: day,
                count: dayApplicants.length,
                positions: [...new Set(dayApplicants.map(a => a.position))],
                timestamp: new Date().toISOString()
              }
            });

          if (summaryError) {
            console.error('Error creating summary:', summaryError);
          } else {
            console.log(\`✅ Created daily summary for \${day}\`);
          }
        }
      }

      // Also create individual notifications for urgent applications
      const urgentApplicants = newApplicants.filter(app => 
        app.stage === 'Applied' && app.status === 'Urgent'
      );

      if (urgentApplicants.length > 0) {
        for (const applicant of urgentApplicants) {
          const { error: urgentError } = await supabase
            .from('notifications')
            .insert({
              user_id: adminUserId,
              title: 'Urgent Application',
              message: \`Urgent application from \${applicant.full_name || applicant.candidate} for \${applicant.position}\`,
              type: 'warning',
              data: {
                source: 'urgent_applicant',
                applicant_id: applicant.id,
                applicant_name: applicant.full_name || applicant.candidate,
                position: applicant.position,
                stage: applicant.stage,
                timestamp: new Date().toISOString()
              }
            });

          if (urgentError) {
            console.error('Error creating urgent notification:', urgentError);
          } else {
            console.log(\`⚠️ Created urgent notification for applicant \${applicant.id}\`);
          }
        }
      }
    } else {
      console.log('✅ No new applicants in last 24 hours');
    }
  } catch (error) {
    console.error('Error checking applicants:', error);
  }
}

async function main() {
  console.log('🚀 Starting recruitment check...');
  console.log('===============================');
  
  await checkNewRecruitmentApplicants();
  
  console.log('===============================');
  console.log('✅ Recruitment check completed');
}

main().catch(console.error);`,

  // 4. Daily Aggregator
  "daily-aggregator.js": `// .github/scripts/daily-aggregator.js
const { createClient } = require('@supabase/supabase-js');

console.log('🚀 Starting daily aggregator...');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminUserId = process.env.ADMIN_USER_ID;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createDailySummary() {
  try {
    console.log('📊 Creating daily summary...');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];
    
    // Get counts for yesterday
    const [leaveRequests, inspections, applicants] = await Promise.all([
      supabase
        .from('leave_requests')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', \`\${yesterdayDate}T00:00:00\`)
        .lte('created_at', \`\${yesterdayDate}T23:59:59\`),
      
      supabase
        .from('inspections')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', \`\${yesterdayDate}T00:00:00\`)
        .lte('created_at', \`\${yesterdayDate}T23:59:59\`),
      
      supabase
        .from('recruitment_personnel')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', \`\${yesterdayDate}T00:00:00\`)
        .lte('created_at', \`\${yesterdayDate}T23:59:59\`)
    ]);

    const leaveCount = leaveRequests.count || 0;
    const inspectionCount = inspections.count || 0;
    const applicantCount = applicants.count || 0;

    console.log(\`📈 Yesterday's activity:\`);
    console.log(\`   Leave Requests: \${leaveCount}\`);
    console.log(\`   Inspections: \${inspectionCount}\`);
    console.log(\`   Applicants: \${applicantCount}\`);

    // Create daily summary notification
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: adminUserId,
        title: 'Daily Activity Summary',
        message: \`Yesterday: \${leaveCount} leave requests, \${inspectionCount} inspections, \${applicantCount} applicants\`,
        type: 'info',
        data: {
          source: 'daily_summary',
          summary_date: yesterdayDate,
          leave_requests: leaveCount,
          inspections: inspectionCount,
          applicants: applicantCount,
          timestamp: new Date().toISOString()
        }
      });

    if (error) {
      console.error('Error creating daily summary:', error);
    } else {
      console.log('✅ Daily summary created');
    }

  } catch (error) {
    console.error('Error in daily aggregator:', error);
  }
}

async function main() {
  console.log('🚀 Starting daily aggregator...');
  console.log('===============================');
  
  await createDailySummary();
  
  console.log('===============================');
  console.log('✅ Daily aggregator completed');
}

main().catch(console.error);`,
};

// Write script files
Object.entries(scripts).forEach(([filename, content]) => {
  const filepath = `.github/scripts/${filename}`;
  fs.writeFileSync(filepath, content);
  console.log(`✅ Created: ${filepath}`);
});

// Create a README for the scripts
const readme = `# GitHub Workflow Scripts

This folder contains scripts that run automatically via GitHub Actions to create notifications for the admin dashboard.

## Available Scripts

1. **check-pending-requests.js** - Checks for new and pending leave requests
2. **check-upcoming-inspections.js** - Checks for upcoming inspections
3. **check-new-applicants.js** - Checks for new recruitment applicants
4. **daily-aggregator.js** - Creates daily summary of activities

## Manual Testing

You can test these scripts locally:

\`\`\`bash
# Set environment variables first
export SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
export ADMIN_USER_ID="00000000-0000-0000-0000-000000000001"

# Run any script
npm run check-pending-requests
npm run check-upcoming-inspections
npm run check-new-applicants
npm run daily-aggregator
\`\`\`

## GitHub Secrets Required

1. SUPABASE_URL - Your Supabase project URL
2. SUPABASE_SERVICE_ROLE_KEY - From Supabase dashboard → Settings → API

## Workflow Schedule

- **Every 30 minutes**: Check pending requests
- **Daily at 9 AM UTC (5 PM PH Time)**: Daily aggregator
- **Every Monday at 9 AM UTC**: Weekly summary

## Created by setup script

Run \`npm run setup-workflows\` to recreate all files.`;

fs.writeFileSync(".github/scripts/README.md", readme);
console.log("✅ Created: .github/scripts/README.md");

console.log("\n🎉 All workflow scripts created successfully!");
console.log("\n📝 Next steps:");
console.log("1. Add Supabase secrets to GitHub Actions:");
console.log(
  "   - Go to your GitHub repo → Settings → Secrets and variables → Actions"
);
console.log("   - Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
console.log("\n2. Push the code to GitHub");
console.log("\n3. Manually trigger workflows to test:");
console.log("   - Go to GitHub → Actions → Select workflow → Run workflow");
console.log("\n4. Check your admin dashboard for notifications!");
