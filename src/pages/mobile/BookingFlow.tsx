import { useState, useEffect } from "react";
import { format } from "date-fns";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

const timeSlots = [
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
      // If no service selected, show all staff
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

    // Filter staff by service
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
      // If no staff linked to service, show all active staff
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

    // Get staff schedule for the selected day
    const { data: schedules } = await supabase
      .from("staff_schedules")
      .select("*")
      .eq("staff_id", selectedStaff)
      .eq("day_of_week", dayOfWeek)
      .eq("is_available", true);

    // Get staff time off
    const dateStr = selectedDate.toISOString().split("T")[0];
    const { data: timeOff } = await supabase
      .from("staff_time_off")
      .select("*")
      .eq("staff_id", selectedStaff)
      .lte("start_date", dateStr)
      .gte("end_date", dateStr);

    // If staff has time off, no times available
    if (timeOff && timeOff.length > 0) {
      setAvailableTimes([]);
      return;
    }

    // Filter times based on schedule
    if (schedules && schedules.length > 0) {
      const schedule = schedules[0];
      const startTime = schedule.start_time;
      const endTime = schedule.end_time;

      const available = timeSlots.filter((time) => {
        const timeValue = time.toLowerCase().replace(/\s/g, "");
        return timeValue >= startTime && timeValue <= endTime;
      });

      setAvailableTimes(available);
    } else {
      // No schedule set, show all times
      setAvailableTimes(timeSlots);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // For demo purposes, create a dummy client. In production, use authenticated user
      if (!profile?.business_id) {
        toast({
          title: "Error",
          description: "Business ID not found",
          variant: "destructive",
        });
        return;
      }
      
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id")
        .eq("business_id", profile.business_id)
        .limit(1)
        .maybeSingle();

      let clientId = clientData?.id;
      
      if (!clientId) {
        // Create a demo client if none exists
        if (!profile?.business_id) {
          toast({
            title: "Error",
            description: "Business ID not found",
            variant: "destructive",
          });
          return;
        }
        
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

      const startTime = selectedTime.toLowerCase().replace(/\s/g, "");
      
      // Convert start time to 24h format
      const [time, period] = startTime.match(/(\d+):(\d+)(am|pm)/)?.slice(1) || [];
      if (!time || !period) {
        toast({
          title: "Error",
          description: language === "es" ? "Formato de hora inválido" : "Invalid time format",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const [hours, minutes] = time.split(":").map(Number);
      let startHour24 = hours;
      if (period === "pm" && hours !== 12) {
        startHour24 = hours + 12;
      } else if (period === "am" && hours === 12) {
        startHour24 = 0;
      }
      const startTime24h = `${String(startHour24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
      
      // Calculate end time based on service duration in 24h format
      const duration = service.duration_minutes || 30;
      const startTotalMinutes = startHour24 * 60 + minutes;
      const endTotalMinutes = startTotalMinutes + duration;
      const endHour24 = Math.floor(endTotalMinutes / 60) % 24;
      const endMinutes24 = endTotalMinutes % 60;
      const endTime24h = `${String(endHour24).padStart(2, "0")}:${String(endMinutes24).padStart(2, "0")}:00`;

      // Get service price (convert to number if string)
      const servicePrice = typeof service.price === 'string' ? parseFloat(service.price) : (service.price || 0);

      const appointmentDateStr = selectedDate?.toISOString().split("T")[0] || format(new Date(), "yyyy-MM-dd");
      
      const { error } = await supabase.from("appointments").insert({
        business_id: profile?.business_id || null,
        client_id: clientId || null,
        service_id: selectedService, // Now guaranteed to exist
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
      setTimeout(() => navigate("/"), 1500);
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

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{t("bookAppointment")}</h1>
        
        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded ${
                s <= step ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Service */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">{t("selectService")}</h2>
            <RadioGroup value={selectedService} onValueChange={setSelectedService}>
              <div className="space-y-3">
                {services.map((service) => (
                  <Label
                    key={service.id}
                    htmlFor={service.id}
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={service.id} id={service.id} />
                      <div className="flex items-center gap-3">
                        {service.image_url && (
                          <img
                            src={service.image_url}
                            alt={service.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div>
                          <p className="font-medium">{service.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {service.duration_minutes} min • ${service.price}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Label>
                ))}
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Step 2: Staff */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">{language === "es" ? "Seleccionar Personal" : "Select Staff"}</h2>
            <RadioGroup value={selectedStaff} onValueChange={setSelectedStaff}>
              <div className="space-y-3">
                {staff.map((member) => (
                  <Label
                    key={member.id}
                    htmlFor={member.id}
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={member.id} id={member.id} />
                      <div className="flex items-center gap-3">
                        {member.avatar_url && (
                          <img
                            src={member.avatar_url}
                            alt={member.full_name}
                            className="w-12 h-12 object-cover rounded-full"
                          />
                        )}
                        <div>
                          <p className="font-medium">{member.full_name}</p>
                          {member.specialties && (
                            <p className="text-sm text-muted-foreground">
                              {member.specialties.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Label>
                ))}
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Step 3: Date */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">{t("selectDate")}</h2>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
                disabled={(date) => date < new Date()}
              />
            </div>
          </div>
        )}

        {/* Step 4: Time */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">{t("selectTime")}</h2>
            {availableTimes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {language === "es" 
                  ? "No hay horarios disponibles para este día" 
                  : "No available times for this day"}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableTimes.map((time) => (
                  <Button
                    key={time}
                    variant={selectedTime === time ? "default" : "outline"}
                    onClick={() => setSelectedTime(time)}
                    className="w-full"
                  >
                    {time}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-6">{t("confirmation")}</h2>
            <div className="bg-card p-6 rounded-lg border text-left space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">{t("selectService")}</p>
                <p className="font-semibold">{service?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("selectStaff") || "Staff"}</p>
                <p className="font-semibold">{selectedStaffMember?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("selectDate")}</p>
                <p className="font-semibold">
                  {selectedDate?.toLocaleDateString(language === "es" ? "es-ES" : "en-US")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("selectTime")}</p>
                <p className="font-semibold">{selectedTime}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="font-semibold text-xl">${service?.price}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background border-t">
          <div className="flex gap-3 max-w-2xl mx-auto">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                {t("back")}
              </Button>
            )}
            {step < 5 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && !selectedService) ||
                  (step === 2 && !selectedStaff) ||
                  (step === 3 && !selectedDate) ||
                  (step === 4 && !selectedTime)
                }
                className="flex-1"
              >
                {t("next")}
              </Button>
            ) : (
              <Button onClick={handleConfirm} disabled={loading} className="flex-1">
                {loading ? t("loading") || "Loading..." : t("confirm")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
