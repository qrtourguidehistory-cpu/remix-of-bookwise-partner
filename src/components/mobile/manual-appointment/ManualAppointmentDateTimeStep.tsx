import { useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ManualAppointmentDateTimeStepProps {
  selectedDate: Date | null;
  selectedTime: string;
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
}

export function ManualAppointmentDateTimeStep({
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
}: ManualAppointmentDateTimeStepProps) {
  const { language } = useLanguage();
  
  const isValid = selectedDate !== null && selectedTime.length > 0;
  
  // ✅ Generar slots de tiempo disponibles
  // Si la fecha seleccionada es hoy, filtrar horas pasadas
  const availableTimeSlots = useMemo(() => {
    const slots: { value: string; label: string; disabled: boolean }[] = [];
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Verificar si la fecha seleccionada es hoy
    const isToday = selectedDate 
      ? selectedDate.toDateString() === today.toDateString()
      : false;
    
    // Generar slots desde las 7:00 AM hasta las 11:00 PM
    for (let hour = 7; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time24h = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
        
        // Formatear para mostrar en 12h
        const isPM = hour >= 12;
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const label = `${displayHour}:${String(minute).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
        
        // ✅ Si es hoy, deshabilitar horas pasadas
        let disabled = false;
        if (isToday) {
          const slotTime = new Date();
          slotTime.setHours(hour, minute, 0, 0);
          // Deshabilitar si la hora del slot ya pasó (con 15 min de margen)
          disabled = slotTime.getTime() <= now.getTime() + 15 * 60 * 1000;
        }
        
        slots.push({
          value: time24h,
          label,
          disabled,
        });
      }
    }
    
    return slots;
  }, [selectedDate]);
  
  // Parsear el tiempo seleccionado para mostrar
  const displaySelectedTime = useMemo(() => {
    if (!selectedTime) return null;
    const match = selectedTime.match(/(\d{1,2}):(\d{2})/);
    if (!match) return selectedTime;
    const hour = parseInt(match[1], 10);
    const minute = match[2];
    const isPM = hour >= 12;
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute} ${isPM ? "PM" : "AM"}`;
  }, [selectedTime]);
  
  return (
    <div className="space-y-6 p-4 w-full max-w-full overflow-x-hidden">
      <div>
        <h2 className="text-xl font-semibold mb-2">
          {language === "es" ? "Fecha y Hora" : "Date and Time"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === "es" 
            ? "Selecciona la fecha y hora para la cita"
            : "Select the date and time for the appointment"}
        </p>
      </div>
      
      {/* Selector de Fecha */}
      <div className="space-y-2 w-full">
        <Label className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" />
          {language === "es" ? "Fecha" : "Date"} *
        </Label>
        <div className="flex justify-center border rounded-lg p-2 bg-muted/20 w-full overflow-x-auto">
          <Calendar
            mode="single"
            selected={selectedDate || undefined}
            onSelect={(date) => {
              onDateChange(date);
              // ✅ Si cambia la fecha, limpiar la hora seleccionada si ya no es válida
              if (date && selectedTime) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isToday = date.toDateString() === today.toDateString();
                
                if (isToday) {
                  const now = new Date();
                  const match = selectedTime.match(/(\d{1,2}):(\d{2})/);
                  if (match) {
                    const hour = parseInt(match[1], 10);
                    const minute = parseInt(match[2], 10);
                    const slotTime = new Date();
                    slotTime.setHours(hour, minute, 0, 0);
                    // Si la hora seleccionada ya pasó, limpiarla
                    if (slotTime.getTime() <= now.getTime() + 15 * 60 * 1000) {
                      onTimeChange("");
                    }
                  }
                }
              }
            }}
            disabled={(date) => {
              // Deshabilitar fechas pasadas
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const compareDate = new Date(date);
              compareDate.setHours(0, 0, 0, 0);
              return compareDate < today;
            }}
            locale={language === "es" ? es : undefined}
            className="rounded-md"
          />
        </div>
        {selectedDate && (
          <p className="text-sm text-muted-foreground text-center">
            {format(selectedDate, "EEEE, d 'de' MMMM, yyyy", { locale: language === "es" ? es : undefined })}
          </p>
        )}
      </div>
      
      {/* Selector de Hora - Grid de botones */}
      <div className="space-y-2 w-full">
        <Label className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {language === "es" ? "Hora" : "Time"} *
          {displaySelectedTime && (
            <span className="ml-auto text-primary font-medium">{displaySelectedTime}</span>
          )}
        </Label>
        
        <ScrollArea className="h-[200px] w-full border rounded-lg p-2 bg-muted/20">
          <div className="grid grid-cols-3 gap-2 p-1">
            {availableTimeSlots.map((slot) => (
              <Button
                key={slot.value}
                variant={selectedTime === slot.value ? "default" : "outline"}
                size="sm"
                disabled={slot.disabled}
                onClick={() => onTimeChange(slot.value)}
                className={cn(
                  "text-xs h-9",
                  selectedTime === slot.value && "ring-2 ring-primary ring-offset-2",
                  slot.disabled && "opacity-50 cursor-not-allowed line-through"
                )}
              >
                {slot.label}
              </Button>
            ))}
          </div>
        </ScrollArea>
        
        {/* Mensaje si es hoy y hay horas deshabilitadas */}
        {selectedDate && selectedDate.toDateString() === new Date().toDateString() && (
          <p className="text-xs text-muted-foreground text-center">
            {language === "es" 
              ? "Las horas pasadas están deshabilitadas"
              : "Past hours are disabled"}
          </p>
        )}
      </div>
      
      {!isValid && (
        <p className="text-sm text-destructive text-center">
          {language === "es" 
            ? "Por favor selecciona una fecha y hora"
            : "Please select a date and time"}
        </p>
      )}
    </div>
  );
}
