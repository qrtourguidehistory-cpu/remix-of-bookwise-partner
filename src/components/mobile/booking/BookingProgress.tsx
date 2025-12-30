interface BookingProgressProps {
  currentStep: number;
  totalSteps?: number;
}

export function BookingProgress({ currentStep, totalSteps = 5 }: BookingProgressProps) {
  return (
    <div className="flex gap-2 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <div
          key={step}
          className={`h-1 flex-1 rounded transition-colors ${
            step <= currentStep ? "bg-success" : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}
