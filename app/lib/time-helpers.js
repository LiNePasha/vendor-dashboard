/**
 * ⏰ Time & Attendance Helper Functions
 * All times are in Egypt timezone (Africa/Cairo - UTC+2)
 */

import { 
  differenceInMinutes, 
  differenceInHours,
  differenceInSeconds,
  format,
  parse,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
  endOfDay,
  addMinutes,
  subDays
} from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { ar } from 'date-fns/locale';

// Egypt timezone constant
export const TIMEZONE = 'Africa/Cairo';

// =====================================================
// 🕐 TIME FUNCTIONS
// =====================================================

/**
 * Get current time in Egypt timezone
 * @returns {Date} Current Egypt time
 */
export function getCurrentEgyptTime() {
  const now = new Date();
  return toZonedTime(now, TIMEZONE);
}

/**
 * Parse time string to Egypt Date object
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} timeString - Time in HH:mm:ss format
 * @returns {Date} Egypt time
 */
export function parseEgyptTime(dateString, timeString) {
  const combined = `${dateString} ${timeString}`;
  const date = parse(combined, 'yyyy-MM-dd HH:mm:ss', new Date());
  return toZonedTime(date, TIMEZONE);
}

/**
 * Format Egypt time to string
 * @param {Date} date - Date object
 * @param {string} formatStr - Format string (default: 'yyyy-MM-dd HH:mm:ss')
 * @returns {string} Formatted time string
 */
export function formatEgyptTime(date, formatStr = 'yyyy-MM-dd HH:mm:ss') {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.error('Invalid date passed to formatEgyptTime:', date);
    return '--';
  }
  return formatInTimeZone(date, TIMEZONE, formatStr);
}

/**
 * Format time to Arabic
 * @param {Date} date - Date object
 * @param {string} formatStr - Format string
 * @returns {string} Arabic formatted time
 */
export function formatArabicTime(date, formatStr = 'PPPp') {
  return formatInTimeZone(date, TIMEZONE, formatStr, { locale: ar });
}

/**
 * Get today's date in Egypt (YYYY-MM-DD)
 * @returns {string} Today's date
 */
export function getTodayEgypt() {
  return formatEgyptTime(getCurrentEgyptTime(), 'yyyy-MM-dd');
}

/**
 * Get current time only (HH:mm:ss)
 * @returns {string} Current time
 */
export function getCurrentTimeOnly() {
  return formatEgyptTime(getCurrentEgyptTime(), 'HH:mm:ss');
}

// =====================================================
// 📊 CALCULATION FUNCTIONS
// =====================================================

/**
 * Calculate difference in minutes between two times
 * @param {Date} time1 - Start time
 * @param {Date} time2 - End time
 * @returns {number} Minutes difference (absolute value)
 */
export function calculateMinutesDiff(time1, time2) {
  return Math.abs(differenceInMinutes(time2, time1));
}

/**
 * Calculate difference in hours (with decimals)
 * @param {Date} time1 - Start time
 * @param {Date} time2 - End time
 * @returns {number} Hours difference
 */
export function calculateHoursDiff(time1, time2) {
  const minutes = differenceInMinutes(time2, time1);
  return parseFloat((minutes / 60).toFixed(2));
}

/**
 * Calculate late minutes
 * @param {string} workStartTime - Expected start time (HH:mm)
 * @param {Date} actualCheckIn - Actual check-in time
 * @param {number} gracePeriod - Grace period in minutes (default: 15)
 * @returns {object} { late: boolean, lateMinutes: number }
 */
export function calculateLateMinutes(workStartTime, actualCheckIn, gracePeriod = 15) {
  const [hours, minutes] = workStartTime.split(':');
  const today = format(actualCheckIn, 'yyyy-MM-dd');
  
  // Expected start time
  const scheduledStart = parseEgyptTime(today, `${hours}:${minutes}:00`);
  
  // Start time + grace period
  const graceEnd = addMinutes(scheduledStart, gracePeriod);
  
  // If arrived after grace period
  if (isAfter(actualCheckIn, graceEnd)) {
    const lateMinutes = differenceInMinutes(actualCheckIn, scheduledStart);
    return {
      late: true,
      lateMinutes,
      gracePeriodUsed: gracePeriod
    };
  }
  
  // If arrived during grace period
  if (isAfter(actualCheckIn, scheduledStart)) {
    const used = differenceInMinutes(actualCheckIn, scheduledStart);
    return {
      late: false,
      lateMinutes: 0,
      gracePeriodUsed: used
    };
  }
  
  // On time or early
  return {
    late: false,
    lateMinutes: 0,
    gracePeriodUsed: 0
  };
}

