import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🚀 Creating GitHub Workflow scripts...");

// Ensure directories exist
const dirs = [".github/workflows", ".github/workflows/scripts", "scripts"];

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
      
      - name: Install @supabase/supabase-js
        run: npm install @supabase/supabase-js
      
      - name: Run notification checker
        run: node .github/workflows/scripts/check-pending-requests.js`;

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
      
      - name: Install @supabase/supabase-js
        run: npm install @supabase/supabase-js
      
      - name: Run daily aggregator
        run: node .github/workflows/scripts/daily-aggregator.js`;

// 3. Hourly Recruitment Check
const hourlyRecruitmentWorkflow = `name: Hourly Recruitment Quick Check
on:
  schedule:
    # Runs every hour
    - cron: '0 * * * *'
  workflow_dispatch:

jobs:
  quick-recruitment-check:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    
    env:
      SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      ADMIN_USER_ID: '00000000-0000-0000-0000-000000000001'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install @supabase/supabase-js
        run: npm install @supabase/supabase-js
      
      - name: Run quick recruitment check
        run: node .github/workflows/scripts/quick-recruitment-check.js`;

// 4. Recruitment Notifications
const recruitmentNotificationsWorkflow = `name: Recruitment Applicant Notifications
on:
  schedule:
    # Runs every 2 hours
    - cron: '0 */2 * * *'
  workflow_dispatch:

jobs:
  recruitment-notifications:
    runs-on: ubuntu-latest
    
    env:
      SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      ADMIN_USER_ID: '00000000-0000-0000-0000-000000000001'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install @supabase/supabase-js
        run: npm install @supabase/supabase-js
      
      - name: Run recruitment notification checker
        run: node .github/workflows/scripts/check-applicant-updates.js`;

// Write workflow files
const workflows = {
  "check-pending-requests.yml": checkPendingRequestsWorkflow,
  "daily-notifications.yml": dailyNotificationsWorkflow,
  "hourly-recruitment-check.yml": hourlyRecruitmentWorkflow,
  "recruitment-notifications.yml": recruitmentNotificationsWorkflow,
};

Object.entries(workflows).forEach(([filename, content]) => {
  const filepath = `.github/workflows/${filename}`;
  fs.writeFileSync(filepath, content);
  console.log(`✅ Created: ${filepath}`);
});

