import { Calendar } from "@/components/ui/calendar";
import { useLanguage } from "@/contexts/LanguageContext";

interface DateStepProps {
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
}

export function DateStep({ selectedDate, onDateChange }: DateStepProps) {
  const { t } = useLanguage();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{t("selectDate")}</h2>
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onDateChange}
          className="rounded-md border"
          disabled={(date) => {
            // Allow same day - only disable past dates (before today)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const compareDate = new Date(date);
            compareDate.setHours(0, 0, 0, 0);
            return compareDate < today;
          }}
        />
      </div>
    </div>
  );
}
