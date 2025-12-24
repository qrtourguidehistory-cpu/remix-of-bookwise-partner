import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { FilterState } from "./CalendarHeader";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { AppointmentDialog } from "./AppointmentDialog";
import { AppointmentDetailView } from "./AppointmentDetailView";
import { formatTime } from "@/lib/timeFormat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface WeekViewProps {
  date: Date;
  filters: FilterState;
}

const getStatusInfo = (status: string) => {
  switch (status) {
    case 'confirmed':
      return { color: 'bg-green-500', label: 'Confirmada' };
    case 'completed':
      return { color: 'bg-blue-500', label: 'Completada' };
    case 'cancelled':
      return { color: 'bg-red-500', label: 'Cancelada' };
    case 'no_show':
      return { color: 'bg-gray-500', label: 'No Asistió' };
    default:
      return { color: 'bg-yellow-500', label: 'Pendiente' };
  }
};

export function WeekView({ date, filters }: WeekViewProps) {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (profile?.business_id) {
      fetchAppointments();
    }
  }, [date, filters, profile?.business_id]);

  const fetchAppointments = async () => {
    if (!profile?.business_id) return;
    
    setLoading(true);
    const weekEnd = addDays(weekStart, 6);
    const startDateStr = format(weekStart, "yyyy-MM-dd");
    const endExclusiveStr = format(addDays(weekEnd, 1), "yyyy-MM-dd");

    let query = supabase
      .from("appointments")
      .select(`
        *,
        client_name,
        client_email,
        client_phone,
        clients!appointments_client_id_fkey(id, user_id, full_name, email, phone, is_blocked, blocked_reason, blocked_at, allergy_notes),
        services!appointments_service_id_fkey(name, duration_minutes, price),
        staff!appointments_staff_id_fkey(full_name)
      `)
      .eq("business_id", profile.business_id)
      // Prefer appointment_date (supports DATE or TIMESTAMP)
      .gte("appointment_date", startDateStr)
      .lt("appointment_date", endExclusiveStr)
      .order("appointment_date")
      .order("start_time");

    // Apply filters
    if (filters.statuses.length > 0) {
      query = query.in("status", filters.statuses as any);
    }
    if (filters.staffIds.length > 0) {
      query = query.in("staff_id", filters.staffIds);
    }
    if (filters.serviceIds.length > 0) {
      query = query.in("service_id", filters.serviceIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching appointments:", error);
      setAppointments([]);
    } else {
      setAppointments(data || []);
    }
    setLoading(false);
  };

  const getAppointmentsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return appointments.filter(apt => apt.date === dayStr || apt.appointment_date === dayStr);
  };

  const handleDayClick = (day: Date, time?: string) => {
    setSelectedDate(day);
    setSelectedTime(time || null);
    setSelectedAppointment(null);
    setDialogOpen(true);
  };

  const handleAppointmentClick = (appointment: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAppointment(appointment);
    setDetailViewOpen(true);
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Cargando citas...
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
        {weekDays.map((day, index) => {
          const dayAppointments = getAppointmentsForDay(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <div 
              key={index} 
              className={`bg-card rounded-lg border overflow-hidden ${
                isToday ? 'border-primary ring-2 ring-primary/20' : 'border-border/20'
              }`}
            >
              <div className={`p-3 border-b ${isToday ? 'bg-primary/10' : 'bg-muted/30'}`}>
                <div className="text-xs font-medium text-muted-foreground uppercase">
                  {format(day, "EEE", { locale: es })}
                </div>
                <div className={`text-xl font-bold ${isToday ? 'text-primary' : ''}`}>
                  {format(day, "d")}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {dayAppointments.length} {dayAppointments.length === 1 ? 'cita' : 'citas'}
                </div>
              </div>
              <div className="p-2 space-y-2 min-h-[200px]">
                {dayAppointments.length === 0 ? (
                  <button
                    onClick={() => handleDayClick(day)}
                    className="w-full h-full min-h-[200px] border-2 border-dashed border-muted hover:border-primary hover:bg-accent/50 rounded-lg transition-colors text-sm text-muted-foreground flex flex-col items-center justify-center"
                  >
                    <Plus className="h-5 w-5 mb-1" />
                    <span>Agregar cita</span>
                  </button>
                ) : (
                  <>
                    {dayAppointments.map((appointment) => {
                      const statusInfo = getStatusInfo(appointment.status);
                      // ✅ FIX: Ensure we always show a name, even if client_id is NULL
                      const clientName = appointment.clients?.full_name || 
                                        appointment.client_name || 
                                        appointment.guest_name || 
                                        "Cliente";
                      const serviceName = appointment.services?.name || "Servicio";
                      const startTime = formatTime(appointment.start_time, '12h');
                      
                      return (
                        <div
                          key={appointment.id}
                          onClick={(e) => handleAppointmentClick(appointment, e)}
                          className={`${statusInfo.color} rounded p-2 text-white text-xs cursor-pointer hover:opacity-90 transition-opacity`}
                        >
                          <div className="font-medium">{startTime}</div>
                          <div className="opacity-90 truncate">{clientName}</div>
                          <div className="opacity-75 truncate text-[10px]">{serviceName}</div>
                        </div>
                      );
                    })}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDayClick(day)}
                      className="w-full mt-2 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        date={selectedDate || date}
        timeSlot={selectedTime || undefined}
        appointment={selectedAppointment}
        onSuccess={() => {
          fetchAppointments();
          setDialogOpen(false);
        }}
      />

      <AppointmentDetailView
        open={detailViewOpen}
        onOpenChange={(open) => {
          setDetailViewOpen(open);
          if (!open) {
            setSelectedAppointment(null);
          }
        }}
        appointment={selectedAppointment}
        onEdit={() => {
          setDetailViewOpen(false);
          setSelectedDate(selectedAppointment?.date ? new Date(selectedAppointment.date) : date);
          setSelectedTime(formatTime(selectedAppointment?.start_time, '12h'));
          setDialogOpen(true);
        }}
        onQuickAction={async (status) => {
          if (!selectedAppointment) return;
          
          if (!profile?.business_id) {
            toast.error("No se encontró el negocio");
            return;
          }
          
          try {
            const { error } = await supabase
              .from("appointments")
              .update({ status })
              .eq("id", selectedAppointment.id)
              .eq("business_id", profile.business_id);

            if (error) {
              console.error("Error updating appointment status:", error);
              toast.error(
                error.message || "Error al actualizar el estado",
                {
                  description: error.details || error.hint || "",
                }
              );
              return;
            }

            // Send notifications based on status change
            const { sendNotificationToClient, getNextAppointmentInQueue, scheduleNotification } = await import('@/lib/notificationService');
            
            const appointmentDate = selectedAppointment.appointment_date || selectedAppointment.date;
            const appointmentTime = selectedAppointment.start_time;
            
            if (status === 'confirmed') {
              await sendNotificationToClient({
                appointmentId: selectedAppointment.id,
                clientId: selectedAppointment.client_id,
                clientEmail: selectedAppointment.client_email,
                clientPhone: selectedAppointment.client_phone,
                clientName: selectedAppointment.client_name || selectedAppointment.clients?.full_name,
                type: 'confirmation',
                appointmentDate: appointmentDate ? new Date(appointmentDate).toLocaleDateString('es-ES') : undefined,
                appointmentTime: appointmentTime,
                businessId: profile.business_id,
              });

              if (appointmentDate && appointmentTime) {
                const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
                const reminderTime = new Date(appointmentDateTime.getTime() - 10 * 60 * 1000);
                if (reminderTime > new Date()) {
                  await scheduleNotification(selectedAppointment.id, reminderTime, 'reminder', profile.business_id, {
                    clientId: selectedAppointment.client_id,
                    clientEmail: selectedAppointment.client_email,
                    clientPhone: selectedAppointment.client_phone,
                    clientName: selectedAppointment.client_name || selectedAppointment.clients?.full_name,
                  });
                }
              }
            } else if (status === 'completed') {
              await sendNotificationToClient({
                appointmentId: selectedAppointment.id,
                clientId: selectedAppointment.client_id,
                clientEmail: selectedAppointment.client_email,
                clientPhone: selectedAppointment.client_phone,
                clientName: selectedAppointment.client_name || selectedAppointment.clients?.full_name,
                type: 'completion',
                appointmentDate: appointmentDate ? new Date(appointmentDate).toLocaleDateString('es-ES') : undefined,
                appointmentTime: appointmentTime,
                businessId: profile.business_id,
              });

              await sendNotificationToClient({
                appointmentId: selectedAppointment.id,
                clientId: selectedAppointment.client_id,
                clientEmail: selectedAppointment.client_email,
                clientPhone: selectedAppointment.client_phone,
                clientName: selectedAppointment.client_name || selectedAppointment.clients?.full_name,
                type: 'review_request',
                businessId: profile.business_id,
              });

              const nextAppointment = await getNextAppointmentInQueue(selectedAppointment.id, profile.business_id);
              if (nextAppointment) {
                await sendNotificationToClient({
                  appointmentId: nextAppointment.id,
                  clientId: nextAppointment.client_id,
                  clientEmail: nextAppointment.client_email,
                  clientPhone: nextAppointment.client_phone,
                  clientName: nextAppointment.client_name,
                  type: 'next_in_queue',
                  appointmentDate: nextAppointment.appointment_date || nextAppointment.date ? new Date(nextAppointment.appointment_date || nextAppointment.date).toLocaleDateString('es-ES') : undefined,
                  appointmentTime: nextAppointment.start_time,
                  businessId: profile.business_id,
                });
              }
            } else if (status === 'cancelled') {
              await sendNotificationToClient({
                appointmentId: selectedAppointment.id,
                clientId: selectedAppointment.client_id,
                clientEmail: selectedAppointment.client_email,
                clientPhone: selectedAppointment.client_phone,
                clientName: selectedAppointment.client_name || selectedAppointment.clients?.full_name,
                type: 'cancellation',
                appointmentDate: appointmentDate ? new Date(appointmentDate).toLocaleDateString('es-ES') : undefined,
                appointmentTime: appointmentTime,
                businessId: profile.business_id,
              });
            }

            toast.success("Estado actualizado correctamente");
            fetchAppointments();
            setSelectedAppointment({ ...selectedAppointment, status });
          } catch (err: any) {
            console.error("Unexpected error updating appointment:", err);
            toast.error("Error inesperado al actualizar el estado", {
              description: err?.message || "",
            });
          }
        }}
      />
    </div>
  );
}
