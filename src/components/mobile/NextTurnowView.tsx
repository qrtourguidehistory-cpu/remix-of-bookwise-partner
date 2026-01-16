import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { AppointmentDetailView } from "./AppointmentDetailView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppointmentColor } from "@/hooks/useAppointmentColor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FilterState } from "./CalendarHeader";
import { useAuth } from "@/contexts/AuthContext";
import { formatTime } from "@/lib/timeFormat";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRealtimeAppointments } from "@/hooks/useRealtimeAppointments";
import { Card } from "@/components/ui/card";

interface NextTurnowViewProps {
  filters: FilterState;
}

export function NextTurnowView({ filters }: NextTurnowViewProps) {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const appointmentColor = useAppointmentColor();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.business_id) return;

    setLoading(true);
    try {
      const now = new Date();
      const nowStr = format(now, "yyyy-MM-dd");
      const nowTime = format(now, "HH:mm:ss");

      // Fetch upcoming appointments (pending or confirmed, starting from now)
      let query = supabase
        .from("appointments")
        .select(`
          *,
          clients!appointments_client_id_fkey(id, user_id, full_name, email, phone),
          services!appointments_service_id_fkey(name, duration_minutes, price, price_usd),
          staff!appointments_staff_id_fkey(full_name, email, phone),
          businesses!appointments_business_id_fkey(business_name, address)
        `)
        .eq("business_id", profile.business_id)
        .in("status", ["pending", "confirmed"])
        .order("appointment_date")
        .order("start_time");

      // Filter by date: today or future
      query = query.or(`appointment_date.gt.${nowStr},and(appointment_date.eq.${nowStr},start_time.gte.${nowTime})`);

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
        console.error("Error fetching next appointments:", error);
        toast.error(language === "es" ? "No se pudieron cargar las citas" : "Couldn't load appointments");
        setAppointments([]);
      } else {
        setAppointments(data || []);
      }
    } catch (error) {
      console.error("Error in fetchData:", error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.business_id, filters, language]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime hook to auto-refresh when appointments change
  useRealtimeAppointments(fetchData);

  const handleAppointmentClick = (appointment: any) => {
    setSelectedAppointment(appointment);
    setDetailViewOpen(true);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { color: '#3b82f6', label: language === "es" ? "Confirmada" : "Confirmed" };
      case 'pending':
        return { color: '#f97316', label: language === "es" ? "Pendiente" : "Pending" };
      default:
        return { color: '#f59e0b', label: language === "es" ? "Pendiente" : "Pending" };
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        {language === "es" ? "Cargando próximas citas..." : "Loading upcoming appointments..."}
      </div>
    );
  }

  return (
    <div className="p-4">
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-3">
          {appointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "es" ? "No hay citas próximas" : "No upcoming appointments"}
            </div>
          ) : (
            appointments.map((appointment) => {
              const statusInfo = getStatusInfo(appointment.status);
              // Get client name - prefer the person the appointment is for
              const clientName = appointment.clients?.full_name || 
                                appointment.client_name || 
                                appointment.guest_name || 
                                "Cliente";
              const serviceName = appointment.services?.name || "Servicio";
              const startTime = formatTime(appointment.start_time, '12h');
              const endTime = appointment.end_time ? formatTime(appointment.end_time, '12h') : null;
              const timeRange = endTime ? `${startTime} - ${endTime}` : startTime;
              const appointmentDate = appointment.appointment_date || appointment.date;
              const dateStr = appointmentDate ? format(new Date(appointmentDate), "EEE, d MMM", { locale: language === "es" ? require("date-fns/locale/es").es : undefined }) : "";

              return (
                <Card
                  key={appointment.id}
                  className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleAppointmentClick(appointment)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      {/* Client name first */}
                      <p className="font-semibold text-base mb-1">{clientName}</p>
                      {/* Time range second */}
                      <p className="text-sm text-muted-foreground mb-1">{timeRange}</p>
                      {/* Service name third */}
                      <p className="text-sm font-medium">{serviceName}</p>
                      {dateStr && (
                        <p className="text-xs text-muted-foreground mt-1">{dateStr}</p>
                      )}
                    </div>
                    <Badge 
                      style={{ backgroundColor: statusInfo.color, color: 'white' }}
                      className="ml-2"
                    >
                      {statusInfo.label}
                    </Badge>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      <AppointmentDetailView
        open={detailViewOpen}
        onOpenChange={setDetailViewOpen}
        appointment={selectedAppointment}
        onEdit={() => {
          setDetailViewOpen(false);
        }}
        onQuickAction={async () => {
          await fetchData();
        }}
      />
    </div>
  );
}