/**
 * Calculate early leave minutes
 * @param {string} workEndTime - Expected end time (HH:mm)
 * @param {Date} actualCheckOut - Actual check-out time
 * @returns {object} { early: boolean, earlyMinutes: number }
 */
export function calculateEarlyMinutes(workEndTime, actualCheckOut) {
  const [hours, minutes] = workEndTime.split(':');
  const today = format(actualCheckOut, 'yyyy-MM-dd');
  
  const scheduledEnd = parseEgyptTime(today, `${hours}:${minutes}:00`);
  
  // If left before scheduled end time
  if (isBefore(actualCheckOut, scheduledEnd)) {
    return {
      early: true,
      earlyMinutes: differenceInMinutes(scheduledEnd, actualCheckOut)
    };
  }
  
  return {
    early: false,
    earlyMinutes: 0
  };
}

/**
 * Calculate overtime minutes
 * @param {string} workEndTime - Expected end time (HH:mm)
 * @param {Date} actualCheckOut - Actual check-out time
 * @returns {number} Overtime minutes
 */
export function calculateOvertimeMinutes(workEndTime, actualCheckOut) {
  const [hours, minutes] = workEndTime.split(':');
  const today = format(actualCheckOut, 'yyyy-MM-dd');
  
  const scheduledEnd = parseEgyptTime(today, `${hours}:${minutes}:00`);
  
  // If stayed after scheduled end time
  if (isAfter(actualCheckOut, scheduledEnd)) {
    return differenceInMinutes(actualCheckOut, scheduledEnd);
  }
  
  return 0;
}

/**
 * Calculate actual work hours
 * @param {Date} checkIn - Check-in time
 * @param {Date} checkOut - Check-out time
 * @returns {object} Work hours breakdown
 */
export function calculateActualWorkHours(checkIn, checkOut) {
  const totalMinutes = differenceInMinutes(checkOut, checkIn);
  const totalHours = parseFloat((totalMinutes / 60).toFixed(2));
  
  // Regular hours (max 8)
  const regularHours = Math.min(8, totalHours);
  
  // Overtime hours
  const overtimeHours = Math.max(0, parseFloat((totalHours - 8).toFixed(2)));
  
  return {
    totalMinutes,
    totalHours,
    regularHours: parseFloat(regularHours.toFixed(2)),
    overtimeMinutes: overtimeHours * 60,
    overtimeHours
  };
}

// =====================================================
// ✅ VALIDATION FUNCTIONS
// =====================================================

/**
 * Check if time is in the past
 * @param {Date} time - Time to check
 * @returns {boolean} True if in the past
 */
export function isInPast(time) {
  return isBefore(time, getCurrentEgyptTime());
}

/**
 * Check if date is today
 * @param {string} dateString - Date string (YYYY-MM-DD)
 * @returns {boolean} True if today
 */
export function isToday(dateString) {
  const date = parse(dateString, 'yyyy-MM-dd', new Date());
  return isSameDay(date, getCurrentEgyptTime());
}

/**
 * Get day name in English (lowercase)
 * @param {string} dateString - Date string (YYYY-MM-DD)
 * @returns {string} Day name (e.g., 'sunday', 'monday')
 */
export function getDayName(dateString) {
  const date = parse(dateString, 'yyyy-MM-dd', new Date());
  return format(date, 'EEEE').toLowerCase();
}

/**
 * Check if date is a work day for employee
 * @param {string} dateString - Date string (YYYY-MM-DD)
 * @param {Array} workDays - Array of work days (e.g., ['sunday', 'monday', ...])
 * @returns {boolean} True if work day
 */
export function isWorkDay(dateString, workDays) {
  const dayName = getDayName(dateString);
  return workDays.includes(dayName);
}

