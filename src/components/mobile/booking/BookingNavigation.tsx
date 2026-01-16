import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface BookingNavigationProps {
  step: number;
  canProceed: boolean;
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
  onConfirm: () => void;
}

export function BookingNavigation({
  step,
  canProceed,
  loading,
  onBack,
  onNext,
  onConfirm,
}: BookingNavigationProps) {
  const { t } = useLanguage();

  return (
    <div 
      className="fixed bottom-20 left-0 right-0 p-4 bg-background border-t"
      style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom, 0px))` }}
    >
      <div className="flex gap-3 max-w-2xl mx-auto">
        {step > 1 && (
          <Button variant="outline" onClick={onBack} className="flex-1">
            {t("back")}
          </Button>
        )}
        {step < 5 ? (
          <Button
            onClick={onNext}
            disabled={!canProceed}
            className="flex-1"
          >
            {t("next")}
          </Button>
        ) : (
          <Button onClick={onConfirm} disabled={loading} className="flex-1 bg-success hover:bg-success/90">
            {loading ? t("loading") || "Loading..." : t("confirm")}
          </Button>
        )}
      </div>
    </div>
  );
}
