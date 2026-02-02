import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { format, addDays } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { AppointmentDialog } from "./AppointmentDialog";
import { AppointmentDetailView } from "./AppointmentDetailView";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import { toast } from "sonner";
import { FilterState } from "./CalendarHeader";
import { formatTime, convertTo24Hour } from "@/lib/timeFormat";
import { useOptimizedAppointmentsRealtime } from "@/hooks/useOptimizedRealtime";
import { useAppointmentCache } from "@/hooks/useAppointmentCache";
import { useLanguage } from "@/contexts/LanguageContext";
import { notifyNextClientWhenAppointmentStarted, notifyNextClientWhenAppointmentCompleted } from "@/lib/queueNotifications";
import { useAppointmentColor } from "@/hooks/useAppointmentColor";
import { 
  parseTimeToMinutes, 
  minutesToTime, 
  calculateEndTime as calcEndTime,
  calculateAppointmentPosition,
  generateTimelineMinutes,
  hasTimeConflict,
  calculateOverlappingLayout
} from "@/lib/dynamicTimeUtils";

// Generate a unique color for each staff member based on their ID
const getStaffColor = (staffId: string | null | undefined): string => {
  const colors = [
    "hsl(var(--primary))",
    "hsl(220, 70%, 50%)", // blue
    "hsl(160, 70%, 45%)", // teal
    "hsl(280, 70%, 55%)", // purple
    "hsl(30, 80%, 55%)", // orange
    "hsl(340, 75%, 55%)", // pink
  ];
  
  // If staffId is null or undefined, return default color
  if (!staffId) {
    return colors[0];
  }
  
  // Simple hash function to get consistent color per staff
  let hash = 0;
  for (let i = 0; i < staffId.length; i++) {
    hash = staffId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Get status badge info
const getStatusInfo = (status: string) => {
  switch (status) {
    case 'confirmed':
      return { color: '#3b82f6', label: 'Confirmada' }; // Blue for confirmed
    case 'started':
      return { color: '#8b5cf6', label: 'Iniciada' }; // Purple for started
    case 'completed':
      return { color: '#22c55e', label: 'Completada' }; // Green for completed
    case 'cancelled':
      return { color: '#ef4444', label: 'Cancelada' };
    case 'no_show':
      return { color: '#6b7280', label: 'No Asistió' };
    default:
      return { color: '#f59e0b', label: 'Pendiente' };
  }
};

interface DayViewProps {
  date: Date;
  filters: FilterState;
  appointmentToOpen?: string | null;
  onAppointmentOpened?: () => void;
}

export function DayView({ date, filters, appointmentToOpen, onAppointmentOpened }: DayViewProps) {
  const { profile, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const [appointments, setAppointments] = useState<any[]>([]);
  // If profile has no business_id, try to refresh once (helps with stale localStorage/session cases)
  useEffect(() => {
    if (!profile?.business_id) {
      refreshProfile?.();
    }
  }, [profile?.business_id, refreshProfile]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedAppointment, setDraggedAppointment] = useState<any>(null);
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [businessHours, setBusinessHours] = useState<any>(null);
  const SLOT_MINUTES = 30; // 30-minute intervals
  const SLOT_HEIGHT = 60; // px per 30-minute slot (fixed)

  const minTime = '07:00';
  const maxTime = '24:00';

  const [timelineStartMinutes, setTimelineStartMinutes] = useState<number>(7 * 60); // 7:00 AM default
  const [timelineEndMinutes, setTimelineEndMinutes] = useState<number>(24 * 60); // 24:00 default (inclusive end)
  const [pixelsPerHour, setPixelsPerHour] = useState<number>(SLOT_HEIGHT * 2); // derived from SLOT_HEIGHT (fixed 30-min slot height)

  // Force recalculation after render to work around Android WebView clipping of last pixels
  useEffect(() => {
    const timer = setTimeout(() => {
      const c = scrollContainerRef.current as any;
      if (!c) return;
      // If the calendar implementation exposes refresh(), call it
      try {
        c?.refresh?.();
        c?.recalculate?.();
      } catch (e) {
        // ignore
      }
      // Force browser reflow as backup
      const prev = c.style.display;
      c.style.display = 'none';
      // Force layout read
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      c.offsetHeight;
      c.style.display = prev || '';
    }, 300);
    return () => clearTimeout(timer);
  }, [timelineStartMinutes, timelineEndMinutes]);

  // Single ref for the shared scroll container (both time labels and timeline scroll together)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // OPTIMIZACIÓN: Usar caché de consultas
  const { generateCacheKey, getCached, setCached, invalidateCache } = useAppointmentCache();

  const fetchAppointments = useCallback(async (bypassCache: boolean = false) => {
    if (!profile?.business_id) {
      return;
    }
    
    // OPTIMIZACIÓN: Verificar caché primero (solo si no se está forzando el bypass)
    const cacheKey = generateCacheKey('day', date, filters);
    if (!bypassCache) {
      const cachedData = getCached(cacheKey);
      if (cachedData) {
        setAppointments(cachedData);
        return;
      }
    } else {
      // Si se está forzando el bypass, invalidar el caché primero
      invalidateCache('day');
    }
    
    const dateStr = format(date, "yyyy-MM-dd");
    const nextDateStr = format(addDays(date, 1), "yyyy-MM-dd");
    
    // OPTIMIZACIÓN: Solo seleccionar columnas necesarias
    // ✅ FIX: Incluir client_name, guest_name y user_id para mostrar nombres cuando client_id es NULL
    let query = supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        start_time,
        end_time,
        status,
        service_id,
        staff_id,
        client_id,
        user_id,
        client_name,
        guest_name,
        payment_method,
        payment_amount,
        clients!appointments_client_id_fkey(id, full_name, email, phone),
        services!appointments_service_id_fkey(name, duration_minutes, price, price_usd),
        staff!appointments_staff_id_fkey(full_name)
      `)
      .eq("business_id", profile.business_id)
      .gte("appointment_date", dateStr)
      .lt("appointment_date", nextDateStr)
      .order("start_time");

    // Apply filters
    if (filters.statuses.length > 0) {
      query = query.in("status", filters.statuses as readonly ("pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "started" | "arrived")[]);
    }
    if (filters.staffIds.length > 0) {
      query = query.in("staff_id", filters.staffIds);
    }
    if (filters.serviceIds.length > 0) {
      query = query.in("service_id", filters.serviceIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching appointments (day view):", error);
      toast.error(language === "es" ? "No se pudieron cargar las citas" : "Couldn't load appointments");
      setAppointments([]);
      return;
    }

    if (!error && data) {
      // ✅ FIX: Si data existe pero clients está vacío, hacer consulta directa como fallback
      let enrichedData = data;
      if (data.length > 0 && profile?.business_id) {
        const appointmentsNeedingClientData = data.filter(
          (apt) => !apt.clients && apt.client_id
        );

        if (appointmentsNeedingClientData.length > 0) {
          console.log(
            `🔍 [DayView] ${appointmentsNeedingClientData.length} citas sin datos de cliente, consultando directamente...`
          );

          // Consultar clientes directamente
          const clientIds = appointmentsNeedingClientData
            .map((apt) => apt.client_id)
            .filter((id): id is string => Boolean(id));

          if (clientIds.length > 0) {
            const { data: clientsData, error: clientsError } = await supabase
              .from("clients")
              .select("id, user_id, full_name, email, phone")
              .eq("business_id", profile.business_id)
              .in("id", clientIds);

            if (clientsError) {
              console.error("Error fetching clients directly:", clientsError);
            } else if (clientsData) {
              // Crear un mapa de client_id -> client data
              const clientsMap = new Map(
                clientsData.map((client) => [client.id, client])
              );

              // Enriquecer appointments con datos de clientes
              enrichedData = data.map((apt) => {
                if (!apt.clients && apt.client_id) {
                  const clientData = clientsMap.get(apt.client_id);
                  if (clientData) {
                    return { ...apt, clients: clientData };
                  }
                }
                return apt;
              });

              console.log(
                `✅ [DayView] Enriquecidos ${clientsData.length} clientes en citas`
              );
            }
          }
        }

        // Log diagnóstico
        const appointmentsWithClients = enrichedData.filter(
          (apt) => apt.clients
        ).length;
        const appointmentsWithoutClients = enrichedData.filter(
          (apt) => !apt.clients && apt.client_id
        ).length;
        console.log(
          `📊 [DayView] Diagnóstico: ${appointmentsWithClients} con cliente, ${appointmentsWithoutClients} sin cliente (pero con client_id), total: ${enrichedData.length}`
        );
      }

      // Apply search filter on client side (for related data)
      let filteredData = enrichedData;
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        filteredData = enrichedData.filter(apt => {
          // ✅ PRIORIDAD ESTRICTA: Buscar en client_name primero (sin fallback si existe)
          const clientName = ((apt.client_name && apt.client_name.trim()) 
            ? apt.client_name.trim() 
            : (apt.guest_name && apt.guest_name.trim())
            ? apt.guest_name.trim()
            : apt.clients?.full_name || '').toLowerCase();
          const serviceName = (apt.services?.name || '').toLowerCase();
          const staffName = (apt.staff?.full_name || '').toLowerCase();
          return clientName.includes(searchLower) ||
                 serviceName.includes(searchLower) ||
                 staffName.includes(searchLower);
        });
      }
      setAppointments(filteredData);
      // OPTIMIZACIÓN: Guardar en caché
      setCached(cacheKey, filteredData, filters);
    } else {
      setAppointments([]);
    }
  }, [date, filters, profile?.business_id, generateCacheKey, getCached, setCached, invalidateCache, language]);

  // ✅ OPTIMIZADO: Callback envuelto en useCallback para evitar re-suscripciones
  const handleRealtimeUpdate = useCallback(() => {
    console.log('🔄 [DayView] Actualización en tiempo real recibida, forzando refresco...');
    // Invalidar caché cuando hay actualizaciones en tiempo real
    invalidateCache('day');
    // Forzar refresco ignorando el caché
    fetchAppointments(true);
  }, [invalidateCache, fetchAppointments]);

  // OPTIMIZACIÓN: Usar realtime optimizado con auto-limpieza
  useOptimizedAppointmentsRealtime(
    profile?.business_id,
    handleRealtimeUpdate,
    true // Solo activo cuando el componente está montado
  );

  // ✅ FIX: Invalidar caché al montar para forzar recarga con la nueva lógica de nombres
  useEffect(() => {
    if (profile?.business_id) {
      invalidateCache('day');
      // No llamar fetchAppointments aquí porque ya se llama en otro useEffect
      // Solo invalidar el caché para que la próxima carga use datos frescos
    }
  }, []); // Solo al montar - eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTimeFormat();
  }, [profile?.business_id]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Open appointment detail when appointmentToOpen is set (from notifications)
  useEffect(() => {
    if (!appointmentToOpen || !profile?.business_id) return;

    // First, try to find in already loaded appointments
    const appointment = appointments.find(apt => apt.id === appointmentToOpen);
    if (appointment) {
      setSelectedAppointment(appointment);
      setDetailViewOpen(true);
      if (onAppointmentOpened) {
        onAppointmentOpened();
      }
      return;
    }

    // If not found, fetch it directly from the database
    const fetchAndOpenAppointment = async () => {
      try {
        const { data, error } = await supabase
          .from("appointments")
          .select(`
            *,
            clients!appointments_client_id_fkey(id, user_id, full_name, email, phone),
            services!appointments_service_id_fkey(name, duration_minutes, price, price_usd, price_mxn),
            staff!appointments_staff_id_fkey(full_name, email, phone),
            businesses!appointments_business_id_fkey(business_name, address)
          `)
          .eq("id", appointmentToOpen)
          .eq("business_id", profile.business_id)
          .single();

        if (!error && data) {
          setSelectedAppointment(data);
          setDetailViewOpen(true);
        }
        if (onAppointmentOpened) {
          onAppointmentOpened();
        }
      } catch (error) {
        console.error("Error fetching appointment:", error);
        if (onAppointmentOpened) {
          onAppointmentOpened();
        }
      }
    };

    fetchAndOpenAppointment();
  }, [appointmentToOpen, appointments, profile?.business_id, date, onAppointmentOpened]);

  const loadTimeFormat = async () => {
    if (!profile?.business_id) return;
    
    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("locale_settings")
        .eq("id", profile.business_id)
        .single();

      if (error) throw error;
      
      const localeSettings = data?.locale_settings as any;
      const format = localeSettings?.timeFormat || '12h';
      setTimeFormat(format);
    } catch (error) {
      setTimeFormat('12h');
    }
  };

  // Fixed timeline from 7:00 AM to 24:00 (inclusive end) to ensure the final 30-min slot is rendered (Android WebView quirk)
  useEffect(() => {
    // Enforce strict range: 7:00 AM (420) to 24:00 (1440) and fixed slot height
    setTimelineStartMinutes(7 * 60); // 7:00 AM = 420 minutes
    setTimelineEndMinutes(24 * 60); // 24:00 = 1440 minutes -> inclusive end to include final slot
    setPixelsPerHour(SLOT_HEIGHT * 2); // ensure fixed slot height (60px per 30-min)
  }, []);

  // Auto-scroll to current time on load
  useEffect(() => {
    const scrollToCurrentTime = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      // Only scroll if current time is within visible range
      if (currentMinutes >= timelineStartMinutes && currentMinutes <= timelineEndMinutes) {
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
          const totalDuration = timelineEndMinutes - timelineStartMinutes;
          const slotCountLocal = Math.max(1, Math.ceil(totalDuration / SLOT_MINUTES) + 1); // +1 safety slot
          const containerHeight = slotCountLocal * SLOT_HEIGHT;
          const scrollPosition = ((currentMinutes - timelineStartMinutes) / totalDuration) * containerHeight;
          const pos = Math.max(0, scrollPosition - 200);
          scrollContainer.scrollTop = pos;
        }
      }
    };
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(scrollToCurrentTime, 100);
    return () => clearTimeout(timer);
  }, [date, timelineStartMinutes, timelineEndMinutes, pixelsPerHour]);

  // Get all appointments sorted by start time (for timeline rendering)
  const sortedAppointments = [...appointments].sort((a, b) => {
    const aMin = parseTimeToMinutes(a.start_time);
    const bMin = parseTimeToMinutes(b.start_time);
    return aMin - bMin;
  });

  // Number of 30-minute slots in the timeline (used to calculate consistent heights)
  // Last valid slot ENDS at 11:30 PM (1380), so last slot STARTS at 11:00 PM (1320)
  // Calculate slots based on: slots from 420 (7:00 AM) to 1320 (11:00 PM) inclusive
  // Rule: startTime <= slot < endTime (endTime exclusive for slots)
  const lastValidSlotEnd = 23 * 60 + 30; // 11:30 PM = 1380 minutes (exclusive end)
  const slotCount = useMemo(() => {
    const lastSlotStart = lastValidSlotEnd - SLOT_MINUTES; // 1320 (11:00 PM)
    const totalMinutes = lastSlotStart - timelineStartMinutes;
    // Number of slots from 420 to 1320 inclusive: (1320 - 420) / 30 + 1 = 31 slots
    return Math.max(1, Math.floor(totalMinutes / SLOT_MINUTES) + 1);
  }, [timelineStartMinutes]);
  const timelineTotalHeight = slotCount * SLOT_HEIGHT;

  // Debug state (visible only when localStorage.debugDayView === '1')
  const [debugInfo, setDebugInfo] = useState({ slotCount, timelineTotalHeight, containerClientHeight: 0, containerScrollHeight: 0, linesRendered: 0 });
  const debugMode = typeof window !== 'undefined' && localStorage.getItem('debugDayView') === '1';

  useEffect(() => {
    if (!debugMode) return;
    const update = () => {
      const c = scrollContainerRef.current as HTMLDivElement | null;
      const lines = document.querySelectorAll('[data-timeline-line]');
      setDebugInfo({
        slotCount,
        timelineTotalHeight,
        containerClientHeight: c?.clientHeight || 0,
        containerScrollHeight: c?.scrollHeight || 0,
        linesRendered: lines.length
      });
    };
    update();
    const obs = new ResizeObserver(update);
    if (scrollContainerRef.current) obs.observe(scrollContainerRef.current);
    window.addEventListener('resize', update);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [debugMode, slotCount, timelineTotalHeight]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const containerHeight = rect.height;
    
    // Calculate which time was clicked using the same grid range as appointments
    const gridEndMinutes = 23 * 60 + 30; // 11:30 PM = 1380 minutes (same as grid)
    const dayDuration = gridEndMinutes - timelineStartMinutes; // 1380 - 420 = 960 minutes
    const clickedMinutes = timelineStartMinutes + (clickY / containerHeight) * dayDuration;
    
    // Round to nearest 15 minutes for convenience
    const roundedMinutes = Math.round(clickedMinutes / 15) * 15;
    const clickedTime = minutesToTime(roundedMinutes);
    const clickedTimeFormatted = formatTime(clickedTime, timeFormat);
    
    setSelectedTime(clickedTimeFormatted);
    setSelectedAppointment(null);
    setDialogOpen(true);
  };

  const handleAppointmentClick = (appointment: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAppointment(appointment);
    setDetailViewOpen(true);
  };

  const handleDialogSuccess = () => {
    fetchAppointments();
  };

  const calculateDuration = (startTime: string, endTime: string): number => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    return (endHour * 60 + endMin) - (startHour * 60 + startMin);
  };

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    return calcEndTime(startTime, durationMinutes);
  };

  const handleDragStart = (event: any) => {
    const appointment = appointments.find(apt => apt.id === event.active.id);
    setActiveId(event.active.id);
    setDraggedAppointment(appointment);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setDraggedAppointment(null);

    if (!over) return;

    const appointmentId = active.id as string;
    const newTimeSlot = over.id as string;

    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (!appointment) return;

    // Si el horario no cambió, no hacer nada
    const currentTimeFormatted = formatTime(appointment.start_time, timeFormat);
    if (currentTimeFormatted === newTimeSlot) return;

    // Calcular duración y nuevo end_time
    const duration = calculateDuration(appointment.start_time, appointment.end_time);
    const newStartTime24 = convertTo24Hour(newTimeSlot);
    const newEndTime24 = calculateEndTime(newStartTime24, duration);

    if (!profile?.business_id) return;
    
    // Actualizar en BD
    const { error } = await supabase
      .from("appointments")
      .update({
        start_time: newStartTime24,
        end_time: newEndTime24
      })
      .eq("id", appointmentId)
      .eq("business_id", profile.business_id);

    if (error) {
      toast.error("No se pudo mover la cita");
    } else {
      toast.success(`Cita reorganizada a ${newTimeSlot}`);
      fetchAppointments();
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setDraggedAppointment(null);
  };

  // Handle status change for quick actions
  const handleQuickAction = async (status: string) => {
    if (!selectedAppointment || !profile?.business_id) {
      toast.error("Error: información de cita incompleta");
      return;
    }
    
    // Map custom statuses to valid DB enum values
    const validStatuses = ['pending', 'confirmed', 'started', 'completed', 'cancelled', 'no_show', 'arrived'] as const;
    type ValidStatus = typeof validStatuses[number];
    const dbStatus: ValidStatus = validStatuses.includes(status as ValidStatus) ? status as ValidStatus : 'confirmed';
    
    try {
      // Obtener el status anterior
      const oldStatus = selectedAppointment.status || "pending";
      
      const { error, data } = await supabase
        .from("appointments")
        .update({ status: dbStatus as "pending" | "confirmed" | "completed" | "cancelled" | "no_show" })
        .eq("id", selectedAppointment.id)
        .eq("business_id", profile.business_id)
        .select()
        .single();

      if (error) {
        console.error("Error updating appointment status:", error);
        toast.error(
          error.message || "No se pudo actualizar el estado",
          {
            description: error.details || error.hint || "",
          }
        );
        return;
      }

      // Toast con ID fijo para evitar duplicados (Sonner reemplazará en lugar de duplicar)
      toast.success("Estado actualizado", {
        id: 'appointment-status-updated',
        duration: 3000,
      });

      // Crear notificación para Partner sobre el cambio de status
      if (oldStatus !== dbStatus && profile?.business_id && profile?.id) {
        // ✅ CORRECCIÓN: NO notificar al Partner cuando él mismo cambia el status
        // El trigger SQL 'trigger_notify_client_on_status_change' ya maneja las notificaciones
        // al cliente específico de la cita automáticamente cuando cambia el status
        // No necesitamos llamar a notifyAppointmentStatusChange desde aquí
      }
      
      // Notify next client when appointment is started
      // IMPORTANTE: Solo ejecutar si la cita existe y no es una creación nueva
      if (dbStatus === "started" && selectedAppointment?.id) {
        try {
          await notifyNextClientWhenAppointmentStarted({
            businessId: profile.business_id,
            currentAppointment: {
              id: selectedAppointment.id,
              appointment_date: selectedAppointment.appointment_date,
              start_time: selectedAppointment.start_time,
              end_time: selectedAppointment.end_time,
              staff_id: selectedAppointment.staff_id,
            },
            language: language === "es" ? "es" : "en",
          });
        } catch (err) {
          console.error("Error notifying next client (non-blocking):", err);
          // No bloquear la actualización del estado si hay error en la notificación
        }
      }
      
      // Notify next client when appointment is completed
      // IMPORTANTE: Solo ejecutar si la cita existe y no es una creación nueva
      if (dbStatus === "completed" && selectedAppointment?.id) {
        try {
          await notifyNextClientWhenAppointmentCompleted({
            businessId: profile.business_id,
            currentAppointment: {
              id: selectedAppointment.id,
              appointment_date: selectedAppointment.appointment_date,
              end_time: selectedAppointment.end_time,
              staff_id: selectedAppointment.staff_id,
            },
            language: language === "es" ? "es" : "en",
          });
        } catch (err) {
          console.error("Error notifying next client when completed (non-blocking):", err);
          // No bloquear la actualización del estado si hay error en la notificación
        }
      }
      
      fetchAppointments();
      setDetailViewOpen(false);
    } catch (err: any) {
      console.error("Unexpected error updating appointment status:", err);
      toast.error("Error inesperado al actualizar el estado", {
        description: err.message || "",
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="p-2">
        {/* Timeline View - Continuous timeline instead of fixed slots */}
        {/* Single scroll container for both time labels and timeline grid */}
        {/* max-h accounts for: header (~100px) + bottom nav (76px) + safe area */}
        <div 
          className="flex gap-1 overflow-y-auto"
          style={{ 
            maxHeight: 'calc(100vh - 100px - var(--bottom-nav-height, 76px) - max(16px, env(safe-area-inset-bottom, 0px), var(--app-safe-bottom, 0px)))',
            paddingBottom: 'calc(var(--bottom-nav-height, 76px) + max(16px, env(safe-area-inset-bottom, 0px), var(--app-safe-bottom, 0px)) + 16px)'
          }}
          ref={scrollContainerRef}
        >
          {/* Time labels column - NO scroll (scroll handled by parent) */}
          <div 
            className="w-12 flex-shrink-0"
            data-time-labels
          >
            <div className="relative" style={{ minHeight: `${timelineTotalHeight}px`, height: `${timelineTotalHeight}px` }}>
              {generateTimelineMinutes(
                timelineStartMinutes / 60,
                23.5, // Generate up to 23.5 hours (1410) to include 11:00 PM marker
                30 // Show every 30 minutes
              ).filter(minutes => minutes <= 23 * 60 + 30).map((minutes) => { 
                const timeStr = minutesToTime(minutes);
                const formatted = formatTime(timeStr, timeFormat);
                // Use the same grid end (1380) for consistent positioning with appointments
                const gridEndMinutes = 23 * 60 + 30; // 11:30 PM = 1380 minutes
                const topPercent = ((minutes - timelineStartMinutes) / (gridEndMinutes - timelineStartMinutes)) * 100;
                return (
                  <div
                    key={minutes}
                    className="text-xs text-muted-foreground font-medium"
                    style={{ position: 'absolute', left: 0, right: 0, top: `${topPercent}%` }}
                  >
                    {formatted}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline container - NO scroll (scroll handled by parent) */}
          <div 
            className="flex-1 relative"
            data-timeline-container
            data-min-time={minTime}
            data-max-time={maxTime}
          >
            <div
              className="relative border border-border rounded-lg bg-muted/20 overflow-visible"
              style={{ 
                minHeight: `${timelineTotalHeight}px`,
                height: `${timelineTotalHeight}px`,
                // Add padding-bottom to ensure appointments at late times (10PM-11:30PM) are fully visible above footer
                paddingBottom: 'calc(var(--bottom-nav-height, 76px) + max(16px, env(safe-area-inset-bottom, 0px), var(--app-safe-bottom, 0px)) + 24px)',
                boxSizing: 'content-box'
              }}
              
              onClick={handleTimelineClick}
            >
              {/* Background layer to ensure the white grid covers full timeline area + footer padding */}
              <div 
                className="absolute bg-white pointer-events-none" 
                style={{ 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0,
                  zIndex: 0 
                }} 
              />

              {/* Precise absolute 30-minute markers (overlay) to guarantee lines exist up to the final slot) */}
              {generateTimelineMinutes(timelineStartMinutes / 60, 23.5, SLOT_MINUTES).filter(minutes => minutes <= 23 * 60 + 30).map((minutes) => {
                // Use the same grid end (1380) for consistent positioning with appointments
                const gridEndMinutes = 23 * 60 + 30; // 11:30 PM = 1380 minutes
                const topPercent = ((minutes - timelineStartMinutes) / (gridEndMinutes - timelineStartMinutes)) * 100;
                const lastValidSlotEnd = 23 * 60 + 30; // 11:30 PM = 1380 minutes (last slot ends here)
                // Last slot starts at 1320 (11:00 PM), ends at 1380 (11:30 PM)
                // Mark the final line at 1380 (end of last slot)
                const isFinal = minutes === lastValidSlotEnd;
                const isHour = minutes % 60 === 0;
                return (
                  <div
                    key={`line-${minutes}`}
                    className={`absolute left-0 right-0 ${isHour ? 'border-t border-border/60' : 'border-t border-border/20'}`}
                    style={isFinal ? { top: 'calc(100% - 1px)', height: '2px', zIndex: 2, opacity: 0.95 } : { top: `${topPercent}%`, height: '1px', zIndex: 1 }}
                  />
                );
              })} 

              {/* Slot rows (30-minute fixed height) used for spacing/interaction */}
              {Array.from({ length: slotCount }).map((_, i) => {
                const slotStart = timelineStartMinutes + i * SLOT_MINUTES;
                const isHour = slotStart % 60 === 0;
                const slotTimeStr = minutesToTime(slotStart);
                const slotTimeFormatted = formatTime(slotTimeStr, timeFormat);

                return (
                  <div
                    key={`slot-${i}`}
                    className={`${isHour ? '' : ''} w-full cursor-pointer`}
                    style={{ height: `${SLOT_HEIGHT}px`, zIndex: 0 }}
                    onClick={(e) => {
                      // Prevent parent handlers (timeline click) from firing
                      e.stopPropagation();
                      setSelectedTime(slotTimeFormatted);
                      setSelectedAppointment(null);
                      setDialogOpen(true);
                    }}
                    role="button"
                    aria-label={`Añadir cita ${slotTimeFormatted}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedTime(slotTimeFormatted);
                        setSelectedAppointment(null);
                        setDialogOpen(true);
                      }
                    }}
                  >
                    <div className="h-full flex items-center px-3 text-xs text-muted-foreground/60">
                      <div className="w-full h-full rounded-md border border-dashed border-border/30 flex items-center justify-center pointer-events-none">
                        <span className="select-none">Añadir</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Final bottom line for end of timeline (e.g., 11:30pm) */}
              <div className="absolute left-0 right-0 border-t border-border/60" style={{ bottom: 0, zIndex: 1 }} />

              {/* Render all appointments at their exact positions with overlap handling */}
              {useMemo(() => {
                const layouts = calculateOverlappingLayout(sortedAppointments.map(apt => ({
                  ...apt,
                  end_time: apt.end_time || calcEndTime(apt.start_time, apt.services?.duration_minutes || 30)
                })));

                // Use the same time range as the grid: from 420 (7:00 AM) to 1380 (11:30 PM)
                // This ensures appointments align perfectly with grid lines
                const gridEndMinutes = 23 * 60 + 30; // 11:30 PM = 1380 minutes (same as lastValidSlotEnd)
                const gridDuration = gridEndMinutes - timelineStartMinutes; // 1380 - 420 = 960 minutes
                const containerHeight = timelineTotalHeight; // Use the actual grid height

                return layouts.map(({ appointment, left, width, column, totalColumns }) => {
                  // Calculate position using the same range as the grid (not 1440)
                  const position = calculateAppointmentPosition(
                    appointment.start_time,
                    appointment.end_time || calcEndTime(appointment.start_time, appointment.services?.duration_minutes || 30),
                    timelineStartMinutes,
                    gridEndMinutes, // Use 1380 instead of 1440
                    containerHeight
                  );

                  // Render each appointment inside an inner wrapper to guarantee it's visually inside the white grid area
                  // Calculate z-index based on column (later columns have higher z-index to appear on top)
                  // Add base z-index of 10, then add column number to ensure proper stacking
                  const baseZIndex = 10;
                  const columnZIndex = baseZIndex + column;

                  return (
                    <div 
                      key={`apt-wrap-${appointment.id}`} 
                      style={{ 
                        position: 'absolute', 
                        top: `${position.top}px`, 
                        height: `${position.height}px`, 
                        left: `${left}%`, 
                        width: `${width}%`, 
                        zIndex: columnZIndex,
                        pointerEvents: 'auto',
                        boxSizing: 'border-box',
                        margin: 0,
                        padding: 0
                      }}
                    >
                      <DraggableAppointment
                        key={appointment.id}
                        appointment={appointment}
                        onEdit={handleAppointmentClick}
                        isActive={activeId === appointment.id}
                        position={{ top: 0, height: position.height }}
                        layout={{ left: 0, width: 100, column, totalColumns }}
                        timeFormat={timeFormat}
                      />
                    </div>
                  );
                });
              }, [sortedAppointments, timelineStartMinutes, timelineEndMinutes, pixelsPerHour, activeId])}
            </div>
          </div>
        </div>

        <AppointmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          date={date}
          timeSlot={selectedTime || ""}
          appointment={selectedAppointment || undefined}
          onSuccess={handleDialogSuccess}
        />

        <AppointmentDetailView
          open={detailViewOpen}
          onOpenChange={setDetailViewOpen}
          appointment={selectedAppointment}
          onEdit={() => {
            setDetailViewOpen(false);
            setDialogOpen(true);
          }}
          onQuickAction={handleQuickAction}
        />

        {/* Drag overlay */}
        <DragOverlay>
          {draggedAppointment ? (
            <div
              className="rounded-lg p-2 text-white text-xs font-medium shadow-lg opacity-80"
              style={{ backgroundColor: getStaffColor(draggedAppointment.staff_id) }}
            >
              {(draggedAppointment.client_name && draggedAppointment.client_name.trim())
                ? draggedAppointment.client_name.trim()
                : (draggedAppointment.guest_name && draggedAppointment.guest_name.trim())
                ? draggedAppointment.guest_name.trim()
                : draggedAppointment.clients?.full_name || 'Cliente'}
              <br />
              {draggedAppointment.services?.name || 'Servicio'}
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

// Draggable appointment component
interface DraggableAppointmentProps {
  appointment: any;
  onEdit: (apt: any, e: React.MouseEvent) => void;
  isActive: boolean;
  position: { top: number; height: number };
  layout: { left: number; width: number; column: number; totalColumns: number };
  timeFormat: '12h' | '24h';
}

function DraggableAppointment({ appointment, onEdit, isActive, position, layout, timeFormat }: DraggableAppointmentProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
  });

  const appointmentColor = useAppointmentColor();
  
  // ✅ PRIORIDAD ESTRICTA: Si client_name existe, usarlo SIN fallback
  // client_name es el nombre del BENEFICIARIO de esta cita específica (ingresado manualmente)
  // Solo usar fallback si client_name es null, undefined o string vacío
  const clientName = (appointment.client_name && appointment.client_name.trim())
    ? appointment.client_name.trim()
    : (appointment.guest_name && appointment.guest_name.trim())
    ? appointment.guest_name.trim()
    : appointment.clients?.full_name || 'Cliente';
  
  // Get service name
  const serviceName = appointment.services?.name || 'Servicio';
  
  // Format time range: "10:00 - 11:30"
  const startTimeFormatted = formatTime(appointment.start_time, timeFormat);
  const endTimeFormatted = appointment.end_time ? formatTime(appointment.end_time, timeFormat) : null;
  const timeRange = endTimeFormatted ? `${startTimeFormatted} - ${endTimeFormatted}` : startTimeFormatted;

  // Determine background color based on appointment status (like image 4)
  const status = appointment.status || 'pending';
  
  // Get background color based on status
  let bgColor = '#f59e0b'; // Default orange for pending
  let textColor = 'text-white'; // White text for colored backgrounds
  
  switch (status) {
    case 'confirmed':
      bgColor = '#3b82f6'; // Blue
      break;
    case 'started':
      bgColor = '#8b5cf6'; // Purple
      break;
    case 'completed':
      // Green for completed
      bgColor = '#22c55e';
      break;
    case 'cancelled':
      bgColor = '#ef4444'; // Red
      break;
    case 'no_show':
      bgColor = '#6b7280'; // Gray
      break;
    case 'pending':
    default:
      bgColor = '#f97316'; // Orange
      break;
  }

  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${position.top}px`,
    height: `${Math.max(position.height, 50)}px`,
    left: `${layout.left}%`, // 0% when inside wrapper
    width: `${layout.width}%`, // 100% when inside wrapper
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 1000 : (isActive ? 20 : 'inherit'), // Inherit z-index from parent wrapper
    opacity: isDragging ? 0.8 : 1,
    cursor: 'pointer',
    backgroundColor: bgColor,
    boxSizing: 'border-box',
    margin: 0,
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`${textColor} rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden relative`}
      onClick={(e) => onEdit(appointment, e)}
    >
      {/* Tag icon in top-right corner */}
      <Tag className="absolute top-1.5 right-1.5 h-3 w-3 text-muted-foreground/60" />
      
      <div className="h-full flex flex-col p-2 pt-1 overflow-hidden">
        {/* First line: Client name */}
        <div className="text-sm font-medium leading-tight mb-0.5 break-words line-clamp-1">
          {clientName}
        </div>
        {/* Second line: Time range */}
        <div className="text-xs opacity-90 leading-tight break-words line-clamp-1">
          {timeRange}
        </div>
      </div>
    </div>
  );
}
