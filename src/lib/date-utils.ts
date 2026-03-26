import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'Asia/Dhaka';

/**
 * Formats a date to Bangladesh Time (GMT+6) string.
 * @param date The date to format (UTC or Date object)
 * @param formatStr date-fns format string (default: 'dd-MMM-yyyy HH:mm:ss')
 */
export function formatBDT(date: Date | string | number | null | undefined, formatStr: string = 'dd-MMM-yyyy HH:mm:ss'): string {
  if (!date) return '---';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return formatInTimeZone(d, TIMEZONE, formatStr);
  } catch (e) {
    console.error('Error formatting BDT date:', e);
    return 'Invalid Date';
  }
}

/**
 * Returns the current date/time in Bangladesh Time.
 */
export function nowBDT(): Date {
  // Note: JavaScript Date objects are fundamentally UTC. 
  // This just returns the current global now.
  return new Date();
}
