import { useState, useEffect, useCallback } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { FilterState } from "./CalendarHeader";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppointmentDialog } from "./AppointmentDialog";
import { AppointmentDetailView } from "./AppointmentDetailView";
import { formatTime } from "@/lib/timeFormat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useOptimizedAppointmentsRealtime } from "@/hooks/useOptimizedRealtime";
import { useAppointmentCache } from "@/hooks/useAppointmentCache";

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
  const { language } = useLanguage();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // OPTIMIZACIÓN: Usar caché de consultas
  const { generateCacheKey, getCached, setCached, invalidateCache } = useAppointmentCache();

  const fetchAppointments = useCallback(async (bypassCache: boolean = false) => {
    if (!profile?.business_id) return;
    
    // OPTIMIZACIÓN: Verificar caché primero (solo si no se está forzando el bypass)
    const cacheKey = generateCacheKey('week', date, filters);
    if (!bypassCache) {
      const cachedData = getCached(cacheKey);
      if (cachedData) {
        setAppointments(cachedData);
        setLoading(false);
        return;
      }
    } else {
      // Si se está forzando el bypass, invalidar el caché primero
      invalidateCache('week');
    }
    
    setLoading(true);
    const currentWeekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = addDays(currentWeekStart, 6);
    const startDateStr = format(currentWeekStart, "yyyy-MM-dd");
    const endExclusiveStr = format(addDays(weekEnd, 1), "yyyy-MM-dd");

    // OPTIMIZACIÓN: Solo seleccionar columnas necesarias
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
        client_name,
        guest_name,
        notes,
        clients:client_id(id, full_name, email, phone),
        services:service_id(name, duration_minutes, price),
        staff:staff_id(full_name)
      `)
      .eq("business_id", profile.business_id)
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
      // ✅ FIX: Si data existe pero clients está vacío, hacer consulta directa como fallback
      let enrichedData = (data || []) as any[];
      if (data && data.length > 0 && profile?.business_id) {
        const appointmentsNeedingClientData = (data as any[]).filter(
          (apt: any) => !apt.clients && apt.client_id
        );

        if (appointmentsNeedingClientData.length > 0) {
          // Consultar clientes directamente
          const clientIds = appointmentsNeedingClientData
            .map((apt: any) => apt.client_id)
            .filter((id: any): id is string => Boolean(id));

          if (clientIds.length > 0) {
            const { data: clientsData, error: clientsError } = await supabase
              .from("clients")
              .select("id, full_name, email, phone")
              .eq("business_id", profile.business_id)
              .in("id", clientIds);

            if (!clientsError && clientsData) {
              // Crear un mapa de client_id -> client data
              const clientsMap = new Map(
                clientsData.map((client) => [client.id, client])
              );

              // Enriquecer appointments con datos de clientes
              enrichedData = (data as any[]).map((apt: any) => {
                if (!apt.clients && apt.client_id) {
                  const clientData = clientsMap.get(apt.client_id);
                  if (clientData) {
                    return { ...apt, clients: clientData };
                  }
                }
                return apt;
              });
            }
          }
        }
      }

      setAppointments(enrichedData);
      // OPTIMIZACIÓN: Guardar en caché
      setCached(cacheKey, enrichedData, filters);
    }
    setLoading(false);
  }, [date, filters, profile?.business_id, generateCacheKey, getCached, setCached, invalidateCache]);

  // ✅ CORRECCIÓN GLOBAL: Callback envuelto en useCallback para evitar re-suscripciones
  const handleRealtimeUpdate = useCallback((payload?: any) => {
    console.log('🔄 [WeekView] Actualización en tiempo real recibida, forzando refresco...', payload);
    
    // ✅ CORRECCIÓN GLOBAL 1: SIEMPRE invalidar y refetch, sin verificar rango
    // Esto asegura que INSERT siempre actualice la vista, incluso si la cita está fuera del rango visible
    invalidateCache(); // Sin parámetro = invalida todo (day, week, month)
    
    // Forzar refresco ignorando el caché
    // El query filtrará por fecha automáticamente, pero la invalidación ya ocurrió
    fetchAppointments(true);
  }, [invalidateCache, fetchAppointments]);

  // OPTIMIZACIÓN: Usar realtime optimizado con auto-limpieza
  useOptimizedAppointmentsRealtime(
    profile?.business_id,
    handleRealtimeUpdate,
    true
  );

  // ✅ FIX: Invalidar caché al montar para forzar recarga con la nueva lógica de nombres
  useEffect(() => {
    if (profile?.business_id) {
      invalidateCache('week');
      // No llamar fetchAppointments aquí porque ya se llama en otro useEffect
      // Solo invalidar el caché para que la próxima carga use datos frescos
    }
  }, []); // Solo al montar - eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (profile?.business_id) {
      fetchAppointments();
    }
  }, [fetchAppointments, profile?.business_id]);

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
                      // ✅ PRIORIDAD ESTRICTA: Si client_name existe, usarlo SIN fallback
                      // client_name es el nombre del BENEFICIARIO de esta cita específica (ingresado manualmente)
                      const clientName = (appointment.client_name && appointment.client_name.trim())
                        ? appointment.client_name.trim()
                        : (appointment.guest_name && appointment.guest_name.trim())
                        ? appointment.guest_name.trim()
                        : appointment.clients?.full_name || "Cliente";
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

            // ✅ Notificar al cliente cuando la cita se confirma
            if (status === 'confirmed' && selectedAppointment?.id) {
              try {
                console.log("PUSH::START::confirm", { appointment_id: selectedAppointment.id });
                await supabase.functions.invoke('notify-appointment-confirmed', {
                  body: { appointment_id: selectedAppointment.id }
                });
                console.log("PUSH::SUCCESS::confirm", { appointment_id: selectedAppointment.id });
              } catch (err) {
                console.log("PUSH::ERROR::confirm", { appointment_id: selectedAppointment.id, error: err });
                console.error("Error notifying appointment confirmed (non-blocking):", err);
              }
            } else if (status === 'completed') {
              // ✅ Notificar al cliente cuando la cita se completa
              try {
                console.log("PUSH::START::complete", { appointment_id: selectedAppointment.id });
                await supabase.functions.invoke('notify-appointment-completed', {
                  body: { appointment_id: selectedAppointment.id }
                });
                console.log("PUSH::SUCCESS::complete", { appointment_id: selectedAppointment.id });
              } catch (err) {
                console.log("PUSH::ERROR::complete", { appointment_id: selectedAppointment.id, error: err });
                console.error("Error notifying appointment completed (non-blocking):", err);
              }

              // Notify next client using the new function that uses send-push-notification Edge Function
              // IMPORTANTE: Solo ejecutar si la cita existe y no es una creación nueva
              if (selectedAppointment?.id) {
                try {
                  const { notifyNextClientWhenAppointmentCompleted } = await import("@/lib/queueNotifications");
                  await notifyNextClientWhenAppointmentCompleted({
                    businessId: profile.business_id,
                    currentAppointment: {
                      id: selectedAppointment.id,
                      appointment_date: selectedAppointment.appointment_date || selectedAppointment.date,
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
            } else if (status === 'cancelled') {
              // ✅ Notificar al cliente cuando la cita se cancela
              try {
                console.log("PUSH::START::cancel", { appointment_id: selectedAppointment.id });
                await supabase.functions.invoke('notify-appointment-cancelled', {
                  body: { appointment_id: selectedAppointment.id }
                });
                console.log("PUSH::SUCCESS::cancel", { appointment_id: selectedAppointment.id });
              } catch (err) {
                console.log("PUSH::ERROR::cancel", { appointment_id: selectedAppointment.id, error: err });
                console.error("Error notifying appointment cancelled (non-blocking):", err);
              }
            }

            // Toast con ID fijo para evitar duplicados (Sonner reemplazará en lugar de duplicar)
            toast.success("Estado actualizado correctamente", {
              id: 'appointment-status-updated',
              duration: 3000,
            });
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
