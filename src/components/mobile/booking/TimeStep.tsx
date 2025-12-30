import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface TimeStepProps {
  availableTimes: string[];
  selectedTime: string;
  onTimeChange: (time: string) => void;
}

export function TimeStep({ availableTimes, selectedTime, onTimeChange }: TimeStepProps) {
  const { t, language } = useLanguage();

  return (
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
              onClick={() => onTimeChange(time)}
              className="w-full"
            >
              {time}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
