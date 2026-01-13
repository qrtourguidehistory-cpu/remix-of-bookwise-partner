import { useState, useEffect } from "react";
import { format } from "date-fns";
import MobileLayout from "@/components/mobile/MobileLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { generateTimeSlotsFromBusinessHours, convertTo24Hour } from "@/lib/timeFormat";
import { ServiceStep } from "@/components/mobile/booking/ServiceStep";
import { StaffStep } from "@/components/mobile/booking/StaffStep";
import { DateStep } from "@/components/mobile/booking/DateStep";
import { TimeStep } from "@/components/mobile/booking/TimeStep";
import { ConfirmationStep } from "@/components/mobile/booking/ConfirmationStep";
import { BookingProgress } from "@/components/mobile/booking/BookingProgress";
import { BookingNavigation } from "@/components/mobile/booking/BookingNavigation";
import { useStaffAvailability } from "@/hooks/useStaffAvailability";
import { useRealtimeEarlyDepartures } from "@/hooks/useRealtimeEarlyDepartures";

const TIME_SLOTS = [
  "7:00am", "7:30am", "8:00am", "8:30am", "9:00am", "9:30am",
  "10:00am", "10:30am", "11:00am", "11:30am", "12:00pm", "12:30pm",
  "1:00pm", "1:30pm", "2:00pm", "2:30pm", "3:00pm", "3:30pm",
  "4:00pm", "4:30pm", "5:00pm", "5:30pm", "6:00pm", "6:30pm",
  "7:00pm", "7:30pm", "8:00pm", "8:30pm", "9:00pm", "9:30pm",
  "10:00pm", "10:30pm", "11:00pm"
];

