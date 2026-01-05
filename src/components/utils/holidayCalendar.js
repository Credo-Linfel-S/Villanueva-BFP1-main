// src/utils/holidayCalculator.js (client-side)
const HOLIDAY_API = 'https://date.nager.at/api/v3/PublicHolidays';

// Get Philippine holidays for a specific year
export async function getPhilippineHolidays(year) {
  try {
    const response = await fetch(`${HOLIDAY_API}/${year}/PH`);
    if (!response.ok) throw new Error('Failed to fetch holidays');
    const holidays = await response.json();
    
    return holidays.map(holiday => ({
      date: holiday.date,
      name: holiday.name,
      type: holiday.type,
      localName: holiday.localName || holiday.name
    }));
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return getFallbackHolidays(year);
  }
}

// Calculate working days excluding weekends and holidays
export function calculateWorkingDays(startDate, endDate, holidays = []) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let workingDays = 0;
  let current = new Date(start);
  
  const holidayDates = holidays.map(h => new Date(h.date).toDateString());
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateString = current.toDateString();
    
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      if (!holidayDates.includes(dateString)) {
        workingDays++;
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
}

// Fallback holidays
function getFallbackHolidays(year) {
  return [
    { date: `${year}-01-01`, name: "New Year's Day", localName: "Araw ng Bagong Taon" },
    { date: `${year}-04-09`, name: "Day of Valor", localName: "Araw ng Kagitingan" },
    { date: `${year}-05-01`, name: "Labor Day", localName: "Araw ng Paggawa" },
    { date: `${year}-06-12`, name: "Independence Day", localName: "Araw ng Kalayaan" },
    { date: `${year}-08-21`, name: "Ninoy Aquino Day", localName: "Araw ni Ninoy Aquino" },
    { date: `${year}-08-26`, name: "National Heroes Day", localName: "Araw ng mga Bayani" },
    { date: `${year}-11-01`, name: "All Saints' Day", localName: "Undas" },
    { date: `${year}-11-30`, name: "Bonifacio Day", localName: "Araw ni Bonifacio" },
    { date: `${year}-12-25`, name: "Christmas Day", localName: "Araw ng Pasko" },
    { date: `${year}-12-30`, name: "Rizal Day", localName: "Araw ni Rizal" },
  ];
}

// Helper function to calculate calendar days
export function calculateCalendarDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeDiff = end - start;
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;
}

// Simple calculator class for React component
export class LeaveCalculator {
  constructor(holidays) {
    this.holidays = holidays || [];
  }

  calculateWorkingDays(startDate, endDate) {
    return calculateWorkingDays(startDate, endDate, this.holidays);
  }

  calculateCalendarDays(startDate, endDate) {
    return calculateCalendarDays(startDate, endDate);
  }

  calculateLeaveBreakdown(request, availableBalance) {
    const totalCalendarDays = this.calculateCalendarDays(request.startDate, request.endDate);
    const workingDays = this.calculateWorkingDays(request.startDate, request.endDate);
    const holidayDays = totalCalendarDays - workingDays;
    
    if (request.approveFor === 'with_pay') {
      const paidDays = Math.min(workingDays, availableBalance);
      const unpaidDays = Math.max(0, workingDays - availableBalance);
      
      return {
        totalWorkingDays: workingDays,
        holidayDays,
        paidDays,
        unpaidDays,
        requiresApproval: unpaidDays > 0
      };
    } else if (request.approveFor === 'without_pay') {
      return {
        totalWorkingDays: workingDays,
        holidayDays,
        paidDays: 0,
        unpaidDays: workingDays,
        requiresApproval: true
      };
    } else if (request.approveFor === 'both') {
      const requestedDays = workingDays;
      const maxWithPay = Math.min(requestedDays, availableBalance);
      const withPay = request.withPayDays || maxWithPay;
      const withoutPay = requestedDays - withPay;
      
      return {
        totalWorkingDays: workingDays,
        holidayDays,
        paidDays: withPay,
        unpaidDays: withoutPay,
        requiresApproval: true
      };
    }
    
    return {
      totalWorkingDays: workingDays,
      holidayDays,
      paidDays: 0,
      unpaidDays: 0,
      requiresApproval: false
    };
  }
}