import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface TimeStepProps {
  availableTimes: string[];
  selectedTime: string;
  onTimeChange: (time: string) => void;
  earlyDepartureMessage?: string;
}

export function TimeStep({ availableTimes, selectedTime, onTimeChange, earlyDepartureMessage }: TimeStepProps) {
  const { t, language } = useLanguage();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{t("selectTime")}</h2>
      {earlyDepartureMessage && (
        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <p className="text-sm text-orange-800 dark:text-orange-200 text-center">
            {earlyDepartureMessage}
          </p>
        </div>
      )}
      {availableTimes.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          {earlyDepartureMessage || (language === "es" 
            ? "No hay horarios disponibles para este día" 
            : "No available times for this day")}
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
