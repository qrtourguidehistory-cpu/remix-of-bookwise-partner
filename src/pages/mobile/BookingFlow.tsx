import { useState, useEffect } from "react";
import { format } from "date-fns";
import MobileLayout from "@/components/mobile/MobileLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { ServiceStep } from "@/components/mobile/booking/ServiceStep";
import { StaffStep } from "@/components/mobile/booking/StaffStep";
import { DateStep } from "@/components/mobile/booking/DateStep";
import { TimeStep } from "@/components/mobile/booking/TimeStep";
import { ConfirmationStep } from "@/components/mobile/booking/ConfirmationStep";
import { BookingProgress } from "@/components/mobile/booking/BookingProgress";
import { BookingNavigation } from "@/components/mobile/booking/BookingNavigation";

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
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();

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
    if (!selectedStaff || !selectedDate) return;

    const dayOfWeek = selectedDate.getDay();

    const { data: schedules } = await supabase
      .from("staff_schedules")
      .select("*")
      .eq("staff_id", selectedStaff)
      .eq("day_of_week", dayOfWeek)
      .eq("is_available", true);

    const dateStr = selectedDate.toISOString().split("T")[0];
    const { data: timeOff } = await supabase
      .from("staff_time_off")
      .select("*")
      .eq("staff_id", selectedStaff)
      .lte("start_date", dateStr)
      .gte("end_date", dateStr);

    if (timeOff && timeOff.length > 0) {
      setAvailableTimes([]);
      return;
    }

    if (schedules && schedules.length > 0) {
      const schedule = schedules[0];
      const startTime = schedule.start_time;
      const endTime = schedule.end_time;

      const available = TIME_SLOTS.filter((time) => {
        const timeValue = time.toLowerCase().replace(/\s/g, "");
        return timeValue >= startTime && timeValue <= endTime;
      });

      setAvailableTimes(available);
    } else {
      setAvailableTimes(TIME_SLOTS);
    }
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
      
      const { error } = await supabase.from("appointments").insert({
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
      });

      if (error) throw error;

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
