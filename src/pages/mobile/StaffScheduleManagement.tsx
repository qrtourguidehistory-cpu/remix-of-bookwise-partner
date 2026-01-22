import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRealtimeEarlyDepartures } from "@/hooks/useRealtimeEarlyDepartures";

const daysOfWeek = [
  { value: 0, label: "Domingo", labelEn: "Sunday", short: "Dom", shortEn: "Sun" },
  { value: 1, label: "Lunes", labelEn: "Monday", short: "Lun", shortEn: "Mon" },
  { value: 2, label: "Martes", labelEn: "Tuesday", short: "Mar", shortEn: "Tue" },
  { value: 3, label: "Miércoles", labelEn: "Wednesday", short: "Mié", shortEn: "Wed" },
  { value: 4, label: "Jueves", labelEn: "Thursday", short: "Jue", shortEn: "Thu" },
  { value: 5, label: "Viernes", labelEn: "Friday", short: "Vie", shortEn: "Fri" },
  { value: 6, label: "Sábado", labelEn: "Saturday", short: "Sáb", shortEn: "Sat" },
];

export default function StaffScheduleManagement() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [timeOff, setTimeOff] = useState<any[]>([]);
  const [newSchedule, setNewSchedule] = useState({
    day_of_week: "",
    start_time: "",
    end_time: "",
    break_start: "",
    break_end: "",
    break_notes: "",
  });
  const [earlyDepartures, setEarlyDepartures] = useState<any[]>([]);
  const [newEarlyDeparture, setNewEarlyDeparture] = useState({
    date: undefined as Date | undefined,
    departure_time: "",
    reason: "",
  });
  const [newTimeOff, setNewTimeOff] = useState({
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    reason: "",
    time_off_type: "vacation" as "vacation" | "sick" | "personal" | "break"
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    if (selectedStaff) {
      fetchSchedules();
      fetchTimeOff();
      fetchEarlyDepartures();
    }
  }, [selectedStaff]);

  // Suscripción realtime para salidas anticipadas
  useRealtimeEarlyDepartures(() => {
    if (selectedStaff) {
      fetchEarlyDepartures();
    }
  });

  const fetchStaff = async () => {
    if (!profile?.business_id) return;
    
    const { data } = await supabase
      .from("staff")
      .select("*")
      .eq("business_id", profile.business_id)
      .eq("is_active", true)
      .order("full_name");
    if (data) setStaff(data);
  };

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from("staff_schedules")
      .select("*")
      .eq("staff_id", selectedStaff)
      .order("day_of_week");
    if (data) setSchedules(data);
  };

  const fetchTimeOff = async () => {
    const { data } = await supabase
      .from("staff_time_off")
      .select("*")
      .eq("staff_id", selectedStaff)
      .order("start_date", { ascending: false });
    if (data) setTimeOff(data);
  };

  const fetchEarlyDepartures = async () => {
    const { data } = await supabase
      .from("staff_early_departures")
      .select("*")
      .eq("staff_id", selectedStaff)
      .order("departure_date", { ascending: false });
    if (data) setEarlyDepartures(data);
  };

  const handleAddSchedule = async () => {
    if (!selectedStaff || !newSchedule.day_of_week || !newSchedule.start_time || !newSchedule.end_time) {
      toast.error(language === "es" ? "Complete todos los campos" : "Fill all fields");
      return;
    }

    if (!profile?.business_id) {
      toast.error(language === "es" ? "Business ID no encontrado" : "Business ID not found");
      return;
    }

    // Validar que start_time < end_time
    if (newSchedule.start_time >= newSchedule.end_time) {
      toast.error(language === "es" ? "La hora de inicio debe ser antes de la hora de fin" : "Start time must be before end time");
      return;
    }

    // Validate break times if provided
    if (newSchedule.break_start && newSchedule.break_end) {
      if (newSchedule.break_start >= newSchedule.break_end) {
        toast.error(language === "es" ? "La hora de inicio del break debe ser antes de la hora de fin" : "Break start must be before break end");
        return;
      }
      if (newSchedule.break_start < newSchedule.start_time || newSchedule.break_end > newSchedule.end_time) {
        toast.error(language === "es" ? "El break debe estar dentro del horario laboral" : "Break must be within work hours");
        return;
      }
    }

    // Verificar si ya existe un horario para este día
    const { data: existingSchedule } = await supabase
      .from("staff_schedules")
      .select("id")
      .eq("staff_id", selectedStaff)
      .eq("day_of_week", parseInt(newSchedule.day_of_week))
      .maybeSingle();

    if (existingSchedule) {
      toast.error(
        language === "es" 
          ? `Ya existe un horario para ${daysOfWeek.find(d => d.value.toString() === newSchedule.day_of_week)?.label}. Elimine el existente primero.`
          : `A schedule already exists for ${daysOfWeek.find(d => d.value.toString() === newSchedule.day_of_week)?.label}. Delete the existing one first.`
      );
      return;
    }

    const { error, data } = await supabase.from("staff_schedules").insert({
      staff_id: selectedStaff,
      business_id: profile.business_id, // CRÍTICO: Agregar business_id para RLS
      day_of_week: parseInt(newSchedule.day_of_week),
      start_time: newSchedule.start_time,
      end_time: newSchedule.end_time,
      break_start: newSchedule.break_start || null,
      break_end: newSchedule.break_end || null,
      break_notes: newSchedule.break_notes || null,
      is_available: true,
    }).select();

    if (!error) {
      toast.success(language === "es" ? "Horario agregado exitosamente" : "Schedule added successfully");
      setNewSchedule({ day_of_week: "", start_time: "", end_time: "", break_start: "", break_end: "", break_notes: "" });
      fetchSchedules();
    } else {
      console.error("Error adding schedule:", error);
      toast.error(
        language === "es" 
          ? `Error al agregar horario: ${error.message || "Error desconocido"}` 
          : `Error adding schedule: ${error.message || "Unknown error"}`
      );
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!profile?.business_id) {
      toast.error(language === "es" ? "Business ID no encontrado" : "Business ID not found");
      return;
    }

    const { error } = await supabase
      .from("staff_schedules")
      .delete()
      .eq("id", id)
      .eq("business_id", profile.business_id); // Asegurar que solo se eliminen horarios del negocio correcto

    if (!error) {
      toast.success(language === "es" ? "Horario eliminado exitosamente" : "Schedule deleted successfully");
      fetchSchedules();
    } else {
      console.error("Error deleting schedule:", error);
      toast.error(
        language === "es" 
          ? `Error al eliminar horario: ${error.message || "Error desconocido"}` 
          : `Error deleting schedule: ${error.message || "Unknown error"}`
      );
    }
  };

  const handleAddTimeOff = async () => {
    if (!selectedStaff || !newTimeOff.start_date || !newTimeOff.end_date) {
      toast.error(language === "es" ? "Seleccione las fechas" : "Select dates");
      return;
    }

    const { error } = await supabase.from("staff_time_off").insert({
      staff_id: selectedStaff,
      start_date: format(newTimeOff.start_date, "yyyy-MM-dd"),
      end_date: format(newTimeOff.end_date, "yyyy-MM-dd"),
      reason: newTimeOff.reason,
      time_off_type: newTimeOff.time_off_type
    });

    if (!error) {
      toast.success(language === "es" ? "Tiempo libre agregado" : "Time off added");
      setNewTimeOff({ start_date: undefined, end_date: undefined, reason: "", time_off_type: "vacation" });
      fetchTimeOff();
    } else {
      toast.error("Error adding time off");
    }
  };

  const handleDeleteTimeOff = async (id: string) => {
    const { error } = await supabase
      .from("staff_time_off")
      .delete()
      .eq("id", id);

    if (!error) {
      toast.success(language === "es" ? "Tiempo libre eliminado" : "Time off deleted");
      fetchTimeOff();
    }
  };

  const handleAddEarlyDeparture = async () => {
    if (!selectedStaff || !newEarlyDeparture.date || !newEarlyDeparture.departure_time) {
      toast.error(language === "es" ? "Complete todos los campos" : "Fill all fields");
      return;
    }

    if (!profile?.business_id) {
      toast.error(language === "es" ? "Business ID no encontrado" : "Business ID not found");
      return;
    }

    const { error } = await supabase.from("staff_early_departures").insert({
      staff_id: selectedStaff,
      business_id: profile.business_id,
      date: format(newEarlyDeparture.date, "yyyy-MM-dd"),
      departure_time: newEarlyDeparture.departure_time,
      reason: newEarlyDeparture.reason || null,
    });

    if (!error) {
      toast.success(language === "es" ? "Salida anticipada registrada" : "Early departure recorded");
      setNewEarlyDeparture({ date: undefined, departure_time: "", reason: "" });
      fetchEarlyDepartures();
      
      // Detectar y actualizar citas afectadas
      await handleAffectedAppointments(selectedStaff, format(newEarlyDeparture.date, "yyyy-MM-dd"), newEarlyDeparture.departure_time);
    } else {
      console.error("Error recording early departure:", error);
      toast.error(language === "es" ? "Error al registrar salida anticipada" : "Error recording early departure");
    }
  };

  // Detectar citas afectadas y cambiarlas a pending_reschedule
  const handleAffectedAppointments = async (staffId: string, date: string, departureTime: string) => {
    try {
      // Buscar citas del staff en esa fecha que empiezan después de la hora de salida
      const { data: affectedAppointments, error } = await supabase
        .from("appointments")
        .select("*, clients!appointments_client_id_fkey(full_name, email)")
        .eq("staff_id", staffId)
        .eq("appointment_date", date)
        .in("status", ["pending", "confirmed"])
        .gte("start_time", departureTime);

      if (error) {
        console.error("Error fetching affected appointments:", error);
        return;
      }

      if (!affectedAppointments || affectedAppointments.length === 0) {
        return; // No hay citas afectadas
      }

      // Actualizar status a pending_reschedule
      const appointmentIds = affectedAppointments.map(apt => apt.id);
      
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ status: "pending_reschedule" })
        .in("id", appointmentIds);

      if (updateError) {
        console.error("Error updating appointments:", updateError);
        return;
      }

      // Crear notificaciones para cada cliente afectado usando Edge Function
      for (const appointment of affectedAppointments) {
        const client = appointment.clients;
        if (client && client.user_id && profile?.business_id) {
          // ✅ Usar Edge Function send-push-notification con role='cliente'
          try {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                role: 'cliente', // ⭐ IMPORTANTE: Especificar que es para cliente
                business_id: profile.business_id,
                user_id: client.user_id,
                client_id: appointment.client_id,
                appointment_id: appointment.id,
                type: 'status_change',
                title: language === "es" 
                  ? "Cita necesita re-agendamiento" 
                  : "Appointment needs rescheduling",
                message: language === "es"
                  ? "Tu profesional ha tenido un imprevisto. Por favor, elige una nueva hora para tu cita."
                  : "Your professional has had an unexpected event. Please choose a new time for your appointment.",
                meta: { requires_reschedule: true },
              },
            });
          } catch (err) {
            console.error("Error creating notification via Edge Function:", err);
            // Continuar sin crear notificación si falla
          }
        }
      }

      toast.success(
        language === "es" 
          ? `${affectedAppointments.length} cita(s) marcada(s) para re-agendamiento`
          : `${affectedAppointments.length} appointment(s) marked for rescheduling`
      );
    } catch (error) {
      console.error("Error handling affected appointments:", error);
    }
  };

  const handleDeleteEarlyDeparture = async (id: string) => {
    const { error } = await supabase
      .from("staff_early_departures")
      .delete()
      .eq("id", id);

    if (!error) {
      toast.success(language === "es" ? "Salida temprana eliminada" : "Early departure deleted");
      fetchEarlyDepartures();
    }
  };

  const calculateTimeDifference = (time1: string, time2: string): string => {
    const [h1, m1] = time1.split(":").map(Number);
    const [h2, m2] = time2.split(":").map(Number);
    const totalMinutes = Math.abs((h1 * 60 + m1) - (h2 * 60 + m2));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
  };

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            {language === "es" ? "Gestión de Horarios" : "Schedule Management"}
          </h1>
        </div>

        <div className="mb-6">
          <Label>{language === "es" ? "Seleccionar Personal" : "Select Staff"}</Label>
          <Select value={selectedStaff} onValueChange={setSelectedStaff}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder={language === "es" ? "Seleccionar..." : "Select..."} />
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

        {selectedStaff && (
          <div className="space-y-6">
            {/* Regular Schedule */}
            <Card>
              <CardHeader>
                <CardTitle>{language === "es" ? "Horario Regular" : "Regular Schedule"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label>{language === "es" ? "Día de la Semana" : "Day of Week"}</Label>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {daysOfWeek.map((day) => {
                        const isSelected = newSchedule.day_of_week === day.value.toString();
                        const displayLabel = language === "es" ? day.short : day.shortEn;
                        const fullLabel = language === "es" ? day.label : day.labelEn;
                        return (
                          <Button
                            key={day.value}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            onClick={() => setNewSchedule({ ...newSchedule, day_of_week: day.value.toString() })}
                            className="flex flex-col items-center justify-center h-16 p-2"
                            title={fullLabel}
                          >
                            <span className="text-xs font-semibold">{displayLabel}</span>
                            <span className="text-[10px] opacity-70">{fullLabel.substring(0, 3)}</span>
                          </Button>
                        );
                      })}
                    </div>
                    {newSchedule.day_of_week && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {language === "es" ? "Seleccionado: " : "Selected: "}
                        <span className="font-semibold">
                          {language === "es" 
                            ? daysOfWeek.find(d => d.value.toString() === newSchedule.day_of_week)?.label
                            : daysOfWeek.find(d => d.value.toString() === newSchedule.day_of_week)?.labelEn}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{language === "es" ? "Hora Inicio" : "Start Time"}</Label>
                      <Input
                        type="time"
                        value={newSchedule.start_time}
                        onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>{language === "es" ? "Hora Fin" : "End Time"}</Label>
                      <Input
                        type="time"
                        value={newSchedule.end_time}
                        onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{language === "es" ? "Break Inicio (Opcional)" : "Break Start (Optional)"}</Label>
                      <Input
                        type="time"
                        value={newSchedule.break_start}
                        onChange={(e) => setNewSchedule({ ...newSchedule, break_start: e.target.value })}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>{language === "es" ? "Break Fin (Opcional)" : "Break End (Optional)"}</Label>
                      <Input
                        type="time"
                        value={newSchedule.break_end}
                        onChange={(e) => setNewSchedule({ ...newSchedule, break_end: e.target.value })}
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{language === "es" ? "Nota del Break (Opcional)" : "Break Note (Optional)"}</Label>
                    <Input
                      placeholder={language === "es" ? "Ej: Almuerzo, Break corto" : "E.g: Lunch, Short break"}
                      value={newSchedule.break_notes}
                      onChange={(e) => setNewSchedule({ ...newSchedule, break_notes: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <Button onClick={handleAddSchedule} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    {language === "es" ? "Agregar Horario" : "Add Schedule"}
                  </Button>
                </div>

                <div className="space-y-2">
                  {schedules.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4 text-sm">
                      {language === "es" 
                        ? "No hay horarios configurados. Agregue uno usando el formulario arriba." 
                        : "No schedules configured. Add one using the form above."}
                    </p>
                  ) : (
                    schedules.map((schedule) => (
                      <div key={schedule.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">
                            {language === "es" 
                              ? daysOfWeek.find((d) => d.value === schedule.day_of_week)?.label
                              : daysOfWeek.find((d) => d.value === schedule.day_of_week)?.labelEn}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {schedule.start_time} - {schedule.end_time}
                          </p>
                          {schedule.break_start && schedule.break_end && (
                            <Badge variant="outline" className="mt-1 bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30">
                              🍽️ {language === "es" ? "Break" : "Break"}: {schedule.break_start} - {schedule.break_end}
                              {schedule.break_notes && ` (${schedule.break_notes})`}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          title={language === "es" ? "Eliminar horario" : "Delete schedule"}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Early Departures */}
            <Card>
              <CardHeader>
                <CardTitle>{language === "es" ? "Salidas Tempranas" : "Early Departures"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label>{language === "es" ? "Fecha" : "Date"}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left mt-2">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newEarlyDeparture.date ? format(newEarlyDeparture.date, "MMM d, yyyy") : "Seleccionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newEarlyDeparture.date}
                          onSelect={(date) => setNewEarlyDeparture({ ...newEarlyDeparture, date })}
                          className="rounded-md border"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>{language === "es" ? "Hora de Salida Anticipada" : "Early Departure Time"}</Label>
                    <Input
                      type="time"
                      value={newEarlyDeparture.departure_time}
                      onChange={(e) => setNewEarlyDeparture({ ...newEarlyDeparture, departure_time: e.target.value })}
                      className="mt-2"
                      placeholder={language === "es" ? "Ej: 15:00" : "E.g: 15:00"}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === "es" 
                        ? "Los slots después de esta hora desaparecerán automáticamente"
                        : "Slots after this time will automatically disappear"}
                    </p>
                  </div>
                  <div>
                    <Label>{language === "es" ? "Razón" : "Reason"}</Label>
                    <Textarea
                      value={newEarlyDeparture.reason}
                      onChange={(e) => setNewEarlyDeparture({ ...newEarlyDeparture, reason: e.target.value })}
                      className="mt-2"
                      placeholder={language === "es" ? "Ej: Cita médica, emergencia familiar..." : "E.g: Medical appointment, family emergency..."}
                    />
                  </div>
                  <Button onClick={handleAddEarlyDeparture} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    {language === "es" ? "Registrar Salida Temprana" : "Record Early Departure"}
                  </Button>
                </div>
                <div className="space-y-2">
                  {earlyDepartures.map((departure) => (
                    <div key={departure.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">
                          {format(new Date(departure.date), "MMM d, yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {language === "es" ? "Sale a las" : "Leaves at"}: <span className="font-semibold text-orange-600 dark:text-orange-400">{departure.departure_time}</span>
                        </p>
                        {departure.reason && (
                          <p className="text-sm mt-1 text-muted-foreground">{departure.reason}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteEarlyDeparture(departure.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Time Off */}
            <Card>
              <CardHeader>
                <CardTitle>{language === "es" ? "Días Libres / Vacaciones" : "Time Off / Vacation"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{language === "es" ? "Fecha Inicio" : "Start Date"}</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left mt-2">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newTimeOff.start_date ? format(newTimeOff.start_date, "MMM d, yyyy") : "Seleccionar"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={newTimeOff.start_date}
                            onSelect={(date) => setNewTimeOff({ ...newTimeOff, start_date: date })}
                            className="rounded-md border"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label>{language === "es" ? "Fecha Fin" : "End Date"}</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left mt-2">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newTimeOff.end_date ? format(newTimeOff.end_date, "MMM d, yyyy") : "Seleccionar"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={newTimeOff.end_date}
                            onSelect={(date) => setNewTimeOff({ ...newTimeOff, end_date: date })}
                            className="rounded-md border"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div>
                    <Label>{language === "es" ? "Tipo" : "Type"}</Label>
                    <Select value={newTimeOff.time_off_type} onValueChange={(value: any) => setNewTimeOff({ ...newTimeOff, time_off_type: value })}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vacation">Vacaciones</SelectItem>
                        <SelectItem value="sick">Enfermedad</SelectItem>
                        <SelectItem value="personal">Día Personal</SelectItem>
                        <SelectItem value="break">Break / Medio Día</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{language === "es" ? "Razón" : "Reason"}</Label>
                    <Textarea
                      value={newTimeOff.reason}
                      onChange={(e) => setNewTimeOff({ ...newTimeOff, reason: e.target.value })}
                      className="mt-2"
                      placeholder={language === "es" ? "Vacaciones, día personal..." : "Vacation, personal day..."}
                    />
                  </div>
                  <Button onClick={handleAddTimeOff} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    {language === "es" ? "Agregar Tiempo Libre" : "Add Time Off"}
                  </Button>
                </div>

                <div className="space-y-2">
                  {timeOff.map((time) => (
                    <div key={time.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {format(new Date(time.start_date), "MMM d")} - {format(new Date(time.end_date), "MMM d, yyyy")}
                          </p>
                          <Badge variant={
                            time.time_off_type === "vacation" ? "default" :
                            time.time_off_type === "sick" ? "destructive" :
                            time.time_off_type === "personal" ? "secondary" : "outline"
                          }>
                            {time.time_off_type === "vacation" ? "Vacaciones" :
                             time.time_off_type === "sick" ? "Enfermedad" :
                             time.time_off_type === "personal" ? "Personal" : "Break"}
                          </Badge>
                        </div>
                        {time.reason && (
                          <p className="text-sm text-muted-foreground mt-1">{time.reason}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTimeOff(time.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
