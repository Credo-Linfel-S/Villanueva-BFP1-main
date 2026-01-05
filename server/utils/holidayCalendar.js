// server/utils/holidayCalendar.js
const HOLIDAY_API = "https://date.nager.at/api/v3/PublicHolidays";

// Get Philippine holidays for a specific year
async function getPhilippineHolidays(year) {
  try {
    const response = await fetch(`${HOLIDAY_API}/${year}/PH`);
    if (!response.ok) throw new Error("Failed to fetch holidays");
    const holidays = await response.json();

    return holidays.map((holiday) => ({
      date: holiday.date,
      name: holiday.name,
      type: holiday.type,
      localName: holiday.localName || holiday.name,
    }));
  } catch (error) {
    console.error("Error fetching holidays:", error);
    // Return fallback holidays
    return getFallbackHolidays(year);
  }
}

// Fallback holidays in case API fails
function getFallbackHolidays(year) {
  // Common Philippine holidays (fallback)
  return [
    {
      date: `${year}-01-01`,
      name: "New Year's Day",
      localName: "Araw ng Bagong Taon",
    },
    {
      date: `${year}-04-09`,
      name: "Day of Valor",
      localName: "Araw ng Kagitingan",
    },
    {
      date: `${year}-04-18`,
      name: "Maundy Thursday",
      localName: "Huwebes Santo",
    },
    { date: `${year}-04-19`, name: "Good Friday", localName: "Biyernes Santo" },
    { date: `${year}-05-01`, name: "Labor Day", localName: "Araw ng Paggawa" },
    {
      date: `${year}-06-12`,
      name: "Independence Day",
      localName: "Araw ng Kalayaan",
    },
    {
      date: `${year}-08-21`,
      name: "Ninoy Aquino Day",
      localName: "Araw ni Ninoy Aquino",
    },
    {
      date: `${year}-08-26`,
      name: "National Heroes Day",
      localName: "Araw ng mga Bayani",
    },
    { date: `${year}-11-01`, name: "All Saints' Day", localName: "Undas" },
    {
      date: `${year}-11-02`,
      name: "All Souls' Day",
      localName: "Araw ng mga Patay",
    },
    {
      date: `${year}-11-30`,
      name: "Bonifacio Day",
      localName: "Araw ni Bonifacio",
    },
    {
      date: `${year}-12-08`,
      name: "Feast of the Immaculate Conception",
      localName: "Pista ng Kalinis-linisang Paglilihi",
    },
    {
      date: `${year}-12-25`,
      name: "Christmas Day",
      localName: "Araw ng Pasko",
    },
    { date: `${year}-12-30`, name: "Rizal Day", localName: "Araw ni Rizal" },
    {
      date: `${year}-12-31`,
      name: "New Year's Eve",
      localName: "Bisperas ng Bagong Taon",
    },
  ];
}

// Calculate working days excluding weekends and holidays
function calculateWorkingDays(startDate, endDate, holidays = []) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let workingDays = 0;
  let current = new Date(start);

  const holidayDates = holidays.map((h) => new Date(h.date).toDateString());

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateString = current.toDateString();

    // Check if it's a weekend (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Check if it's a holiday
      if (!holidayDates.includes(dateString)) {
        workingDays++;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

// Get holiday name for a specific date
function getHolidayName(date, holidays) {
  const dateString = new Date(date).toISOString().split("T")[0];
  const holiday = holidays.find((h) => h.date === dateString);
  return holiday ? holiday.localName : null;
}

// Check if a specific date is a holiday
function isHoliday(date, holidays) {
  const dateString = new Date(date).toISOString().split("T")[0];
  return holidays.some((h) => h.date === dateString);
}

// Check if a specific date is a weekend
function isWeekend(date) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}

module.exports = {
  getPhilippineHolidays,
  calculateWorkingDays,
  getHolidayName,
  isHoliday,
  isWeekend,
  getFallbackHolidays,
};
