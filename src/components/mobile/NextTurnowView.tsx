import { useState, useEffect, useCallback, useMemo } from "react";
import { format, parseISO, isToday, isTomorrow, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/lib/supabaseClient";
import { AppointmentDetailView } from "./AppointmentDetailView";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterState } from "./CalendarHeader";
import { useAuth } from "@/contexts/AuthContext";
import { formatTime } from "@/lib/timeFormat";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRealtimeAppointments } from "@/hooks/useRealtimeAppointments";
import { Clock, User, Briefcase } from "lucide-react";

interface NextTurnowViewProps {
  filters: FilterState;
}

interface GroupedAppointments {
  date: string;
  dateLabel: string;
  appointments: any[];
}

export function NextTurnowView({ filters }: NextTurnowViewProps) {
  const { profile } = useAuth();
  const { language, t } = useLanguage();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.business_id) return;

    setLoading(true);
    try {
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");
      const nowTimeStr = format(now, "HH:mm:ss");

      // Fetch ALL future appointments (pending, confirmed, started, arrived)
      // Start from today, filtering out past appointments for today
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
        .in("status", ["pending", "confirmed", "started", "arrived"])
        .gte("appointment_date", todayStr)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true });

      // Apply additional filters
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
        // Filter out past appointments for today
        const filtered = (data || []).filter(apt => {
          if (apt.appointment_date === todayStr) {
            // For today, only include appointments that haven't started yet
            return apt.start_time >= nowTimeStr;
          }
          return true; // All future dates are included
        });
        
        setAppointments(filtered);
      }
    } catch (error) {
      console.error("Error in fetchData:", error);
      toast.error(language === "es" ? "Error al cargar las citas" : "Error loading appointments");
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

  // Group appointments by date
  const groupedAppointments = useMemo<GroupedAppointments[]>(() => {
    const groups: { [key: string]: any[] } = {};
    
    appointments.forEach(apt => {
      const dateKey = apt.appointment_date || apt.date;
      if (!dateKey) return;
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(apt);
    });

    // Convert to array and sort by date
    return Object.keys(groups)
      .sort()
      .map(dateKey => {
        const dateObj = parseISO(dateKey);
        let dateLabel = "";
        
        if (isToday(dateObj)) {
          dateLabel = language === "es" ? "Hoy" : "Today";
        } else if (isTomorrow(dateObj)) {
          dateLabel = language === "es" ? "Mañana" : "Tomorrow";
        } else {
          dateLabel = format(dateObj, "EEEE, d MMMM", { locale: language === "es" ? es : undefined });
          // Capitalize first letter
          dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
        }

        return {
          date: dateKey,
          dateLabel,
          appointments: groups[dateKey].sort((a, b) => {
            // Sort by start_time within each date group
            const timeA = a.start_time || "";
            const timeB = b.start_time || "";
            return timeA.localeCompare(timeB);
          })
        };
      });
  }, [appointments, language]);

  const handleAppointmentClick = (appointment: any) => {
    setSelectedAppointment(appointment);
    setDetailViewOpen(true);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { 
          color: '#3b82f6', 
          bgColor: '#dbeafe',
          label: language === "es" ? "Confirmada" : "Confirmed" 
        };
      case 'started':
        return { 
          color: '#8b5cf6', 
          bgColor: '#e9d5ff',
          label: language === "es" ? "Iniciada" : "Started" 
        };
      case 'arrived':
        return { 
          color: '#10b981', 
          bgColor: '#d1fae5',
          label: language === "es" ? "Llegó" : "Arrived" 
        };
      case 'pending':
      default:
        return { 
          color: '#f97316', 
          bgColor: '#fed7aa',
          label: language === "es" ? "Pendiente" : "Pending" 
        };
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        {language === "es" ? "Cargando próximas citas..." : "Loading upcoming appointments..."}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="p-4 text-center py-8 text-muted-foreground">
        {language === "es" ? "No hay citas próximas" : "No upcoming appointments"}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-4">
        {groupedAppointments.map((group) => (
          <div key={group.date} className="mb-6">
            {/* Sticky Header */}
            <div 
              className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 border-b border-border mb-3"
            >
              <h3 className="text-lg font-semibold text-foreground">
                {group.dateLabel}
              </h3>
            </div>

            {/* Appointments for this date */}
            <div className="px-4 space-y-3">
              {group.appointments.map((appointment) => {
                const statusInfo = getStatusInfo(appointment.status);
                // Get client name - PRIORITY: client_name (beneficiary) > clients.full_name (account owner) > guest_name
                // client_name es el nombre del BENEFICIARIO de esta cita específica
                const clientName = appointment.client_name || 
                                  appointment.guest_name || 
                                  appointment.clients?.full_name || 
                                  (language === "es" ? "Cliente" : "Client");
                const serviceName = appointment.services?.name || (language === "es" ? "Servicio" : "Service");
                const startTime = formatTime(appointment.start_time, '12h');

                return (
                  <Card
                    key={appointment.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors border-l-4"
                    style={{ borderLeftColor: statusInfo.color }}
                    onClick={() => handleAppointmentClick(appointment)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Time - First line */}
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-semibold text-foreground">
                              {startTime}
                            </span>
                          </div>

                          {/* Client Name - Second line */}
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-base font-medium text-foreground">
                              {clientName}
                            </span>
                          </div>

                          {/* Service Name - Third line */}
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">
                              {serviceName}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <Badge 
                          className="flex-shrink-0"
                          style={{ 
                            backgroundColor: statusInfo.bgColor,
                            color: statusInfo.color,
                            borderColor: statusInfo.color,
                            borderWidth: '1px'
                          }}
                        >
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

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
