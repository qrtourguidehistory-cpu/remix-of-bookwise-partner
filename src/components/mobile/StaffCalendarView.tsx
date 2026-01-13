import { useState, useEffect, useCallback } from "react";
import { format, addDays } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { AppointmentDialog } from "./AppointmentDialog";
import { AppointmentDetailView } from "./AppointmentDetailView";
import { Plus, Coffee, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";
import { useAppointmentColor } from "@/hooks/useAppointmentColor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FilterState } from "./CalendarHeader";
import { useAuth } from "@/contexts/AuthContext";
import { generateTimeSlotsFromBusinessHours, formatTime } from "@/lib/timeFormat";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { notifyNextClientWhenAppointmentStarted } from "@/lib/queueNotifications";
import { useRealtimeAppointments } from "@/hooks/useRealtimeAppointments";

interface StaffCalendarViewProps {
  date: Date;
  filters: FilterState;
}


// Generate unique color for staff
const getStaffColor = (staffId: string): string => {
  const colors = [
    "hsl(var(--primary))",
    "hsl(220, 70%, 50%)",
    "hsl(160, 70%, 45%)",
    "hsl(280, 70%, 55%)",
    "hsl(30, 80%, 55%)",
    "hsl(340, 75%, 55%)",
  ];
  
  let hash = 0;
  for (let i = 0; i < staffId.length; i++) {
    hash = staffId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

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

export function StaffCalendarView({ date, filters }: StaffCalendarViewProps) {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const appointmentColor = useAppointmentColor();
  const [staff, setStaff] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [timeOff, setTimeOff] = useState<any[]>([]);
  const [earlyDepartures, setEarlyDepartures] = useState<any[]>([]);
  const [businessHours, setBusinessHours] = useState<any>(null);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  // Update time slots when business hours or time format changes
  useEffect(() => {
    if (businessHours && businessHours.is_open && businessHours.start_time && businessHours.end_time) {
      const slots = generateTimeSlotsFromBusinessHours(
        businessHours.start_time,
        businessHours.end_time,
        timeFormat,
        30
      );
      setTimeSlots(slots);
    } else if (businessHours === null) {
      // Fallback if no business hours found
      setTimeSlots(generateTimeSlotsFromBusinessHours("08:00", "20:00", timeFormat, 30));
    }
  }, [businessHours, timeFormat]);

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

  const fetchData = useCallback(async () => {
    if (!profile?.business_id) return;
    
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = date.getDay();

    // Fetch staff
    let staffQuery = supabase
      .from("staff")
      .select("*")
      .eq("business_id", profile.business_id)
      .eq("is_active", true)
      .order("full_name");

    if (filters.staffIds.length > 0) {
      staffQuery = staffQuery.in("id", filters.staffIds);
    }

    const { data: staffData } = await staffQuery;

    // Fetch appointments - use appointment_date for day filtering
    const nextDateStr = format(addDays(date, 1), "yyyy-MM-dd");
    let appointmentsQuery = supabase
      .from("appointments")
      .select(`
        *, 
        payment_method,
        payment_amount,
        clients!appointments_client_id_fkey(id, user_id, full_name, email, phone), 
        services!appointments_service_id_fkey(name, duration_minutes, price, price_usd), 
        staff!appointments_staff_id_fkey(full_name, email, phone), 
        businesses!appointments_business_id_fkey(business_name, address)
      `)
      .eq("business_id", profile.business_id)
      .gte("appointment_date", dateStr)
      .lt("appointment_date", nextDateStr)
      .order("start_time");

    // Apply filters
    if (filters.statuses.length > 0) {
      appointmentsQuery = appointmentsQuery.in("status", filters.statuses as readonly ("pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "started" | "arrived")[]);
    }
    if (filters.staffIds.length > 0) {
      appointmentsQuery = appointmentsQuery.in("staff_id", filters.staffIds);
    }
    if (filters.serviceIds.length > 0) {
      appointmentsQuery = appointmentsQuery.in("service_id", filters.serviceIds);
    }

    const { data: appointmentsData, error: appointmentsError } = await appointmentsQuery;
    if (appointmentsError) {
      console.error("Error fetching appointments (staff view):", appointmentsError);
      toast.error(language === "es" ? "No se pudieron cargar las citas" : "Couldn't load appointments");
    }

    // Fetch schedules and time off for all staff
    const { data: schedulesData } = await supabase
      .from("staff_schedules")
      .select("*")
      .eq("day_of_week", dayOfWeek);

    const { data: timeOffData } = await supabase
      .from("staff_time_off")
      .select("*")
      .lte("start_date", dateStr)
      .gte("end_date", dateStr);

    // Fetch early departures for this date
    const { data: earlyDeparturesData } = await supabase
      .from("staff_early_departures")
      .select("*")
      .eq("departure_date", dateStr);

    // Fetch business hours
    const { data: businessHoursData } = await supabase
      .from("business_hours")
      .select("*")
      .eq("business_id", profile.business_id)
      .eq("day_of_week", dayOfWeek)
      .single();

    if (staffData) setStaff(staffData);
    if (appointmentsData) setAppointments(appointmentsData);
    if (schedulesData) setSchedules(schedulesData);
    if (timeOffData) setTimeOff(timeOffData);
    if (earlyDeparturesData) setEarlyDepartures(earlyDeparturesData);
    if (businessHoursData) {
      setBusinessHours(businessHoursData);
    } else {
      // Set null if no business hours found - useEffect will handle fallback
      setBusinessHours(null);
    }
  }, [date, filters, profile?.business_id, language]);

  // Realtime hook to auto-refresh when appointments change
  useRealtimeAppointments(fetchData);

  useEffect(() => {
    fetchData();
    loadTimeFormat();
  }, [fetchData, profile?.business_id]);

  const getAppointmentsForStaffAndTime = (staffId: string, timeSlot: string) => {
    return appointments.filter((apt) => {
      if (apt.staff_id !== staffId) return false;
      const dbTime12h = formatTime(apt.start_time, timeFormat);
      const cleanDbTime = dbTime12h.replace(/\s/g, "").toLowerCase();
      const cleanTimeSlot = timeSlot.replace(/\s/g, "").toLowerCase();
      return cleanDbTime === cleanTimeSlot;
    });
  };

  const getStaffSchedule = (staffId: string) => {
    return schedules.find(s => s.staff_id === staffId);
  };

  const getStaffTimeOff = (staffId: string) => {
    return timeOff.find(t => t.staff_id === staffId);
  };

  const getStaffEarlyDeparture = (staffId: string) => {
    return earlyDepartures.find(ed => ed.staff_id === staffId);
  };

  const isStaffBreakTime = (staffId: string, timeSlot: string): boolean => {
    const schedule = getStaffSchedule(staffId);
    if (!schedule || !schedule.break_start || !schedule.break_end) return false;
    
    const time = timeSlot.toLowerCase();
    const [hour, minutePart] = time.replace(/am|pm/, '').split(':');
    const isPM = time.includes('pm');
    let hours24 = parseInt(hour);
    
    if (isPM && hours24 !== 12) hours24 += 12;
    if (!isPM && hours24 === 12) hours24 = 0;
    
    const minutes = parseInt(minutePart);
    const totalMinutes = hours24 * 60 + minutes;
    
    const [breakStartHour, breakStartMin] = schedule.break_start.split(':').map(Number);
    const [breakEndHour, breakEndMin] = schedule.break_end.split(':').map(Number);
    const breakStartMinutes = breakStartHour * 60 + breakStartMin;
    const breakEndMinutes = breakEndHour * 60 + breakEndMin;
    
    return totalMinutes >= breakStartMinutes && totalMinutes < breakEndMinutes;
  };

  const isAfterEarlyDeparture = (staffId: string, timeSlot: string): boolean => {
    const earlyDeparture = getStaffEarlyDeparture(staffId);
    if (!earlyDeparture) return false;
    
    const time = timeSlot.toLowerCase();
    const [hour, minutePart] = time.replace(/am|pm/, '').split(':');
    const isPM = time.includes('pm');
    let hours24 = parseInt(hour);
    
    if (isPM && hours24 !== 12) hours24 += 12;
    if (!isPM && hours24 === 12) hours24 = 0;
    
    const minutes = parseInt(minutePart);
    const totalMinutes = hours24 * 60 + minutes;
    
    const [depHour, depMin] = earlyDeparture.actual_end_time.split(':').map(Number);
    const departureMinutes = depHour * 60 + depMin;
    
    return totalMinutes >= departureMinutes;
  };

  const isWithinBusinessHours = (timeSlot: string): boolean => {
    if (!businessHours || !businessHours.is_open) return false;
    
    const time = timeSlot.toLowerCase();
    const [hour, minutePart] = time.replace(/am|pm/, '').split(':');
    const isPM = time.includes('pm');
    let hours24 = parseInt(hour);
    
    if (isPM && hours24 !== 12) hours24 += 12;
    if (!isPM && hours24 === 12) hours24 = 0;
    
    const minutes = parseInt(minutePart);
    const totalMinutes = hours24 * 60 + minutes;
    
    const [startHour, startMin] = businessHours.start_time.split(':').map(Number);
    const [endHour, endMin] = businessHours.end_time.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    return totalMinutes >= startMinutes && totalMinutes < endMinutes;
  };

  const isBreakTime = (timeSlot: string): boolean => {
    if (!businessHours || !businessHours.break_start || !businessHours.break_end) return false;
    
    const time = timeSlot.toLowerCase();
    const [hour, minutePart] = time.replace(/am|pm/, '').split(':');
    const isPM = time.includes('pm');
    let hours24 = parseInt(hour);
    
    if (isPM && hours24 !== 12) hours24 += 12;
    if (!isPM && hours24 === 12) hours24 = 0;
    
    const minutes = parseInt(minutePart);
    const totalMinutes = hours24 * 60 + minutes;
    
    const [breakStartHour, breakStartMin] = businessHours.break_start.split(':').map(Number);
    const [breakEndHour, breakEndMin] = businessHours.break_end.split(':').map(Number);
    const breakStartMinutes = breakStartHour * 60 + breakStartMin;
    const breakEndMinutes = breakEndHour * 60 + breakEndMin;
    
    return totalMinutes >= breakStartMinutes && totalMinutes < breakEndMinutes;
  };

  const handleTimeSlotClick = (staffId: string, time: string) => {
    const staffTimeOff = getStaffTimeOff(staffId);
    if (staffTimeOff) return; // Don't allow booking on time off
    
    setSelectedStaff(staffId);
    setSelectedTime(time);
    setSelectedAppointment(null);
    setDialogOpen(true);
  };

  const handleAppointmentClick = (appointment: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAppointment(appointment);
    setDetailViewOpen(true);
  };

  const calculateWorkload = (staffId: string) => {
    const staffAppointments = appointments.filter(apt => apt.staff_id === staffId);
    const schedule = getStaffSchedule(staffId);
    
    if (!schedule) return { count: 0, percentage: 0, hours: 0 };
    
    const count = staffAppointments.length;
    const totalMinutes = staffAppointments.reduce((sum, apt) => {
      const [startH, startM] = apt.start_time.split(':').map(Number);
      const [endH, endM] = apt.end_time.split(':').map(Number);
      return sum + ((endH * 60 + endM) - (startH * 60 + startM));
    }, 0);
    
    const hours = totalMinutes / 60;
    
    const [schedStartH, schedStartM] = schedule.start_time.split(':').map(Number);
    const [schedEndH, schedEndM] = schedule.end_time.split(':').map(Number);
    const availableMinutes = (schedEndH * 60 + schedEndM) - (schedStartH * 60 + schedStartM);
    
    const percentage = availableMinutes > 0 ? (totalMinutes / availableMinutes) * 100 : 0;
    
    return { count, percentage: Math.round(percentage), hours: Math.round(hours * 10) / 10 };
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
      
      // Notify next client when appointment is started
      if (dbStatus === "started") {
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
          console.error("Error notifying next client:", err);
          // Don't show error to user, just log it
        }
      }
      
      fetchData();
      setDetailViewOpen(false);
    } catch (err: any) {
      console.error("Unexpected error updating appointment status:", err);
      toast.error("Error inesperado al actualizar el estado", {
        description: err.message || "",
      });
    }
  };

  return (
    <div className="h-[calc(100vh-200px)]">
      <ScrollArea className="h-full">
        <div className="flex">
          {/* Time labels column */}
          <div className="w-20 flex-shrink-0 border-r border-border bg-muted/30 sticky left-0 z-10">
            <div className="h-24 border-b border-border" />
            {timeSlots.map((time) => (
              <div key={time} className="h-16 border-b border-border flex items-center justify-center">
                <span className="text-xs text-muted-foreground font-medium">{time}</span>
              </div>
            ))}
          </div>

          {/* Staff columns */}
          <div className="flex">
            {staff.map((member) => {
              const staffColor = getStaffColor(member.id);
              const staffTimeOff = getStaffTimeOff(member.id);
              const workload = calculateWorkload(member.id);
              
              return (
                <div key={member.id} className="w-48 flex-shrink-0 border-r border-border">
                  {/* Staff header */}
                  <div 
                    className="h-24 p-3 border-b border-border flex flex-col justify-between sticky top-0 z-10 bg-background"
                    style={{ borderTopWidth: '3px', borderTopColor: staffColor }}
                  >
                    <div>
                      <div className="font-semibold text-sm truncate">{member.full_name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {workload.count} citas
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {workload.hours}h
                      </Badge>
                      <Badge 
                        variant={workload.percentage > 90 ? "destructive" : "secondary"} 
                        className="text-xs"
                      >
                        {workload.percentage}%
                      </Badge>
                    </div>
                  </div>

                  {/* Time slots */}
                  {timeSlots.map((time) => {
                    const appointmentsAtTime = getAppointmentsForStaffAndTime(member.id, time);
                    const withinBusinessHours = isWithinBusinessHours(time);
                    const isBreak = isBreakTime(time);
                    const isStaffBreak = isStaffBreakTime(member.id, time);
                    const afterEarlyDeparture = isAfterEarlyDeparture(member.id, time);
                    
                    let bgColor = "bg-background";
                    let slotContent = null;
                    
                    if (staffTimeOff) {
                      bgColor = "bg-destructive/10";
                      if (time === "8:00am") {
                        slotContent = (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-destructive">
                            <Moon className="h-4 w-4 mb-1" />
                            <span className="font-medium">{staffTimeOff.time_off_type || "Día libre"}</span>
                          </div>
                        );
                      }
                    } else if (afterEarlyDeparture) {
                      bgColor = "bg-muted/70";
                      slotContent = (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                          <span>Salió temprano</span>
                        </div>
                      );
                    } else if (!withinBusinessHours) {
                      bgColor = "bg-muted/50";
                    } else if (isStaffBreak) {
                      bgColor = "bg-orange-500/10";
                      const staffSchedule = getStaffSchedule(member.id);
                      if (staffSchedule?.break_start && formatTime(staffSchedule.break_start, timeFormat) === time) {
                        slotContent = (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-orange-700 dark:text-orange-300">
                            <Coffee className="h-4 w-4 mb-1" />
                            <span>{staffSchedule?.break_notes || "Break"}</span>
                          </div>
                        );
                      }
                    } else if (isBreak) {
                      bgColor = "bg-orange-500/10";
                      if (businessHours?.break_start && formatTime(businessHours.break_start, timeFormat) === time) {
                        slotContent = (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-orange-600">
                            <Coffee className="h-4 w-4 mb-1" />
                            <span>Break</span>
                          </div>
                        );
                      }
                    }
                    
                    return (
                      <div 
                        key={`${member.id}-${time}`}
                        className={`h-16 border-b border-border relative ${bgColor} hover:bg-accent/50 transition-colors cursor-pointer`}
                        onClick={() => handleTimeSlotClick(member.id, time)}
                      >
                        {slotContent}
                        
                        {appointmentsAtTime.map((apt, aptIndex) => {
                          const statusInfo = getStatusInfo(apt.status);
                          // ✅ FIX: Ensure we always show a name, even if client_id is NULL
                          const clientName = apt.clients?.full_name || 
                                             apt.client_name || 
                                             apt.guest_name || 
                                             (apt as any)?.client?.full_name ||
                                             'Cliente';
                          const serviceName = apt.services?.name || 'Servicio';
                          const startTime = formatTime(apt.start_time, timeFormat);
                          const endTime = apt.end_time ? formatTime(apt.end_time, timeFormat) : null;
                          const timeRange = endTime ? `${startTime} - ${endTime}` : startTime;
                          
                          // Calculate how many slots this appointment spans
                          const durationMinutes = apt.services?.duration_minutes || apt.duration_minutes || 30;
                          const slotsToSpan = Math.ceil(durationMinutes / 60);
                          const heightPx = slotsToSpan * 64 - 2; // 64px per slot (h-16), minus 2px for spacing
                          
                          // Determine border color based on payment status for completed appointments
                          let borderColor = appointmentColor;
                          if (apt.status === 'completed') {
                            // Check if there's a credit record (unpaid)
                            const hasCredit = !apt.payment_method && !apt.payment_amount;
                            if (hasCredit) {
                              borderColor = '#f97316'; // Orange for credit
                            } else if (apt.payment_method && apt.payment_amount) {
                              borderColor = '#22c55e'; // Green for paid
                            }
                          }
                          
                          return (
                            <div 
                              key={apt.id}
                              className="absolute left-0.5 right-0.5 rounded-lg bg-muted/50 border-l-4 shadow-sm cursor-pointer overflow-hidden relative"
                              style={{ 
                                top: '2px',
                                height: `${heightPx}px`,
                                zIndex: 10 + aptIndex,
                                borderLeftColor: borderColor,
                                borderLeftWidth: '4px',
                              }}
                              onClick={(e) => handleAppointmentClick(apt, e)}
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
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        date={date}
        timeSlot={selectedTime || ""}
        staffId={selectedStaff || undefined}
        appointment={selectedAppointment || undefined}
        onSuccess={() => fetchData()}
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
    </div>
  );
}
