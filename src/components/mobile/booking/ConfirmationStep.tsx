import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Service {
  id: string;
  name: string;
  price: number;
}

interface Staff {
  id: string;
  full_name: string;
}

interface ConfirmationStepProps {
  service: Service | undefined;
  staff: Staff | undefined;
  selectedDate: Date | undefined;
  selectedTime: string;
}

export function ConfirmationStep({ 
  service, 
  staff, 
  selectedDate, 
  selectedTime 
}: ConfirmationStepProps) {
  const { t, language } = useLanguage();

  return (
    <div className="text-center py-8">
      <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
      <h2 className="text-2xl font-bold mb-6">{t("confirmation")}</h2>
      <div className="bg-card p-6 rounded-lg border text-left space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">{t("selectService")}</p>
          <p className="font-semibold">{service?.name}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t("selectStaff") || "Staff"}</p>
          <p className="font-semibold">{staff?.full_name}</p>
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
          <p className="font-semibold text-xl text-success">${service?.price}</p>
        </div>
      </div>
    </div>
  );
}
