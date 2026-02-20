import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ManualAppointmentSuccessAnimationProps {
  show: boolean;
}

export function ManualAppointmentSuccessAnimation({ show }: ManualAppointmentSuccessAnimationProps) {
  const { language } = useLanguage();
  
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 bg-card border rounded-lg shadow-lg animate-in fade-in zoom-in duration-300">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
          <CheckCircle2 className="h-16 w-16 text-primary relative z-10" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold">
            {language === "es" ? "¡Cita Confirmada!" : "Appointment Confirmed!"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {language === "es" 
              ? "La cita ha sido creada exitosamente"
              : "The appointment has been created successfully"}
          </p>
        </div>
      </div>
    </div>
  );
}

