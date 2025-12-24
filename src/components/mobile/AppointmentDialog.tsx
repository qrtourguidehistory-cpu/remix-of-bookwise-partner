import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle } from "lucide-react";
import { inviteClientEarly } from "@/lib/earlyInviteService";

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  // Preferred prop name
  timeSlot?: string;
  // Back-compat prop name used by some calendar views
  selectedTime?: string;
  // Optional preselected staff for staff calendar view
  staffId?: string;
  appointment?: any;
  onSuccess?: () => void;
}

export function AppointmentDialog({
  open,
  onOpenChange,
  date,
  timeSlot,
  selectedTime,
  staffId,
  appointment,
  onSuccess,
}: AppointmentDialogProps) {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [availabilityWarning, setAvailabilityWarning] = useState<{
    hasConflicts: boolean;
    conflicts: any[];
    confirmed: boolean;
  }>({ hasConflicts: false, conflicts: [], confirmed: false });
  const [formData, setFormData] = useState<{
    client_id: string;
    service_id: string;
    staff_id: string;
    start_time: string;
    end_time: string;
    notes: string;
    status: "pending" | "confirmed" | "started" | "completed" | "cancelled" | "no_show";
  }>({
    client_id: "",
    service_id: "",
    staff_id: "",
    start_time: timeSlot || selectedTime || "",
    end_time: "",
    notes: "",
    status: "confirmed",
  });

  // Convert 24h format to 12h format (for display)
  const convertTo12Hour = (time24: string): string => {
    if (!time24) return "";
    const match = time24.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (!match) return time24;
    
    const hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    
    return `${displayHours}:${minutes}${period}`;
  };

  useEffect(() => {
    if (open) {
      fetchData();
    } else {
      // Reset form when dialog closes
      setFormData({
        client_id: "",
        service_id: "",
        staff_id: "",
        start_time: "",
        end_time: "",
        notes: "",
        status: "confirmed",
      });
    }
  }, [open, appointment, timeSlot, selectedTime, staffId]);

  const fetchData = async () => {
    if (!profile?.business_id) return;
    
    const [clientsRes, servicesRes, staffRes] = await Promise.all([
      supabase.from("clients").select("*").eq("business_id", profile.business_id).order("full_name"),
      supabase.from("services").select("*").eq("business_id", profile.business_id).eq("is_active", true).order("name"),
      supabase.from("staff").select("*").eq("business_id", profile.business_id).eq("is_active", true).order("full_name"),
    ]);

    const clientsList = clientsRes.data || [];
    setClients(clientsList);

    if (servicesRes.data) setServices(servicesRes.data);
    if (staffRes.data) setStaff(staffRes.data);

    // New appointment - set default values if no appointment exists
    if (open && !appointment) {
      const initialTime = timeSlot || selectedTime || "";
      setFormData({
        client_id: "",
        service_id: "",
        staff_id: staffId || "",
        start_time: initialTime,
        end_time: "",
        notes: "",
        status: "confirmed",
      });
    }
  };
  
  // Separate effect to load appointment data when appointment or lists change
  useEffect(() => {
    if (open && appointment && clients.length > 0 && services.length > 0) {
      // Convert times from 24h to 12h format for display
      const startTime12h = appointment.start_time ? convertTo12Hour(appointment.start_time) : "";
      const endTime12h = appointment.end_time ? convertTo12Hour(appointment.end_time) : "";
      
      // Always set appointment data directly, don't merge with previous
      setFormData({
        client_id: appointment.client_id || "",
        service_id: appointment.service_id || "",
        staff_id: appointment.staff_id || "",
        start_time: startTime12h,
        end_time: endTime12h,
        notes: appointment.notes || "",
        status: appointment.status || "confirmed",
      });
    }
  }, [open, appointment, clients.length, services.length, staff.length]);

  const handleServiceSelect = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      const duration = service.duration_minutes;
      const startTime = formData.start_time;
      
      // Calculate end time based on duration
      const [time, period] = startTime.match(/(\d+:\d+)(am|pm)/i)?.slice(1) || [];
      if (time) {
        const [hours, minutes] = time.split(":").map(Number);
        let totalMinutes = (hours % 12) * 60 + minutes + (period.toLowerCase() === "pm" && hours !== 12 ? 12 * 60 : 0);
        if (period.toLowerCase() === "am" && hours === 12) totalMinutes = minutes;
        
        totalMinutes += duration;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = totalMinutes % 60;
        const endPeriod = endHours >= 12 ? "pm" : "am";
        const displayHours = endHours > 12 ? endHours - 12 : endHours === 0 ? 12 : endHours;
        const endTime = `${displayHours}:${String(endMinutes).padStart(2, "0")}${endPeriod}`;
        
        setFormData({ ...formData, service_id: serviceId, end_time: endTime });
        
        // Re-check availability with new service duration
        if (formData.staff_id) {
          checkStaffAvailability(formData.staff_id, startTime, endTime);
        }
      } else {
        setFormData({ ...formData, service_id: serviceId });
      }
    }
  };

  const checkStaffAvailability = async (
    staffId: string,
    startTime: string,
    endTime: string
  ) => {
    if (!date || !startTime || !endTime) return;

    const appointmentDate = format(date, "yyyy-MM-dd");
    const startTime24 = convertTo24Hour(startTime);
    const endTime24 = convertTo24Hour(endTime);
    const dayOfWeek = date.getDay();

    if (!profile?.business_id) {
      setAvailabilityWarning({ hasConflicts: false, conflicts: [], confirmed: false });
      return;
    }
    
    // Check for appointment conflicts
    const { data, error } = await supabase
      .from("appointments")
      .select("*, clients!appointments_client_id_fkey(full_name), services!appointments_service_id_fkey(name)")
      .eq("business_id", profile.business_id)
      .eq("staff_id", staffId)
      .eq("appointment_date", appointmentDate)
      .neq("status", "cancelled");

    if (error || !data) {
      setAvailabilityWarning({ hasConflicts: false, conflicts: [], confirmed: false });
      return;
    }

    const conflicts = data.filter((apt) => {
      if (appointment && apt.id === appointment.id) return false;
      return timesOverlap(startTime24, endTime24, apt.start_time, apt.end_time);
    });

    // Check for staff break conflicts
    const { data: scheduleData } = await supabase
      .from("staff_schedules")
      .select("*")
      .eq("staff_id", staffId)
      .eq("day_of_week", dayOfWeek)
      .maybeSingle();

    const scheduleWithBreaks = scheduleData as any;
    if (scheduleWithBreaks?.break_start && scheduleWithBreaks?.break_end) {
      const breakConflict = timesOverlap(startTime24, endTime24, scheduleWithBreaks.break_start, scheduleWithBreaks.break_end);
      if (breakConflict) {
        conflicts.push({
          id: "break-conflict",
          start_time: scheduleWithBreaks.break_start,
          end_time: scheduleWithBreaks.break_end,
          clients: { full_name: "⚠️ Break del Personal" },
          services: { name: scheduleWithBreaks.break_notes || "Almuerzo / Break" }
        } as any);
      }
    }

    // Check for early departure conflicts
    const { data: earlyDepartureData } = await supabase
      .from("staff_early_departures")
      .select("*")
      .eq("staff_id", staffId)
      .eq("departure_date", appointmentDate)
      .maybeSingle() as any;

    const earlyDeparture = earlyDepartureData as any;
    if (earlyDeparture && startTime24 >= earlyDeparture.actual_end_time) {
      conflicts.push({
        id: "early-departure-conflict",
        start_time: earlyDeparture.actual_end_time,
        end_time: earlyDeparture.original_end_time,
        clients: { full_name: "⚠️ Salida Temprana" },
        services: { name: `Sale a las ${earlyDeparture.actual_end_time}` }
      } as any);
    }

    setAvailabilityWarning({
      hasConflicts: conflicts.length > 0,
      conflicts,
      confirmed: false,
    });
  };

  const timesOverlap = (
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean => {
    const toMinutes = (time: string) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);

    return s1 < e2 && s2 < e1;
  };

  const handleStaffSelect = (staffId: string) => {
    setFormData((prev) => ({ ...prev, staff_id: staffId }));
    if (formData.start_time && formData.end_time) {
      checkStaffAvailability(staffId, formData.start_time, formData.end_time);
    }
  };

  const handleTimeChange = (field: "start_time" | "end_time", value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    if (field === "start_time" && formData.service_id) {
      const selectedService = services.find((s) => s.id === formData.service_id);
      if (selectedService) {
        const duration = selectedService.duration_minutes;
        const [time, period] = value.match(/(\d+:\d+)(am|pm)/i)?.slice(1) || [];
        if (time) {
          const [hours, minutes] = time.split(":").map(Number);
          let totalMinutes = (hours % 12) * 60 + minutes + (period.toLowerCase() === "pm" && hours !== 12 ? 12 * 60 : 0);
          if (period.toLowerCase() === "am" && hours === 12) totalMinutes = minutes;
          
          totalMinutes += duration;
          const endHours = Math.floor(totalMinutes / 60) % 24;
          const endMinutes = totalMinutes % 60;
          const endPeriod = endHours >= 12 ? "pm" : "am";
          const displayHours = endHours > 12 ? endHours - 12 : endHours === 0 ? 12 : endHours;
          const newEndTime = `${displayHours}:${String(endMinutes).padStart(2, "0")}${endPeriod}`;
          
          setFormData((prev) => ({ ...prev, end_time: newEndTime }));
          if (formData.staff_id) {
            checkStaffAvailability(formData.staff_id, value, newEndTime);
          }
        }
      }
    } else if (field === "end_time" && formData.staff_id && formData.start_time) {
      checkStaffAvailability(formData.staff_id, formData.start_time, value);
    }
  };

  // Convert 12h time format to 24h format (for DB storage)
  const convertTo24Hour = (time12h: string): string => {
    const match = time12h.match(/(\d+):(\d+)\s*(am|pm)/i);
    if (!match) return time12h;
    
    const [, hoursStr, minutesStr, period] = match;
    let hours = parseInt(hoursStr, 10);
    const minutes = minutesStr;
    
    if (period.toLowerCase() === 'pm' && hours !== 12) {
      hours += 12;
    } else if (period.toLowerCase() === 'am' && hours === 12) {
      hours = 0;
    }
    
    return `${String(hours).padStart(2, '0')}:${minutes}:00`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.client_id) {
      toast({
        title: "Error",
        description: language === "es" ? "Por favor selecciona un cliente" : "Please select a client",
        variant: "destructive",
      });
      return;
    }
    if (!formData.service_id) {
      toast({
        title: "Error",
        description: language === "es" ? "Por favor selecciona un servicio" : "Please select a service",
        variant: "destructive",
      });
      return;
    }
    if (!formData.staff_id) {
      toast({
        title: "Error",
        description: language === "es" ? "Por favor selecciona un miembro del personal" : "Please select a staff member",
        variant: "destructive",
      });
      return;
    }
    if (!formData.start_time || !formData.end_time) {
      toast({
        title: "Error",
        description: language === "es" ? "Por favor completa las horas de inicio y fin" : "Please complete start and end times",
        variant: "destructive",
      });
      return;
    }

    // Check if there are conflicts and user hasn't confirmed
    if (availabilityWarning.hasConflicts && !availabilityWarning.confirmed) {
      toast({
        title: "Confirma la acción",
        description: "Por favor confirma que deseas crear esta cita a pesar del conflicto de horario",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      // Get service price
      const selectedService = services.find(s => s.id === formData.service_id);
      const servicePrice = selectedService?.price || 0;

      // Convert times to 24h format before saving to DB
      const startTime24 = convertTo24Hour(formData.start_time);
      // Ensure end_time is calculated if not provided or invalid
      let endTime24 = convertTo24Hour(formData.end_time);
      if (!endTime24 || endTime24 === startTime24) {
        // Calculate end_time from service duration
        const duration = selectedService?.duration_minutes || 30;
        const { calculateEndTime } = await import('@/lib/dynamicTimeUtils');
        endTime24 = calculateEndTime(startTime24, duration);
      }

      const appointmentData: any = {
        client_id: formData.client_id,
        service_id: formData.service_id,
        staff_id: formData.staff_id,
        date: format(date, "yyyy-MM-dd"),
        appointment_date: format(date, "yyyy-MM-dd"),
        start_time: startTime24,
        end_time: endTime24,
        notes: formData.notes,
        status: formData.status,
        payment_amount: servicePrice,
      };

      // Add business_id only when creating new appointment
      if (!appointment && profile?.business_id) {
        appointmentData.business_id = profile.business_id;
      }

      if (appointment) {
        if (!profile?.business_id) {
          throw new Error("Business ID is required");
        }
        
        const { error } = await supabase
          .from("appointments")
          .update(appointmentData)
          .eq("id", appointment.id)
          .eq("business_id", profile.business_id);

        if (error) throw error;

        toast({
          title: t("success") || "Success",
          description: language === "es" ? "Cita actualizada exitosamente" : "Appointment updated successfully",
        });
      } else {
        const { data: newAppointment, error } = await supabase
          .from("appointments")
          .insert(appointmentData)
          .select()
          .single();

        if (error) throw error;

        // Send notifications if appointment is confirmed
        if (formData.status === 'confirmed' && newAppointment) {
          const { sendNotificationToClient, scheduleNotification } = await import('@/lib/notificationService');
          
          // Get client info
          const selectedClient = clients.find(c => c.id === formData.client_id);
          
          await sendNotificationToClient({
            appointmentId: newAppointment.id,
            clientId: newAppointment.client_id,
            clientEmail: selectedClient?.email,
            clientPhone: selectedClient?.phone,
            clientName: selectedClient?.full_name,
            type: 'confirmation',
            appointmentDate: format(date, "yyyy-MM-dd"),
            appointmentTime: convertTo24Hour(formData.start_time),
            businessId: profile.business_id || '',
          });

          // Schedule reminder 10 minutes before
          const appointmentDateTime = new Date(`${format(date, "yyyy-MM-dd")}T${convertTo24Hour(formData.start_time)}`);
          const reminderTime = new Date(appointmentDateTime.getTime() - 10 * 60 * 1000);
          
          if (reminderTime > new Date()) {
            await scheduleNotification(
              newAppointment.id,
              reminderTime,
              'reminder',
              profile.business_id || '',
              {
                clientId: newAppointment.client_id,
                clientEmail: selectedClient?.email,
                clientPhone: selectedClient?.phone,
                clientName: selectedClient?.full_name,
              }
            );
          }
        }

        toast({
          title: t("success") || "Success",
          description: language === "es" ? "Cita creada exitosamente" : "Appointment created successfully",
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving appointment:", error);
      toast({
        title: "Error",
        description: language === "es" ? "Error al guardar la cita" : "Failed to save appointment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!appointment) return;

    if (!confirm(language === "es" ? "¿Estás seguro de que deseas eliminar esta cita?" : "Are you sure you want to delete this appointment?")) {
      return;
    }

    setLoading(true);
    try {
      if (!profile?.business_id) {
        throw new Error("Business ID is required");
      }
      
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", appointment.id)
        .eq("business_id", profile.business_id);

      if (error) throw error;

      toast({
        title: t("success") || "Success",
        description: language === "es" ? "Cita eliminada exitosamente" : "Appointment deleted successfully",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error deleting appointment:", error);
      toast({
        title: "Error",
        description: language === "es" ? "Error al eliminar la cita" : "Failed to delete appointment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEarlyInvite = async () => {
    if (!appointment || !profile?.business_id || !appointment.staff_id) return;

    setLoading(true);

    try {
      const result = await inviteClientEarly({
        appointmentId: appointment.id,
        businessId: profile.business_id,
        staffId: appointment.staff_id,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to send early invitation");
      }

      toast({
        title: language === "es" ? "Invitación enviada" : "Invitation sent",
        description: language === "es"
          ? "Se ha notificado al cliente que puede asistir antes de lo previsto"
          : "Client has been notified they can attend early",
      });

      // Refresh appointment data to show early_invited status
      onSuccess?.();
    } catch (error: any) {
      console.error("Error sending early invitation:", error);
      toast({
        title: "Error",
        description: error.message || (language === "es" ? "Error al enviar invitación" : "Failed to send invitation"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (
    newStatus: "pending" | "confirmed" | "started" | "completed" | "cancelled" | "no_show"
  ) => {
    if (!appointment) return;

    setLoading(true);

    try {
      if (!profile?.business_id) {
        throw new Error("Business ID is required");
      }
      
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", appointment.id)
        .eq("business_id", profile.business_id);

      if (error) throw error;

      const statusLabels: Record<string, string> = {
        confirmed: language === "es" ? "confirmada" : "confirmed",
        started: language === "es" ? "iniciada" : "started",
        completed: language === "es" ? "completada" : "completed",
        cancelled: language === "es" ? "cancelada" : "cancelled",
      };

      toast({
        title: language === "es" ? "Estado actualizado" : "Status updated",
        description: language === "es" 
          ? `La cita ha sido ${statusLabels[newStatus] || "actualizada"}`
          : `Appointment has been ${statusLabels[newStatus] || "updated"}`,
      });
      
      setFormData(prev => ({ ...prev, status: newStatus }));
      
      // Note: Notification to next client is handled automatically by database trigger
      // when status changes to "started" - no need to call from frontend
      
      onSuccess?.();
    } catch (error) {
      console.error("Error updating appointment status:", error);
      toast({
        title: "Error",
        description: language === "es" ? "Hubo un error al actualizar el estado" : "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-t border-border h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>
            {appointment
              ? language === "es"
                ? "Editar Cita"
                : "Edit Appointment"
              : language === "es"
              ? "Nueva Cita"
              : "New Appointment"}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {date ? format(date, "EEEE, MMMM d, yyyy") : ""} {timeSlot ? `- ${timeSlot}` : ""}
          </p>
        </SheetHeader>

        {/* Quick Actions for existing appointments */}
        {appointment && (
          <div className="mb-6 p-4 bg-muted/20 rounded-lg border border-border/50">
            <div className="text-sm font-medium mb-3">
              {language === "es" ? "Acciones Rápidas" : "Quick Actions"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction("confirmed")}
                disabled={loading || appointment?.status === "confirmed"}
                className="bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-300"
              >
                ✓ {language === "es" ? "Confirmar" : "Confirm"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleEarlyInvite}
                disabled={loading || appointment?.early_invited || !["pending", "confirmed"].includes(appointment?.status || "")}
                className="bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-700 dark:text-purple-300"
              >
                ⏰ {language === "es" ? "Puede asistir" : "Can attend early"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction("started")}
                disabled={loading || appointment?.status === "started"}
                className="bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30 text-orange-700 dark:text-orange-300"
              >
                ▶ {language === "es" ? "Iniciar" : "Start"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction("completed")}
                disabled={loading || appointment?.status === "completed"}
                className="bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-700 dark:text-blue-300"
              >
                ✓ {language === "es" ? "Completar" : "Complete"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction("cancelled")}
                disabled={loading || appointment?.status === "cancelled"}
                className="bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-700 dark:text-red-300"
              >
                ❌ {language === "es" ? "Cancelar" : "Cancel"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={loading}
                className="bg-destructive/10 hover:bg-destructive/20 border-destructive/30"
              >
                🗑️ {language === "es" ? "Eliminar" : "Delete"}
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">
              {language === "es" ? "Estado actual: " : "Current status: "}
              <span className="font-medium">{
                appointment?.status === "confirmed" ? (language === "es" ? "Confirmada" : "Confirmed") :
                appointment?.status === "started" ? (language === "es" ? "Iniciada" : "Started") :
                appointment?.status === "completed" ? (language === "es" ? "Completada" : "Completed") :
                appointment?.status === "cancelled" ? (language === "es" ? "Cancelada" : "Cancelled") :
                appointment?.status === "no_show" ? (language === "es" ? "No Asistió" : "No Show") :
                (language === "es" ? "Pendiente" : "Pending")
              }</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>
                {t("selectClient") || "Client"} <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const clientData = {
                      id: crypto.randomUUID(),
                      full_name: language === "es" ? "Cliente Sin Cita" : "Walk-in Client",
                      email: `walk-in-${Date.now()}@temp.com`,
                      phone: "",
                    };
                    
                    if (!profile?.business_id) {
                      throw new Error("Business ID is required");
                    }
                    
                    const { error } = await supabase
                      .from("clients")
                      .insert([{ ...clientData, business_id: profile.business_id }]);
                    
                    if (error) throw error;
                    
                    // Refresh client list
                    await fetchData();
                    
                    toast({
                      title: t("success") || "Success",
                      description: language === "es" ? "Cliente walk-in creado. Selecciónalo de la lista." : "Walk-in client created. Select it from the list.",
                    });
                  } catch (error) {
                    console.error("Error creating walk-in client:", error);
                    toast({
                      title: "Error",
                      description: language === "es" ? "Error al crear cliente" : "Failed to create client",
                      variant: "destructive",
                    });
                  }
                }}
              >
                + {language === "es" ? "Walk-in" : "Walk-in"}
              </Button>
            </div>
            <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value })}>
              <SelectTrigger className={`${!formData.client_id ? 'border-destructive/50' : ''}`}>
                <SelectValue placeholder={language === "es" ? "Seleccionar cliente..." : "Select client..."} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>
              {t("selectService") || "Service"} <span className="text-destructive">*</span>
            </Label>
            <Select value={formData.service_id} onValueChange={handleServiceSelect}>
              <SelectTrigger className={`mt-2 ${!formData.service_id ? 'border-destructive/50' : ''}`}>
                <SelectValue placeholder={language === "es" ? "Seleccionar servicio..." : "Select service..."} />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} - {service.duration_minutes} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>
              {language === "es" ? "Seleccionar Personal" : "Select Staff"} <span className="text-destructive">*</span>
            </Label>
            <Select value={formData.staff_id} onValueChange={handleStaffSelect}>
              <SelectTrigger className={`mt-2 ${!formData.staff_id ? 'border-destructive/50' : ''}`}>
                <SelectValue placeholder={language === "es" ? "Seleccionar personal..." : "Select staff..."} />
              </SelectTrigger>
              <SelectContent>
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Availability Warning */}
          {availabilityWarning.hasConflicts && (
            <Alert className="bg-yellow-500/10 border-yellow-500/50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm">
                <div className="font-semibold mb-2">
                  ⚠️ {language === "es" 
                    ? `Este personal ya tiene ${availabilityWarning.conflicts.length} cita(s) en este horario:` 
                    : `This staff member already has ${availabilityWarning.conflicts.length} appointment(s) at this time:`}
                </div>
                <ul className="space-y-1 mb-3">
                  {availabilityWarning.conflicts.slice(0, 3).map((conflict) => (
                    <li key={conflict.id} className="text-xs">
                      • {conflict.start_time} - {conflict.end_time}: {conflict.clients?.full_name || "Cliente"} ({conflict.services?.name || "Servicio"})
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="confirm-conflict"
                    checked={availabilityWarning.confirmed}
                    onChange={(e) =>
                      setAvailabilityWarning((prev) => ({
                        ...prev,
                        confirmed: e.target.checked,
                      }))
                    }
                    className="rounded"
                  />
                  <label htmlFor="confirm-conflict" className="text-xs cursor-pointer">
                    {language === "es" 
                      ? "Confirmo que quiero crear esta cita de todas formas"
                      : "I confirm I want to create this appointment anyway"}
                  </label>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>
                {language === "es" ? "Hora Inicio" : "Start Time"} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.start_time}
                onChange={(e) => handleTimeChange("start_time", e.target.value)}
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label>
                {language === "es" ? "Hora Fin" : "End Time"} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.end_time}
                onChange={(e) => handleTimeChange("end_time", e.target.value)}
                className="mt-2"
                required
              />
            </div>
          </div>

          <div>
            <Label>{language === "es" ? "Estado" : "Status"}</Label>
            <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value as "pending" | "confirmed" | "completed" | "cancelled" | "no_show" })}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{language === "es" ? "Pendiente" : "Pending"}</SelectItem>
                <SelectItem value="confirmed">{language === "es" ? "Confirmada" : "Confirmed"}</SelectItem>
                <SelectItem value="completed">{language === "es" ? "Completada" : "Completed"}</SelectItem>
                <SelectItem value="cancelled">{language === "es" ? "Cancelada" : "Cancelled"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t("notes") || "Notes"}</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="mt-2"
              rows={3}
              placeholder={language === "es" ? "Notas adicionales..." : "Additional notes..."}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? t("loading") || "Loading..." : appointment ? (language === "es" ? "Actualizar" : "Update") : (t("save") || "Save")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
