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
import { useRealtimeAppointments } from "@/hooks/useRealtimeAppointments";
import { useLanguage } from "@/contexts/LanguageContext";
import { notifyNextClientWhenAppointmentStarted } from "@/lib/queueNotifications";
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
  const [timelineStartMinutes, setTimelineStartMinutes] = useState<number>(7 * 60); // 7:00 AM default
  const [timelineEndMinutes, setTimelineEndMinutes] = useState<number>(23 * 60); // 11:00 PM default
  const [pixelsPerHour, setPixelsPerHour] = useState<number>(80); // consistent look (like reference)

  // Refs for synchronizing scroll between time labels and timeline
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (labelsRef.current) {
      labelsRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchAppointments = useCallback(async () => {
    if (!profile?.business_id) {
      return;
    }
    
    const dateStr = format(date, "yyyy-MM-dd");
    const nextDateStr = format(addDays(date, 1), "yyyy-MM-dd");
    
    // Use appointment_date for day filtering
    let query = supabase
      .from("appointments")
      .select(`
        *,
        payment_method,
        payment_amount,
        clients!appointments_client_id_fkey(id, user_id, full_name, email, phone),
        services!appointments_service_id_fkey(name, duration_minutes, price, price_usd, price_mxn),
        staff!appointments_staff_id_fkey(full_name, email, phone),
        businesses!appointments_business_id_fkey(business_name, address)
      `)
      .eq("business_id", profile.business_id)
      // Use a range instead of eq to support both DATE and TIMESTAMP columns
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
      // Apply search filter on client side (for related data)
      let filteredData = data;
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        filteredData = data.filter(apt => {
          const clientName = (apt.clients?.full_name || '').toLowerCase();
          const serviceName = (apt.services?.name || '').toLowerCase();
          const staffName = (apt.staff?.full_name || '').toLowerCase();
          return clientName.includes(searchLower) ||
                 serviceName.includes(searchLower) ||
                 staffName.includes(searchLower);
        });
      }
      setAppointments(filteredData);
    } else {
      setAppointments([]);
    }
  }, [date, filters, profile?.business_id]);

  // Realtime hook to auto-refresh when new appointments arrive
  useRealtimeAppointments(fetchAppointments);

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

  // Fixed timeline from 7:00 AM to 11:30 PM as requested
  useEffect(() => {
    // Always use fixed hours: 7:00 AM (420 min) to 11:30 PM (1410 min)
    setTimelineStartMinutes(7 * 60); // 7:00 AM = 420 minutes
    setTimelineEndMinutes(23 * 60 + 30); // 11:30 PM = 1410 minutes
    setPixelsPerHour(80);
  }, []);

  // Auto-scroll to current time on load
  useEffect(() => {
    const scrollToCurrentTime = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      // Only scroll if current time is within visible range
      if (currentMinutes >= timelineStartMinutes && currentMinutes <= timelineEndMinutes) {
        const scrollContainer = timelineRef.current;
        const labelsContainer = labelsRef.current;
        if (scrollContainer) {
          const totalDuration = timelineEndMinutes - timelineStartMinutes;
          const containerHeight = ((totalDuration) / 60) * pixelsPerHour;
          const scrollPosition = ((currentMinutes - timelineStartMinutes) / totalDuration) * containerHeight;
          const pos = Math.max(0, scrollPosition - 100);
          scrollContainer.scrollTop = pos;
          if (labelsContainer) labelsContainer.scrollTop = pos;
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

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const containerHeight = rect.height;
    
    // Calculate which time was clicked
    const dayDuration = timelineEndMinutes - timelineStartMinutes;
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

      toast.success("Estado actualizado");
      
      // Note: Notification to next client is handled automatically by database trigger
      // when status changes to "started" - no need to call from frontend
      
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
        <div className="flex gap-1">
          {/* Time labels column */}
          <div 
            className="w-12 flex-shrink-0 overflow-y-auto max-h-[calc(100vh-200px)]"
            ref={labelsRef}
            data-time-labels
          >
            {generateTimelineMinutes(
              Math.floor(timelineStartMinutes / 60),
              Math.ceil(timelineEndMinutes / 60),
              60 // Show every hour
            ).map((minutes) => {
              const timeStr = minutesToTime(minutes);
              const formatted = formatTime(timeStr, timeFormat);
              const hourHeight = pixelsPerHour;
              return (
                <div
                  key={minutes}
                  className="text-xs text-muted-foreground font-medium border-b border-border flex items-center"
                  style={{ height: `${hourHeight}px` }}
                >
                  {formatted}
                </div>
              );
            })}
          </div>

          {/* Timeline container with scroll */}
          <div 
            className="flex-1 relative overflow-y-auto max-h-[calc(100vh-200px)]"
            data-timeline-container
            ref={timelineRef}
            onScroll={handleTimelineScroll}
          >
            <div
              className="relative border border-border rounded-lg bg-muted/20 overflow-hidden"
              style={{ 
                minHeight: `${((timelineEndMinutes - timelineStartMinutes) / 60) * pixelsPerHour}px`,
                height: `${((timelineEndMinutes - timelineStartMinutes) / 60) * pixelsPerHour}px`
              }}
              onClick={handleTimelineClick}
            >
              {/* Hour markers */}
              {generateTimelineMinutes(
                Math.floor(timelineStartMinutes / 60),
                Math.ceil(timelineEndMinutes / 60),
                60
              ).map((minutes) => {
                const topPercent = ((minutes - timelineStartMinutes) / (timelineEndMinutes - timelineStartMinutes)) * 100;
                return (
                  <div
                    key={minutes}
                    className="absolute left-0 right-0 border-t border-border/50"
                    style={{
                      top: `${topPercent}%`
                    }}
                  />
                );
              })}

              {/* 15-minute markers (lighter) */}
              {generateTimelineMinutes(
                Math.floor(timelineStartMinutes / 60),
                Math.ceil(timelineEndMinutes / 60),
                15
              ).map((minutes) => {
                const topPercent = ((minutes - timelineStartMinutes) / (timelineEndMinutes - timelineStartMinutes)) * 100;
                return (
                  <div
                    key={`15-${minutes}`}
                    className="absolute left-0 right-0 border-t border-border/20"
                    style={{
                      top: `${topPercent}%`
                    }}
                  />
                );
              })}

              {/* Render all appointments at their exact positions with overlap handling */}
              {useMemo(() => {
                const layouts = calculateOverlappingLayout(sortedAppointments.map(apt => ({
                  ...apt,
                  end_time: apt.end_time || calcEndTime(apt.start_time, apt.services?.duration_minutes || 30)
                })));

                const containerHeight = ((timelineEndMinutes - timelineStartMinutes) / 60) * pixelsPerHour;
                
                return layouts.map(({ appointment, left, width, column, totalColumns }) => {
                  const position = calculateAppointmentPosition(
                    appointment.start_time,
                    appointment.end_time || calcEndTime(appointment.start_time, appointment.services?.duration_minutes || 30),
                    timelineStartMinutes,
                    timelineEndMinutes,
                    containerHeight
                  );

                  return (
                    <DraggableAppointment
                      key={appointment.id}
                      appointment={appointment}
                      onEdit={handleAppointmentClick}
                      isActive={activeId === appointment.id}
                      position={position}
                      layout={{ left, width, column, totalColumns }}
                      timeFormat={timeFormat}
                    />
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
              {draggedAppointment.clients?.full_name || 
               draggedAppointment.client_name || 
               draggedAppointment.guest_name || 
               'Cliente'}
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

  const statusInfo = getStatusInfo(appointment.status);
  const appointmentColor = useAppointmentColor();
  
  // Get client name - prefer clients relation, fallback to client_name, then guest_name
  // ✅ FIX: Ensure we always show a name, even if client_id is NULL
  const clientName = appointment.clients?.full_name || 
                     appointment.client_name || 
                     appointment.guest_name || 
                     (appointment as any)?.client?.full_name ||
                     'Cliente';
  
  // Get service name
  const serviceName = appointment.services?.name || 'Servicio';
  
  // Format time range: "10:00 - 11:30"
  const startTimeFormatted = formatTime(appointment.start_time, timeFormat);
  const endTimeFormatted = appointment.end_time ? formatTime(appointment.end_time, timeFormat) : null;
  const timeRange = endTimeFormatted ? `${startTimeFormatted} - ${endTimeFormatted}` : startTimeFormatted;

  // Determine border color based on appointment status and payment
  let borderColor = appointmentColor;
  const status = appointment.status || 'pending';
  
  switch (status) {
    case 'cancelled':
      borderColor = '#ef4444'; // Red
      break;
    case 'no_show':
      borderColor = '#000000'; // Black for no-show
      break;
    case 'confirmed':
      borderColor = '#3b82f6'; // Blue for confirmed
      break;
    case 'started':
      borderColor = '#8b5cf6'; // Purple
      break;
    case 'completed':
      // Subcolors for completed based on payment
      const hasCredit = !appointment.payment_method && !appointment.payment_amount;
      if (hasCredit) {
        borderColor = '#38bdf8'; // Light blue for credit
      } else {
        // Green for all paid methods (cash, card, transfer, crypto)
        borderColor = '#22c55e';
      }
      break;
    case 'pending':
    default:
      borderColor = '#f97316'; // Orange for pending/booked
      break;
  }

  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${position.top}px`,
    height: `${Math.max(position.height, 50)}px`,
    left: `${layout.left}%`,
    width: `calc(${layout.width}% - 2px)`,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.8 : 1,
    cursor: 'pointer',
    borderLeftColor: borderColor,
    borderLeftWidth: '4px',
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className="bg-muted/50 rounded-lg border-l-4 shadow-sm hover:shadow-md transition-shadow overflow-hidden relative"
      onClick={(e) => onEdit(appointment, e)}
    >
      {/* Tag icon in top-right corner */}
      <Tag className="absolute top-1.5 right-1.5 h-3 w-3 text-muted-foreground/60" />
      
      <div className="h-full flex flex-col p-2 pt-1">
        {/* First line: "10:00 - 11:30 John Doe" */}
        <div className="text-sm text-foreground leading-tight truncate mb-0.5">
          {timeRange} {clientName}
        </div>
        {/* Second line: "Haircut" */}
        <div className="text-xs text-muted-foreground truncate">
          {serviceName}
        </div>
      </div>
    </div>
  );
}
