import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";

interface StaffSchedule {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  break_start?: string | null;
  break_end?: string | null;
  break_notes?: string | null;
}

interface StaffTimeOff {
  id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
}

interface StaffEarlyDeparture {
  id: string;
  staff_id: string;
  date: string;
  departure_time: string;
  reason?: string | null;
}

interface StaffAvailabilityResult {
  schedules: StaffSchedule[];
  timeOff: StaffTimeOff[];
  earlyDepartures: StaffEarlyDeparture[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook para consultar disponibilidad del staff de forma eficiente
 * Consulta staff_schedules, staff_time_off y staff_early_departures en paralelo
 */
export function useStaffAvailability(
  staffId: string | null,
  selectedDate: Date | null,
  businessId: string | null
) {
  const [result, setResult] = useState<StaffAvailabilityResult>({
    schedules: [],
    timeOff: [],
    earlyDepartures: [],
    isLoading: false,
    error: null,
  });

  const fetchAvailability = useCallback(async () => {
    if (!staffId || !selectedDate || !businessId) {
      setResult({
        schedules: [],
        timeOff: [],
        earlyDepartures: [],
        isLoading: false,
        error: null,
      });
      return;
    }

    setResult((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const dayOfWeek = selectedDate.getDay();
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Consultar las 3 tablas en paralelo usando Promise.all
      const [schedulesResult, timeOffResult, earlyDeparturesResult] = await Promise.all([
        // 1. Consultar staff_schedules para el día de la semana
        supabase
          .from("staff_schedules")
          .select("*")
          .eq("staff_id", staffId)
          .eq("day_of_week", dayOfWeek)
          .eq("is_available", true),

        // 2. Consultar staff_time_off para verificar si está de vacaciones/descanso
        supabase
          .from("staff_time_off")
          .select("*")
          .eq("staff_id", staffId)
          .lte("start_date", dateStr)
          .gte("end_date", dateStr),

        // 3. Consultar staff_early_departures para salidas anticipadas
        supabase
          .from("staff_early_departures")
          .select("*")
          .eq("staff_id", staffId)
          .eq("date", dateStr),
      ]);

      if (schedulesResult.error) throw schedulesResult.error;
      if (timeOffResult.error) throw timeOffResult.error;
      if (earlyDeparturesResult.error) throw earlyDeparturesResult.error;

      setResult({
        schedules: (schedulesResult.data || []) as StaffSchedule[],
        timeOff: (timeOffResult.data || []) as StaffTimeOff[],
        earlyDepartures: (earlyDeparturesResult.data || []) as StaffEarlyDeparture[],
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching staff availability:", error);
      setResult((prev) => ({
        ...prev,
        isLoading: false,
        error: error as Error,
      }));
    }
  }, [staffId, selectedDate, businessId]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  return {
    ...result,
    refetch: fetchAvailability,
  };
}

/**
 * Verificar si un staff puede realizar un servicio específico
 */
export async function checkStaffService(
  staffId: string,
  serviceId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("staff_services")
    .select("staff_id")
    .eq("staff_id", staffId)
    .eq("service_id", serviceId)
    .maybeSingle();

  if (error) {
    console.error("Error checking staff service:", error);
    return false;
  }

  // Si no hay registro en staff_services, asumimos que el staff puede hacer todos los servicios
  // Si hay registro, significa que está restringido y solo puede hacer los servicios listados
  // Por ahora, retornamos true si existe el registro (el staff puede hacer el servicio)
  return !!data;
}

