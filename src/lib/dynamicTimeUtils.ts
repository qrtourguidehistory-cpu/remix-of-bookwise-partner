/**
 * Dynamic time utilities for calendar rendering
 * These functions support appointments at any time (not just 30-minute slots)
 */

/**
 * Parse time string (HH:MM:SS or HH:MM) to total minutes from midnight
 */
export const parseTimeToMinutes = (time: string): number => {
  if (!time) return 0;
  const parts = time.split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
};

/**
 * Convert minutes from midnight to time string (HH:MM)
 */
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Calculate end time from start time and duration
 */
export const calculateEndTime = (startTime: string, durationMinutes: number): string => {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;
  return minutesToTime(endMinutes);
};

/**
 * Check if two time intervals overlap
 * @param start1 - Start time of first interval (HH:MM)
 * @param end1 - End time of first interval (HH:MM)
 * @param start2 - Start time of second interval (HH:MM)
 * @param end2 - End time of second interval (HH:MM)
 */
export const intervalsOverlap = (
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean => {
  const s1 = parseTimeToMinutes(start1);
  const e1 = parseTimeToMinutes(end1);
  const s2 = parseTimeToMinutes(start2);
  const e2 = parseTimeToMinutes(end2);
  
  // Overlap if: start1 < end2 AND start2 < end1
  return s1 < e2 && s2 < e1;
};

/**
 * Check if a time interval conflicts with any existing appointments
 * @param startTime - Start time of new appointment (HH:MM)
 * @param endTime - End time of new appointment (HH:MM)
 * @param existingAppointments - Array of existing appointments with start_time and end_time
 * @param staffId - Optional staff ID to filter by
 * @param businessId - Business ID (used if no staff)
 */
export const hasTimeConflict = (
  startTime: string,
  endTime: string,
  existingAppointments: Array<{
    start_time: string;
    end_time: string;
    staff_id?: string | null;
    status?: string;
  }>,
  staffId?: string | null,
  businessId?: string
): boolean => {
  const activeStatuses = ['pending', 'confirmed', 'started', 'completed'];
  
  const relevantAppointments = existingAppointments.filter(apt => {
    // Only check active appointments
    if (!apt.status || !activeStatuses.includes(apt.status)) return false;
    
    // If staffId is provided, only check appointments for that staff
    // If no staffId, check all appointments (for businesses without staff)
    if (staffId) {
      return apt.staff_id === staffId;
    }
    // If no staff, all appointments block the business owner
    return !apt.staff_id || apt.staff_id === null;
  });
  
  return relevantAppointments.some(apt => {
    return intervalsOverlap(startTime, endTime, apt.start_time, apt.end_time);
  });
};

/**
 * Generate a continuous timeline for a day
 * @param startHour - Hour to start (0-23)
 * @param endHour - Hour to end (0-24). Use 24 to include the final slot (end is inclusive) to ensure the last interval is rendered in clients such as Android WebView.
 * @param intervalMinutes - Interval for visual grid (default: 15 for finer granularity)
 * @returns Array of minute values from start to end
 */
export const generateTimelineMinutes = (
  startHour: number = 7,
  endHour: number = 23,
  intervalMinutes: number = 15
): number[] => {
  const minutes: number[] = [];
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  
  for (let m = startMinutes; m <= endMinutes; m += intervalMinutes) {
    minutes.push(m);
  }
  
  return minutes;
};

/**
 * Calculate position (in pixels or percentage) for an appointment
 * @param appointmentStartTime - Start time of appointment (HH:MM)
 * @param dayStartMinutes - Minutes from midnight when day starts (e.g., 7*60 = 420 for 7:00 AM)
 * @param dayEndMinutes - Minutes from midnight when day ends
 * @param containerHeight - Total height of container in pixels
 * @returns Object with top position and height in pixels
 */
export const calculateAppointmentPosition = (
  appointmentStartTime: string,
  appointmentEndTime: string,
  dayStartMinutes: number,
  dayEndMinutes: number,
  containerHeight: number
): { top: number; height: number } => {
  const startMinutes = parseTimeToMinutes(appointmentStartTime);
  const endMinutes = parseTimeToMinutes(appointmentEndTime);
  
  const dayDuration = dayEndMinutes - dayStartMinutes;
  const appointmentStartOffset = startMinutes - dayStartMinutes;
  const appointmentDuration = endMinutes - startMinutes;
  
  const top = (appointmentStartOffset / dayDuration) * containerHeight;
  const height = (appointmentDuration / dayDuration) * containerHeight;
  
  return {
    top: Math.max(0, top),
    height: Math.max(20, height), // Minimum 20px height
  };
};

/**
 * Get all appointments that overlap with a time range
 * @param appointments - Array of appointments
 * @param startTime - Start of time range (HH:MM)
 * @param endTime - End of time range (HH:MM)
 * @param staffId - Optional staff ID to filter
 */
export const getAppointmentsInRange = (
  appointments: Array<{
    start_time: string;
    end_time: string;
    staff_id?: string | null;
    [key: string]: any;
  }>,
  startTime: string,
  endTime: string,
  staffId?: string | null
): any[] => {
  return appointments.filter(apt => {
    if (staffId && apt.staff_id !== staffId) return false;
    if (!staffId && apt.staff_id) return false; // If no staffId, only show appointments without staff
    
    return intervalsOverlap(startTime, endTime, apt.start_time, apt.end_time);
  });
};

/**
 * Calculate layout for overlapping appointments
 * Only appointments that overlap in time are split into columns.
 * Non-overlapping appointments keep full width.
 * @param appointments - Array of appointments with start_time and end_time
 * @returns Array of appointments with layout info (left, width, column, totalColumns)
 */
export const calculateOverlappingLayout = (
  appointments: Array<{
    start_time: string;
    end_time: string;
    [key: string]: any;
  }>
): Array<{
  appointment: any;
  left: number; // Percentage (0-100)
  width: number; // Percentage (0-100)
  column: number; // Column index (0-based)
  totalColumns: number; // Total columns in this overlap group
}> => {
  if (appointments.length === 0) return [];

  type AptWithRange = { appointment: any; startMin: number; endMin: number };

  // Normalize and sort by start time (then end)
  const sorted: AptWithRange[] = [...appointments]
    .map((apt) => {
      const startMin = parseTimeToMinutes(apt.start_time);
      const endMin = parseTimeToMinutes(apt.end_time || calculateEndTime(apt.start_time, 30));
      return { appointment: apt, startMin, endMin };
    })
    .sort((a, b) => (a.startMin !== b.startMin ? a.startMin - b.startMin : a.endMin - b.endMin));

  // Build overlap clusters (connected components in interval graph)
  const clusters: AptWithRange[][] = [];
  let current: AptWithRange[] = [];
  let currentMaxEnd = -Infinity;

  for (const item of sorted) {
    if (current.length === 0) {
      current = [item];
      currentMaxEnd = item.endMin;
      continue;
    }

    // Overlaps cluster if starts before the latest end in the cluster
    if (item.startMin < currentMaxEnd) {
      current.push(item);
      currentMaxEnd = Math.max(currentMaxEnd, item.endMin);
    } else {
      clusters.push(current);
      current = [item];
      currentMaxEnd = item.endMin;
    }
  }
  if (current.length > 0) clusters.push(current);

  // Assign columns within each cluster and compute width/left for that cluster only
  const result: Array<{
    appointment: any;
    left: number;
    width: number;
    column: number;
    totalColumns: number;
  }> = [];

  // ✅ MEJORADO: Gap más visible y ancho mínimo para citas legibles
  const GAP_PERCENT = 2; // Gap más visible entre columnas (2%)
  const MIN_WIDTH_PERCENT = 30; // Ancho mínimo por cita (30% para mantener legibilidad)

  for (const cluster of clusters) {
    // Greedy column assignment for interval graphs
    const columnsEnd: number[] = [];
    const assignments: Array<{ appointment: any; column: number }> = [];

    const clusterSorted = [...cluster].sort((a, b) => (a.startMin !== b.startMin ? a.startMin - b.startMin : a.endMin - b.endMin));

    for (const { appointment, startMin, endMin } of clusterSorted) {
      let assigned = -1;
      for (let c = 0; c < columnsEnd.length; c++) {
        if (columnsEnd[c] <= startMin) {
          assigned = c;
          break;
        }
      }
      if (assigned === -1) {
        assigned = columnsEnd.length;
        columnsEnd.push(endMin);
      } else {
        columnsEnd[assigned] = endMin;
      }
      assignments.push({ appointment, column: assigned });
    }

    const totalColumns = Math.max(1, columnsEnd.length);
    const totalGaps = totalColumns > 1 ? (totalColumns - 1) * GAP_PERCENT : 0;
    const available = 100 - totalGaps;
    
    // ✅ MEJORADO: Calcular ancho asegurando mínimo legible
    let width = totalColumns === 1 ? 98 : available / totalColumns;
    
    // Si el ancho calculado es menor al mínimo, ajustar
    if (width < MIN_WIDTH_PERCENT && totalColumns > 1) {
      // Recalcular con ancho mínimo garantizado
      const minTotalWidth = MIN_WIDTH_PERCENT * totalColumns;
      const minTotalGaps = (totalColumns - 1) * GAP_PERCENT;
      const requiredWidth = minTotalWidth + minTotalGaps;
      
      if (requiredWidth <= 100) {
        width = MIN_WIDTH_PERCENT;
      } else {
        // Si no cabe con mínimo, usar el máximo posible manteniendo gap
        width = Math.max(MIN_WIDTH_PERCENT * 0.8, available / totalColumns);
      }
    }

    for (const { appointment, column } of assignments) {
      const left = column * (width + GAP_PERCENT);
      result.push({ appointment, left, width, column, totalColumns });
    }
  }

  return result;
};