export default function BookingFlow() {
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [earlyDepartureMessage, setEarlyDepartureMessage] = useState<string>("");
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  
  // Hook para consultar disponibilidad del staff
  const { schedules, timeOff, earlyDepartures, isLoading: availabilityLoading, refetch: refetchAvailability } = useStaffAvailability(
    selectedStaff || null,
    selectedDate || null,
    profile?.business_id || null
  );

  // Suscripción realtime para salidas anticipadas
  useRealtimeEarlyDepartures(() => {
    // Cuando hay cambios en salidas anticipadas, refetch la disponibilidad
    if (selectedStaff && selectedDate) {
      refetchAvailability();
    }
  });

  useEffect(() => {
    if (profile?.business_id) {
      fetchServices();
    }
  }, [profile?.business_id]);

  useEffect(() => {
    if (selectedService && profile?.business_id) {
      fetchStaff();
    }
  }, [selectedService, profile?.business_id]);

  useEffect(() => {
    if (selectedStaff && selectedDate) {
      filterAvailableTimes();
    }
  }, [selectedStaff, selectedDate]);

  const fetchServices = async () => {
    if (!profile?.business_id) return;
    
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", profile.business_id)
      .eq("is_active", true);
    if (!error && data) {
      setServices(data);
    }
  };

  const fetchStaff = async () => {
    if (!profile?.business_id) return;
    
    if (!selectedService) {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("business_id", profile.business_id)
        .eq("is_active", true);
      if (!error && data) {
        setStaff(data);
      }
      return;
    }

    const { data: staffServices, error: ssError } = await supabase
      .from("staff_services")
      .select("staff_id")
      .eq("service_id", selectedService);

    if (ssError) {
      console.error("Error fetching staff services:", ssError);
      return;
    }

    const staffIds = staffServices?.map((ss) => ss.staff_id) || [];

    if (staffIds.length > 0) {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .in("id", staffIds)
        .eq("business_id", profile.business_id)
        .eq("is_active", true);
      if (!error && data) {
        setStaff(data);
      }
    } else {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("business_id", profile.business_id)
        .eq("is_active", true);
      if (!error && data) {
        setStaff(data);
      }
    }
  };

  const filterAvailableTimes = async () => {
    if (!selectedStaff || !selectedDate || !profile?.business_id) return;

    // 0. Verificar si el negocio está cerrado temporalmente
    const { data: businessData } = await supabase
      .from("businesses")
      .select("temporarily_closed, closed_until")
      .eq("id", profile.business_id)
      .single();

    if (businessData?.temporarily_closed) {
      const closedUntil = businessData.closed_until ? new Date(businessData.closed_until) : null;
      const now = new Date();
      // Si closed_until existe y aún no ha pasado, no mostrar horarios disponibles
      if (closedUntil && closedUntil > now) {
        setAvailableTimes([]);
        setEarlyDepartureMessage("");
        return;
      }
    }

    const dayOfWeek = selectedDate.getDay();

    // 1. Consultar business_hours primero
    const { data: businessHoursData } = await supabase
      .from("business_hours")
      .select("*")
      .eq("business_id", profile.business_id)
      .eq("day_of_week", dayOfWeek)
      .maybeSingle();

    // Verificar si el negocio está cerrado ese día
    const isClosed = businessHoursData?.is_closed !== undefined 
      ? businessHoursData.is_closed 
      : (businessHoursData?.is_open !== undefined ? !businessHoursData.is_open : false);
    
    if (isClosed) {
      setAvailableTimes([]);
      setEarlyDepartureMessage("");
      return;
    }

    // Obtener los horarios del negocio (o usar valores por defecto si no hay)
    const businessStartTime = businessHoursData?.open_time || businessHoursData?.start_time || "08:30:00";
    const businessEndTime = businessHoursData?.close_time || businessHoursData?.end_time || "20:00:00";
    
    // Convertir a formato HH:MM (sin segundos) si viene con segundos
    const startTime24 = businessStartTime.substring(0, 5);
    const endTime24 = businessEndTime.substring(0, 5);

    // 2. Generar slots basados en business_hours
    const businessTimeSlots = generateTimeSlotsFromBusinessHours(
      startTime24,
      endTime24,
      '12h',
      30
    );

    // 3. Verificar staff_time_off (vacaciones/descanso) - si existe, no hay disponibilidad
    if (timeOff && timeOff.length > 0) {
      setAvailableTimes([]);
      setEarlyDepartureMessage("");
      return;
    }

    // 4. Filtrar slots por staff_schedules si existen
    let availableSlots = businessTimeSlots;
    
    if (schedules && schedules.length > 0) {
      const schedule = schedules[0];
      const staffStartTime = schedule.start_time;
      const staffEndTime = schedule.end_time;

      availableSlots = businessTimeSlots.filter((time) => {
        const timeValue = time.toLowerCase().replace(/\s/g, "");
        return timeValue >= staffStartTime && timeValue <= staffEndTime;
      });
    }

    // 5. CRÍTICO: Filtrar slots por staff_early_departures (salidas anticipadas)
    // La excepción siempre anula al horario regular
    if (earlyDepartures && earlyDepartures.length > 0) {
      const earlyDeparture = earlyDepartures[0];
      const departureTime24 = earlyDeparture.departure_time.substring(0, 5);
      
      // Filtrar slots que están después de la hora de salida anticipada
      availableSlots = availableSlots.filter((time) => {
        const time24 = convertTo24Hour(time).substring(0, 5);
        const timeMinutes = timeToMinutes(time24);
        const departureMinutes = timeToMinutes(departureTime24);
        
        // Si el slot está después de la salida anticipada, excluirlo
        if (timeMinutes >= departureMinutes) {
          return false; // El slot desaparece por salida anticipada
        }
        return true;
      });
      
      // Si no hay slots disponibles después de filtrar, mostrar mensaje
      if (availableSlots.length === 0) {
        const departureTime12h = formatTime(departureTime24, '12h');
        setEarlyDepartureMessage(
          language === "es" 
            ? `Horario especial: El profesional se retira antes el día de hoy (${departureTime12h})`
            : `Special schedule: The professional leaves early today (${departureTime12h})`
        );
      } else {
        setEarlyDepartureMessage("");
      }
    } else {
      setEarlyDepartureMessage("");
    }

    // 5. Excluir breaks del negocio (business_hours)
    // IMPORTANTE: Los breaks SOLO excluyen slots, NUNCA redefinen el startTime
    // El rango SIEMPRE es open_time → close_time
    if (businessHoursData?.break_start && businessHoursData?.break_end) {
      const breakStart = businessHoursData.break_start.substring(0, 5);
      const breakEnd = businessHoursData.break_end.substring(0, 5);
      
      // Validar que el break no esté mal guardado (00:30 en lugar de 12:30)
      // Si break_start es 00:30 (medianoche), probablemente es un error
      const breakStartMinutes = timeToMinutes(breakStart);
      const breakEndMinutes = timeToMinutes(breakEnd);
      const openMinutes = timeToMinutes(startTime24);
      const closeMinutes = timeToMinutes(endTime24);
      
      // Validar: break_start debe estar después de open_time
      // Si break_start es muy temprano (antes de las 6 AM), probablemente es un error
      // Si break_start es 00:30 y open_time es 08:30, es claramente un error
      const isValidBreak = breakStartMinutes >= openMinutes && 
                          breakStartMinutes < closeMinutes &&
                          breakEndMinutes > breakStartMinutes &&
                          breakEndMinutes <= closeMinutes &&
                          breakStartMinutes >= 6 * 60; // No antes de las 6 AM
      
      if (isValidBreak) {
        // Solo excluir breaks válidos
        availableSlots = availableSlots.filter((time) => {
          const time24 = convertTo24Hour(time).substring(0, 5);
          const timeMinutes = timeToMinutes(time24);
          
          // Excluir si está dentro del break (solo si el break es válido)
          return !(timeMinutes >= breakStartMinutes && timeMinutes < breakEndMinutes);
        });
      }
      // Si el break es inválido, ignorarlo (no excluir slots)
    }

    // 6. Excluir breaks del staff si existen
    // IMPORTANTE: Validar breaks del staff también
    if (schedules && schedules.length > 0) {
      const schedule = schedules[0];
      if (schedule.break_start && schedule.break_end) {
        const staffBreakStart = schedule.break_start.substring(0, 5);
        const staffBreakEnd = schedule.break_end.substring(0, 5);
        
        const staffBreakStartMinutes = timeToMinutes(staffBreakStart);
        const staffBreakEndMinutes = timeToMinutes(staffBreakEnd);
        const staffStartMinutes = timeToMinutes(schedule.start_time.substring(0, 5));
        const staffEndMinutes = timeToMinutes(schedule.end_time.substring(0, 5));
        
        // Validar: break del staff debe estar dentro del horario del staff
        const isValidStaffBreak = staffBreakStartMinutes >= staffStartMinutes &&
                                  staffBreakStartMinutes < staffEndMinutes &&
                                  staffBreakEndMinutes > staffBreakStartMinutes &&
                                  staffBreakEndMinutes <= staffEndMinutes &&
                                  staffBreakStartMinutes >= 6 * 60; // No antes de las 6 AM
        
        if (isValidStaffBreak) {
          availableSlots = availableSlots.filter((time) => {
            const time24 = convertTo24Hour(time).substring(0, 5);
            const timeMinutes = timeToMinutes(time24);
            
            // Excluir si está dentro del break del staff (solo si es válido)
            return !(timeMinutes >= staffBreakStartMinutes && timeMinutes < staffBreakEndMinutes);
          });
        }
        // Si el break del staff es inválido, ignorarlo
      }
    }

    setAvailableTimes(availableSlots);
  };

  // Helper: Convertir tiempo a minutos desde medianoche
  const timeToMinutes = (time24: string): number => {
    const [hours, minutes] = time24.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Helper: Formatear tiempo (importado de timeFormat)
  const formatTime = (time24: string, format: '12h' | '24h' = '12h'): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(str => parseInt(str, 10));
    if (format === '24h') {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    const period = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${String(minutes).padStart(2, '0')}${period}`;
  };

  const parseTime = (timeStr: string): { hours: number; minutes: number } | null => {
    const match = timeStr.toLowerCase().replace(/\s/g, "").match(/(\d+):(\d+)(am|pm)/);
    if (!match) return null;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3];
    
    if (period === "pm" && hours !== 12) {
      hours += 12;
    } else if (period === "am" && hours === 12) {
      hours = 0;
    }
    
    return { hours, minutes };
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (!profile?.business_id) {
        toast({
          title: "Error",
          description: "Business ID not found",
          variant: "destructive",
        });
        return;
      }
      
      const { data: clientData } = await supabase
        .from("clients")
        .select("id")
        .eq("business_id", profile.business_id)
        .limit(1)
        .maybeSingle();

      let clientId = clientData?.id;
      
      if (!clientId) {
        const newClientId = crypto.randomUUID();
        const { data: newClient, error: createError } = await supabase
          .from("clients")
          .insert({
            id: newClientId,
            business_id: profile.business_id,
            full_name: "Demo Client",
            email: "demo@example.com",
            phone: "000-000-0000"
          })
          .select()
          .single();
        
        if (createError) throw createError;
        clientId = newClient.id;
      }

      if (!selectedService) {
        toast({
          title: "Error",
          description: language === "es" ? "Por favor selecciona un servicio" : "Please select a service",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const service = services.find(s => s.id === selectedService);
      if (!service) {
        toast({
          title: "Error",
          description: language === "es" ? "Servicio no encontrado" : "Service not found",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const parsedTime = parseTime(selectedTime);
      if (!parsedTime) {
        toast({
          title: "Error",
          description: language === "es" ? "Formato de hora inválido" : "Invalid time format",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const startTime24h = `${String(parsedTime.hours).padStart(2, "0")}:${String(parsedTime.minutes).padStart(2, "0")}:00`;
      
      const duration = service.duration_minutes || 30;
      const startTotalMinutes = parsedTime.hours * 60 + parsedTime.minutes;
      const endTotalMinutes = startTotalMinutes + duration;
      const endHour24 = Math.floor(endTotalMinutes / 60) % 24;
      const endMinutes24 = endTotalMinutes % 60;
      const endTime24h = `${String(endHour24).padStart(2, "0")}:${String(endMinutes24).padStart(2, "0")}:00`;

      const servicePrice = typeof service.price === 'string' ? parseFloat(service.price) : (service.price || 0);
      const appointmentDateStr = selectedDate?.toISOString().split("T")[0] || format(new Date(), "yyyy-MM-dd");
      
      const { data: newAppointment, error } = await supabase.from("appointments").insert({
        business_id: profile?.business_id || null,
        client_id: clientId || null,
        service_id: selectedService,
        staff_id: selectedStaff || null,
        date: appointmentDateStr,
        appointment_date: appointmentDateStr,
        start_time: startTime24h,
        end_time: endTime24h,
        status: "pending",
        payment_amount: servicePrice,
      }).select().single();

      if (error) throw error;

      // Crear notificación para Partner sobre nueva cita
      if (newAppointment && profile?.business_id && profile?.id) {
        try {
          const { notifyNewAppointment } = await import("@/lib/partnerNotificationService");
          const appointmentDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : appointmentDateStr;
          const appointmentTime = selectedTime;
          await notifyNewAppointment(
            profile.business_id,
            profile.id,
            newAppointment.id,
            clientId || "",
            "Demo Client", // En producción, obtener el nombre real del cliente
            appointmentDate,
            appointmentTime,
            language === "es" ? "es" : "en"
          );
        } catch (err) {
          console.error("Error creating new appointment notification:", err);
          // No mostrar error al usuario, solo log
        }
      }

      toast({
        title: t("appointmentConfirmed"),
        description: t("notifications"),
      });
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast({
        title: "Error",
        description: "Failed to create appointment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const service = services.find(s => s.id === selectedService);
  const selectedStaffMember = staff.find(s => s.id === selectedStaff);

  const canProceed = 
    (step === 1 && !!selectedService) ||
    (step === 2 && !!selectedStaff) ||
    (step === 3 && !!selectedDate) ||
    (step === 4 && !!selectedTime);

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{t("bookAppointment")}</h1>
        
        <BookingProgress currentStep={step} />

        {step === 1 && (
          <ServiceStep 
            services={services} 
            selectedService={selectedService} 
            onServiceChange={setSelectedService} 
          />
        )}

        {step === 2 && (
          <StaffStep 
            staff={staff} 
            selectedStaff={selectedStaff} 
            onStaffChange={setSelectedStaff} 
          />
        )}

        {step === 3 && (
          <DateStep 
            selectedDate={selectedDate} 
            onDateChange={setSelectedDate} 
          />
        )}

        {step === 4 && (
          <TimeStep 
            availableTimes={availableTimes} 
            selectedTime={selectedTime} 
            onTimeChange={setSelectedTime}
            earlyDepartureMessage={earlyDepartureMessage}
          />
        )}

        {step === 5 && (
          <ConfirmationStep 
            service={service} 
            staff={selectedStaffMember} 
            selectedDate={selectedDate} 
            selectedTime={selectedTime} 
          />
        )}

        <BookingNavigation
          step={step}
          canProceed={canProceed}
          loading={loading}
          onBack={() => setStep(step - 1)}
          onNext={() => setStep(step + 1)}
          onConfirm={handleConfirm}
        />
      </div>
    </MobileLayout>
  );
}