// Create the script files (ES Module versions)
const scripts = {
  // 1. Check Pending Requests (ES Module)
  "check-pending-requests.js": `import { createClient } from '@supabase/supabase-js';

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
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('data->>leave_request_id', request.id)
          .eq('type', 'warning')
          .single();

        if (!existingNotification) {
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
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('data->>leave_request_id', request.id)
          .eq('type', 'warning')
          .single();

        if (!existingNotification) {
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

  // 2. Quick Recruitment Check (ES Module)
  "quick-recruitment-check.js": `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminUserId = process.env.ADMIN_USER_ID;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUrgentRecruitmentUpdates() {
  try {
    console.log('⚡ Running quick recruitment check...');

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { data: urgentUpdates, error } = await supabase
      .from('recruitment_personnel')
      .select('*')
      .in('status', ['Hired', 'Rejected', 'Offered'])
      .gte('updated_at', oneHourAgo.toISOString())
      .order('updated_at', { ascending: false });

    if (error) throw error;

    if (urgentUpdates && urgentUpdates.length > 0) {
      console.log(\`⚡ Found \${urgentUpdates.length} urgent updates in last hour\`);

      for (const applicant of urgentUpdates) {
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('data->>applicant_id', applicant.id)
          .eq('data->>new_status', applicant.status)
          .gte('created_at', oneHourAgo.toISOString())
          .single();

        if (!existing) {
          const isPositive = applicant.status === 'Hired' || applicant.status === 'Offered';
          await supabase.from('notifications').insert({
            user_id: adminUserId,
            title: 'URGENT: Status Update',
            message: \`\${applicant.full_name || applicant.candidate} - \${applicant.status}\`,
            type: isPositive ? 'success' : 'warning',
            data: {
              source: 'recruitment_urgent',
              applicant_id: applicant.id,
              applicant_name: applicant.full_name || applicant.candidate,
              new_status: applicant.status,
              timestamp: new Date().toISOString(),
            },
          });
          console.log(\`⚡ Created urgent notification for \${applicant.id}\`);
        }
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: todaysInterviews, error: interviewError } = await supabase
      .from('recruitment_personnel')
      .select('*')
      .eq('interview_date', today)
      .order('created_at', { ascending: true });

    if (interviewError) throw interviewError;

    if (todaysInterviews && todaysInterviews.length > 0) {
      const { data: existingReminder } = await supabase
        .from('notifications')
        .select('id')
        .eq('data->>reminder_date', today)
        .eq('data->>notification_type', 'interview_today')
        .gte('created_at', oneHourAgo.toISOString())
        .single();

      if (!existingReminder) {
        await supabase.from('notifications').insert({
          user_id: adminUserId,
          title: 'Interviews Today',
          message: \`\${todaysInterviews.length} interview\${todaysInterviews.length !== 1 ? 's' : ''} scheduled for today\`,
          type: 'info',
          data: {
            source: 'recruitment_today',
            reminder_date: today,
            interview_count: todaysInterviews.length,
            applicant_names: todaysInterviews.map(a => a.full_name || a.candidate),
            timestamp: new Date().toISOString(),
          },
        });
        console.log(\`📅 Created today's interview reminder\`);
      }
    }

    console.log('✅ Quick recruitment check completed');
  } catch (error) {
    console.error('Error in quick check:', error);
  }
}

checkUrgentRecruitmentUpdates().catch(console.error);`,

  // 3. Check Applicant Updates (ES Module)
  "check-applicant-updates.js": `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminUserId = process.env.ADMIN_USER_ID;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNewResumeUploads() {
  try {
    console.log('📄 Checking for new resume uploads...');
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: applicantsWithResume, error } = await supabase
      .from('recruitment_personnel')
      .select('*')
      .not('resume_url', 'is', null)
      .gte('updated_at', twentyFourHoursAgo.toISOString())
      .order('updated_at', { ascending: false });

    if (error) throw error;

    if (applicantsWithResume && applicantsWithResume.length > 0) {
      console.log(\`📄 Found \${applicantsWithResume.length} applicants with new resumes\`);

      for (const applicant of applicantsWithResume) {
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('data->>applicant_id', applicant.id)
          .eq('data->>notification_type', 'resume_uploaded')
          .eq('data->>resume_url', applicant.resume_url)
          .single();

        if (!existingNotification) {
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              user_id: adminUserId,
              title: 'Resume Uploaded',
              message: \`\${applicant.full_name || applicant.candidate} uploaded a resume for \${applicant.position} position\`,
              type: 'info',
              data: {
                source: 'recruitment',
                notification_type: 'resume_uploaded',
                applicant_id: applicant.id,
                applicant_name: applicant.full_name || applicant.candidate,
                position: applicant.position,
                resume_url: applicant.resume_url,
                timestamp: new Date().toISOString(),
              },
            });

          if (notificationError) {
            console.error('Error creating resume notification:', notificationError);
          } else {
            console.log(\`✅ Created resume notification for applicant \${applicant.id}\`);
          }
        }
      }
    } else {
      console.log('✅ No new resume uploads in last 24 hours');
    }
  } catch (error) {
    console.error('Error checking resume uploads:', error);
  }
}

async function checkStageChanges() {
  try {
    console.log('🔄 Checking for stage changes...');
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: stageChanges, error } = await supabase
      .from('recruitment_personnel')
      .select('*')
      .not('stage', 'is', null)
      .gte('updated_at', twentyFourHoursAgo.toISOString())
      .order('updated_at', { ascending: false });

    if (error) throw error;

    if (stageChanges && stageChanges.length > 0) {
      console.log(\`🔄 Found \${stageChanges.length} applicants with recent updates\`);

      for (const applicant of stageChanges) {
        const created = new Date(applicant.created_at);
        const updated = new Date(applicant.updated_at);
        const timeDifference = updated - created;

        if (timeDifference < 5 * 60 * 1000) {
          continue;
        }

        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('data->>applicant_id', applicant.id)
          .eq('data->>notification_type', 'stage_changed')
          .eq('data->>new_stage', applicant.stage)
          .gte('created_at', twentyFourHoursAgo.toISOString())
          .single();

        if (!existingNotification) {
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              user_id: adminUserId,
              title: 'Stage Updated',
              message: \`\${applicant.full_name || applicant.candidate} moved to \${applicant.stage} stage\`,
              type: 'info',
              data: {
                source: 'recruitment',
                notification_type: 'stage_changed',
                applicant_id: applicant.id,
                applicant_name: applicant.full_name || applicant.candidate,
                position: applicant.position,
                new_stage: applicant.stage,
                timestamp: new Date().toISOString(),
              },
            });

          if (notificationError) {
            console.error('Error creating stage change notification:', notificationError);
          } else {
            console.log(\`✅ Created stage change notification for applicant \${applicant.id}\`);
          }
        }
      }
    } else {
      console.log('✅ No stage changes in last 24 hours');
    }
  } catch (error) {
    console.error('Error checking stage changes:', error);
  }
}

async function checkStatusChanges() {
  try {
    console.log('📊 Checking for status changes...');
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: statusChanges, error } = await supabase
      .from('recruitment_personnel')
      .select('*')
      .not('status', 'is', null)
      .gte('updated_at', twentyFourHoursAgo.toISOString())
      .order('updated_at', { ascending: false });

    if (error) throw error;

    if (statusChanges && statusChanges.length > 0) {
      console.log(\`📊 Found \${statusChanges.length} applicants with status changes\`);

      for (const applicant of statusChanges) {
        const importantStatuses = ['Hired', 'Rejected', 'Offered'];
        if (importantStatuses.includes(applicant.status)) {
          const { data: existingNotification } = await supabase
            .from('notifications')
            .select('id')
            .eq('data->>applicant_id', applicant.id)
            .eq('data->>notification_type', 'status_changed')
            .eq('data->>new_status', applicant.status)
            .gte('created_at', twentyFourHoursAgo.toISOString())
            .single();

          if (!existingNotification) {
            const isPositive = applicant.status === 'Hired' || applicant.status === 'Offered';
            const { error: notificationError } = await supabase
              .from('notifications')
              .insert({
                user_id: adminUserId,
                title: 'Status Update',
                message: \`\${applicant.full_name || applicant.candidate} - \${applicant.status}\`,
                type: isPositive ? 'success' : 'warning',
                data: {
                  source: 'recruitment',
                  notification_type: 'status_changed',
                  applicant_id: applicant.id,
                  applicant_name: applicant.full_name || applicant.candidate,
                  position: applicant.position,
                  new_status: applicant.status,
                  timestamp: new Date().toISOString(),
                },
              });

            if (notificationError) {
              console.error('Error creating status notification:', notificationError);
            } else {
              console.log(\`✅ Created status notification for applicant \${applicant.id}\`);
            }
          }
        }
      }
    } else {
      console.log('✅ No important status changes in last 24 hours');
    }
  } catch (error) {
    console.error('Error checking status changes:', error);
  }
}

async function main() {
  console.log('🚀 Starting recruitment applicant check...');
  console.log('===============================');

  await checkNewResumeUploads();
  console.log('---');
  await checkStageChanges();
  console.log('---');
  await checkStatusChanges();

  console.log('===============================');
  console.log('✅ Recruitment applicant check completed');
}

main().catch(console.error);`,

  // 4. Daily Aggregator (ES Module)
  "daily-aggregator.js": `import { createClient } from '@supabase/supabase-js';

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

  // 5. Check Upcoming Inspections (ES Module)
  "check-upcoming-inspections.js": `import { createClient } from '@supabase/supabase-js';

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
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    const { data: inspectionsTomorrow, error: tomorrowError } = await supabase
      .from('inspections')
      .select('*')
      .eq('status', 'PENDING')
      .eq('schedule_inspection_date', tomorrowDate);

    if (tomorrowError) throw tomorrowError;

    if (inspectionsTomorrow && inspectionsTomorrow.length > 0) {
      console.log(\`📅 Found \${inspectionsTomorrow.length} inspections scheduled for tomorrow\`);
      
      for (const inspection of inspectionsTomorrow) {
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('data->>inspection_id', inspection.id)
          .eq('data->>reminder_type', 'tomorrow')
          .single();

        if (!existingNotification) {
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
};

// Write script files to correct location
Object.entries(scripts).forEach(([filename, content]) => {
  const filepath = `.github/workflows/scripts/${filename}`;
  fs.writeFileSync(filepath, content);
  console.log(`✅ Created: ${filepath}`);
});

// Create README
const readme = `# GitHub Workflow Scripts (ES Modules)

This folder contains ES Module scripts for GitHub Actions notifications.

## Available Scripts (ES Module format)

1. **check-pending-requests.js** - Checks leave requests
2. **quick-recruitment-check.js** - Hourly recruitment check
3. **check-applicant-updates.js** - Recruitment applicant updates
4. **daily-aggregator.js** - Daily summary
5. **check-upcoming-inspections.js** - Inspection reminders

## Note: ES Modules
These scripts use ES Module syntax (import/export) because the root package.json has "type": "module".

## GitHub Secrets Required:
1. SUPABASE_URL
2. SUPABASE_SERVICE_ROLE_KEY
3. ADMIN_USER_ID (default: 00000000-0000-0000-0000-000000000001)`;

fs.writeFileSync(".github/workflows/scripts/README.md", readme);
console.log("✅ Created: .github/workflows/scripts/README.md");

console.log("\n🎉 All ES Module workflow scripts created successfully!");
console.log("\n📝 Next steps:");
console.log("1. Delete old CommonJS scripts if they exist:");
console.log("   rm -rf .github/scripts/");
console.log("\n2. Update package.json scripts to point to correct location");
console.log("\n3. Test workflows on GitHub Actions!");
