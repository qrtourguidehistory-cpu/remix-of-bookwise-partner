/**
 * Format time according to user's locale settings
 * @param time24 - Time in 24-hour format (HH:MM:SS or HH:MM)
 * @param timeFormat - User's preferred format ('12h' or '24h')
 * @returns Formatted time string
 */
export const formatTime = (time24: string, timeFormat: '12h' | '24h' = '12h'): string => {
  if (!time24) return '';
  
  const [hours, minutes] = time24.split(':').map(str => parseInt(str, 10));
  
  if (timeFormat === '24h') {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  
  // Convert to 12-hour format
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${String(minutes).padStart(2, '0')}${period}`;
};

/**
 * Convert 12-hour format to 24-hour format
 * @param time12h - Time in 12-hour format (e.g., "2:30pm")
 * @returns Time in 24-hour format (HH:MM:SS)
 */
export const convertTo24Hour = (time12h: string): string => {
  const match = time12h.match(/(\d+):(\d+)\s*(am|pm)/i);
  if (!match) return time12h;
  
  const [, hoursStr, minutesStr, period] = match;
  let hours = parseInt(hoursStr, 10);
  const minutes = minutesStr;
  
  if (period.toLowerCase() === 'pm' && hours !== 12) {
    hours += 12;
  } else if (period.toLowerCase() === 'am' && hours === 12) {
    hours = 0;
  }
  
  return `${String(hours).padStart(2, '0')}:${minutes}:00`;
};

/**
 * Generate time slots based on user's time format preference
 * @param timeFormat - User's preferred format ('12h' or '24h')
 * @returns Array of time slot strings
 */
export const generateTimeSlots = (timeFormat: '12h' | '24h' = '12h'): string[] => {
  const slots: string[] = [];
  
  for (let hour = 7; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time24 = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
      slots.push(formatTime(time24, timeFormat));
    }
  }
  
  return slots;
};

/**
 * Generate time slots based on business hours
 * @param startTime - Business opening time in 24h format (HH:MM)
 * @param endTime - Business closing time in 24h format (HH:MM)
 * @param timeFormat - User's preferred format ('12h' or '24h')
 * @param intervalMinutes - Interval between slots (default: 30)
 * @returns Array of time slot strings
 */
export const generateTimeSlotsFromBusinessHours = (
  startTime: string,
  endTime: string,
  timeFormat: '12h' | '24h' = '12h',
  intervalMinutes: number = 30
): string[] => {
  const slots: string[] = [];
  
  // Parse start and end times
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startTotalMinutes = startHour * 60 + startMin;
  const endTotalMinutes = endHour * 60 + endMin;
  
  // Generate slots from start to end
  for (let totalMinutes = startTotalMinutes; totalMinutes < endTotalMinutes; totalMinutes += intervalMinutes) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const time24 = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    slots.push(formatTime(time24, timeFormat));
  }
  
  return slots;
};