// =====================================================
// 🆔 ID GENERATION
// =====================================================

/**
 * Generate employee ID
 * @returns {string} Employee ID (e.g., EMP-001)
 */
export function generateEmployeeId() {
  const timestamp = Date.now().toString().slice(-6);
  return `EMP-${timestamp}`;
}

/**
 * Generate attendance ID
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {string} Attendance ID (e.g., ATT-20241115-001)
 */
export function generateAttendanceId(date) {
  const dateStr = date.replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ATT-${dateStr}-${random}`;
}

/**
 * Generate payroll ID
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (YYYY)
 * @returns {string} Payroll ID (e.g., PAY-202411-001)
 */
export function generatePayrollId(month, year) {
  const monthStr = month.toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PAY-${year}${monthStr}-${random}`;
}

/**
 * Generate advance ID
 * @returns {string} Advance ID (e.g., ADV-20241115-001)
 */
export function generateAdvanceId() {
  const dateStr = format(getCurrentEgyptTime(), 'yyyyMMdd');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ADV-${dateStr}-${random}`;
}

/**
 * Generate leave ID
 * @returns {string} Leave ID (e.g., LEAVE-20241115-001)
 */
export function generateLeaveId() {
  const dateStr = format(getCurrentEgyptTime(), 'yyyyMMdd');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `LEAVE-${dateStr}-${random}`;
}

// =====================================================
// 📅 DATE UTILITIES
// =====================================================

/**
 * Get month name in Arabic
 * @param {number} month - Month number (1-12)
 * @returns {string} Arabic month name
 */
export function getArabicMonth(month) {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  return months[month - 1];
}

/**
 * Get total work days in a month
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (YYYY)
 * @param {Array} workDays - Array of work days
 * @returns {number} Total work days
 */
export function getTotalWorkDays(month, year, workDays) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    if (isWorkDay(dateStr, workDays)) {
      count++;
    }
  }
  
  return count;
}

/**
 * Format time ago in Arabic
 * @param {string} dateString - ISO date string
 * @returns {string} Arabic time ago (e.g., "منذ 5 دقائق")
 */
export function getTimeAgo(dateString) {
  const date = new Date(dateString);
  const egyptDate = toZonedTime(date, TIMEZONE);
  const now = getCurrentEgyptTime();
  const seconds = Math.floor((now - egyptDate) / 1000);
  
  if (seconds < 60) return 'الآن';
  if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
  if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
  if (seconds < 604800) return `منذ ${Math.floor(seconds / 86400)} يوم`;
  
  return formatEgyptTime(egyptDate, 'dd/MM/yyyy');
}

/**
 * Convert minutes to hours and minutes format in Arabic
 * @param {number} totalMinutes - Total minutes
 * @returns {string} - Formatted string (e.g., "ساعة و10 دقائق" or "70 دقيقة")
 */
export function formatMinutesToArabic(totalMinutes) {
  if (!totalMinutes || totalMinutes < 60) {
    return `${totalMinutes || 0} دقيقة`;
  }
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (minutes === 0) {
    return hours === 1 ? 'ساعة' : `${hours} ساعة`;
  }
  
  const hoursText = hours === 1 ? 'ساعة' : `${hours} ساعة`;
  return `${hoursText} و${minutes} دقيقة`;
}

export default {
  // Time functions
  getCurrentEgyptTime,
  parseEgyptTime,
  formatEgyptTime,
  formatArabicTime,
  getTodayEgypt,
  getCurrentTimeOnly,
  
  // Calculations
  calculateMinutesDiff,
  calculateHoursDiff,
  calculateLateMinutes,
  calculateEarlyMinutes,
  calculateOvertimeMinutes,
  calculateActualWorkHours,
  
  // Validation
  isInPast,
  isToday,
  getDayName,
  isWorkDay,
  
  // ID Generation
  generateEmployeeId,
  generateAttendanceId,
  generatePayrollId,
  generateAdvanceId,
  generateLeaveId,
  
  // Date utilities
  getArabicMonth,
  getTotalWorkDays,
  getTimeAgo,
  formatMinutesToArabic,
  
  // Constants
  TIMEZONE
};
