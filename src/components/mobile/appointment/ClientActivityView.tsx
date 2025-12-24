import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { X, Calendar, Clock, DollarSign, TrendingUp, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface AppointmentActivity {
  id: string;
  appointment_date: string | null;
  start_time: string | null;
  status: string;
  payment_method: string | null;
  payment_amount: number | null;
  services: {
    name: string;
    price: number | null;
  } | null;
  staff: {
    full_name: string | null;
  } | null;
  created_at: string;
}

interface ClientActivityViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  userId: string | null;
  businessId: string;
  clientName?: string;
}

export function ClientActivityView({
  open,
  onOpenChange,
  clientId,
  userId,
  businessId,
  clientName,
}: ClientActivityViewProps) {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const [activities, setActivities] = useState<AppointmentActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalAppointments: 0,
    completedAppointments: 0,
    totalSpent: 0,
    averageSpent: 0,
    lastAppointment: null as string | null,
  });

  useEffect(() => {
    if (open && businessId && (clientId || userId)) {
      fetchActivity();
    }
  }, [open, clientId, userId, businessId]);

  const fetchActivity = async () => {
    setLoading(true);
    try {
      let query = (supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          start_time,
          status,
          payment_method,
          payment_amount,
          created_at,
          services!appointments_service_id_fkey(name, price),
          staff!appointments_staff_id_fkey(full_name)
        `)
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(50) as any);

      // Filter by client_id or user_id
      if (clientId) {
        query = query.eq("client_id", clientId);
      } else if (userId) {
        // Try to find client_id from user_id
        const { data: clientData } = await supabase
          .from("clients")
          .select("id")
          .eq("user_id", userId)
          .eq("business_id", businessId)
          .maybeSingle();

        if (clientData) {
          query = query.eq("client_id", clientData.id);
        } else {
          // If no client record, try to match by user_id in appointments
          query = query.eq("user_id", userId);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      const appointments = (data || []) as AppointmentActivity[];
      setActivities(appointments);

      // Calculate statistics
      const completed = appointments.filter(
        (apt) => apt.status === "completed"
      );
      const totalSpent = completed.reduce((sum, apt) => {
        return sum + (apt.payment_amount || apt.services?.price || 0);
      }, 0);

      setStats({
        totalAppointments: appointments.length,
        completedAppointments: completed.length,
        totalSpent,
        averageSpent: completed.length > 0 ? totalSpent / completed.length : 0,
        lastAppointment:
          appointments.length > 0 ? appointments[0].created_at : null,
      });
    } catch (error: any) {
      console.error("Error fetching activity:", error);
      toast.error(
        language === "es"
          ? "Error al cargar actividad"
          : "Error loading activity"
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "confirmed":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "cancelled":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      case "no_show":
        return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
      case "started":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
      default:
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { es: string; en: string }> = {
      completed: { es: "Completada", en: "Completed" },
      confirmed: { es: "Confirmada", en: "Confirmed" },
      cancelled: { es: "Cancelada", en: "Cancelled" },
      no_show: { es: "No-show", en: "No-show" },
      started: { es: "Iniciada", en: "Started" },
      pending: { es: "Pendiente", en: "Pending" },
    };
    return labels[status]?.[language] || status;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(parseISO(dateStr), language === "es" ? "d MMM yyyy" : "MMM d, yyyy", {
        locale: language === "es" ? es : undefined,
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "-";
    // Handle both "HH:MM:SS" and "HH:MM" formats
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours, 10);
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-t border-border h-[90vh] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between mb-4">
            <SheetTitle>
              {language === "es" ? "Actividad del Cliente" : "Client Activity"}
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        {clientName && (
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{clientName}</span>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === "es" ? "Total Citas" : "Total Appointments"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAppointments}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === "es" ? "Completadas" : "Completed"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedAppointments}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === "es" ? "Total Gastado" : "Total Spent"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                DOP {stats.totalSpent.toFixed(0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === "es" ? "Promedio" : "Average"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                DOP {stats.averageSpent.toFixed(0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity List */}
        <div>
          <h3 className="text-sm font-semibold mb-3">
            {language === "es" ? "Historial de Citas" : "Appointment History"}
          </h3>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "es" ? "Cargando..." : "Loading..."}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "es"
                ? "No hay citas registradas"
                : "No appointments found"}
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <Card key={activity.id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base mb-1">
                          {activity.services?.name || language === "es" ? "Servicio" : "Service"}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {formatDate(activity.appointment_date)}
                          </span>
                          {activity.start_time && (
                            <>
                              <Clock className="h-3 w-3 ml-2" />
                              <span>{formatTime(activity.start_time)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge className={getStatusColor(activity.status)}>
                        {getStatusLabel(activity.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        {activity.staff?.full_name && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{activity.staff.full_name}</span>
                          </div>
                        )}
                        {activity.payment_amount && activity.payment_amount > 0 && (
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <DollarSign className="h-3 w-3" />
                            <span>DOP {activity.payment_amount.toFixed(0)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

