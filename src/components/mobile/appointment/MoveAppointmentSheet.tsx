import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { TimePicker } from "@/components/ui/time-picker";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Clock, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/timeFormat";

interface MoveAppointmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    service_id?: string;
    staff_id?: string;
    client_id?: string;
    business_id?: string;
  };
  onMove: (newDate: string, newStartTime: string, newEndTime: string) => Promise<void>;
}

export function MoveAppointmentSheet({
  open,
  onOpenChange,
  appointment,
  onMove,
}: MoveAppointmentSheetProps) {
  const { language } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    appointment?.appointment_date ? new Date(appointment.appointment_date) : new Date()
  );
  const [selectedStartTime, setSelectedStartTime] = useState<string>(appointment?.start_time || "09:00:00");
  const [selectedEndTime, setSelectedEndTime] = useState<string>(appointment?.end_time || "10:00:00");
  const [isLoading, setIsLoading] = useState(false);

  // Calculate duration from original appointment
  useEffect(() => {
    if (appointment?.start_time && appointment?.end_time) {
      const start = new Date(`2000-01-01T${appointment.start_time}`);
      const end = new Date(`2000-01-01T${appointment.end_time}`);
      const durationMs = end.getTime() - start.getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      // When start time changes, update end time to maintain duration
      if (selectedStartTime) {
        const newStart = new Date(`2000-01-01T${selectedStartTime}`);
        const newEnd = new Date(newStart.getTime() + durationMinutes * 60000);
        const newEndHours = String(newEnd.getHours()).padStart(2, "0");
        const newEndMinutes = String(newEnd.getMinutes()).padStart(2, "0");
        setSelectedEndTime(`${newEndHours}:${newEndMinutes}:00`);
      }
    }
  }, [selectedStartTime, appointment]);

  // Reset to appointment values when opening
  useEffect(() => {
    if (open && appointment) {
      setSelectedDate(appointment.appointment_date ? new Date(appointment.appointment_date) : new Date());
      setSelectedStartTime(appointment.start_time || "09:00:00");
      setSelectedEndTime(appointment.end_time || "10:00:00");
    }
  }, [open, appointment]);

  const handleMove = async () => {
    if (!selectedDate) {
      return;
    }

    setIsLoading(true);
    try {
      const newDateStr = format(selectedDate, "yyyy-MM-dd");
      await onMove(newDateStr, selectedStartTime, selectedEndTime);
      onOpenChange(false);
    } catch (error) {
      console.error("Error moving appointment:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const originalDateStr = appointment?.appointment_date
    ? format(new Date(appointment.appointment_date), "EEE, d MMM yyyy", { locale: language === "es" ? es : undefined })
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 bg-card border-t border-border" hideDefaultClose>
        <SheetHeader className="sr-only">
          <SheetTitle>{language === "es" ? "Mover cita" : "Move appointment"}</SheetTitle>
          <SheetDescription>
            {language === "es"
              ? "Selecciona una nueva fecha y hora para esta cita."
              : "Select a new date and time for this appointment."}
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 flex items-center justify-between border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">{language === "es" ? "Mover cita" : "Move appointment"}</h2>
            {originalDateStr && (
              <p className="text-sm text-muted-foreground">
                {language === "es" ? "Fecha actual:" : "Current date:"} {originalDateStr}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Date Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              <label className="text-sm font-medium">
                {language === "es" ? "Seleccionar día" : "Select day"}
              </label>
            </div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => {
                // Disable past dates
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return date < today;
              }}
              locale={language === "es" ? es : undefined}
              className="rounded-md border"
            />
          </div>

          {/* Time Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <label className="text-sm font-medium">
                {language === "es" ? "Seleccionar hora" : "Select time"}
              </label>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  {language === "es" ? "Hora de inicio" : "Start time"}
                </label>
                <TimePicker
                  value={selectedStartTime}
                  onChange={setSelectedStartTime}
                  placeholder={language === "es" ? "Seleccionar hora de inicio" : "Select start time"}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  {language === "es" ? "Hora de fin" : "End time"}
                </label>
                <TimePicker
                  value={selectedEndTime}
                  onChange={setSelectedEndTime}
                  placeholder={language === "es" ? "Seleccionar hora de fin" : "Select end time"}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          {selectedDate && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">
                {language === "es" ? "Nueva fecha y hora:" : "New date and time:"}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, "EEE, d MMM yyyy", { locale: language === "es" ? es : undefined })}
                {" • "}
                {formatTime(selectedStartTime, "12h")} - {formatTime(selectedEndTime, "12h")}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {language === "es" ? "Cancelar" : "Cancel"}
          </Button>
          <Button
            className="flex-1"
            onClick={handleMove}
            disabled={!selectedDate || isLoading}
          >
            {isLoading
              ? language === "es"
                ? "Moviendo..."
                : "Moving..."
              : language === "es"
              ? "Mover cita"
              : "Move appointment"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

