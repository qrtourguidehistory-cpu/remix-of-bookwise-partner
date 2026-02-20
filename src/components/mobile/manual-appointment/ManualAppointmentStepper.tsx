import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ManualAppointmentStepperProps {
  currentStep: number;
  totalSteps: number;
}

export function ManualAppointmentStepper({ currentStep, totalSteps }: ManualAppointmentStepperProps) {
  const steps = [
    { number: 1, label: "Cliente" },
    { number: 2, label: "Fecha/Hora" },
    { number: 3, label: "Servicios" },
    { number: 4, label: "Confirmar" },
  ];
  
  return (
    <div className="flex items-center justify-between w-full max-w-full py-2 px-2 overflow-hidden">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center flex-1 min-w-0">
          {/* Step Circle */}
          <div className="flex flex-col items-center min-w-0">
            <div
              className={cn(
                "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm transition-colors shrink-0",
                step.number < currentStep
                  ? "bg-primary text-primary-foreground"
                  : step.number === currentStep
                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {step.number < currentStep ? (
                <Check className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                step.number
              )}
            </div>
            <span
              className={cn(
                "text-[10px] sm:text-xs mt-1 text-center truncate max-w-[60px] sm:max-w-none",
                step.number <= currentStep
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
          
          {/* Connector Line */}
          {index < steps.length - 1 && (
            <div
              className={cn(
                "flex-1 h-0.5 mx-1 sm:mx-2 transition-colors min-w-[16px] max-w-[40px]",
                step.number < currentStep ? "bg-primary" : "bg-muted"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

