import { CheckCircle2 } from "lucide-react";

interface ProgressStepperProps {
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
}

export default function ProgressStepper({ currentStep, totalSteps, stepTitle }: ProgressStepperProps) {
  const progressPercentage = Math.round((currentStep / (totalSteps - 1)) * 100);

  return (
    <div className="space-y-6">
      {/* Progress Percentage */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10">
          <span className="text-2xl font-bold text-primary">{progressPercentage}%</span>
          <span className="text-sm text-muted-foreground">completado</span>
        </div>
      </div>

      {/* Step Indicators - Lines Only */}
      <div className="flex items-center gap-2 relative">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div key={index} className="flex-1">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                index < currentStep
                  ? "bg-primary"
                  : index === currentStep
                  ? "bg-primary"
                  : "bg-muted"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Step Info */}
      <div className="text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          Paso {currentStep + 1} de {totalSteps}
        </p>
        <h2 className="text-2xl font-bold">{stepTitle}</h2>
      </div>
    </div>
  );
}
