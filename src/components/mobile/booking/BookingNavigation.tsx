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
      className="fixed left-0 right-0 p-4 bg-background border-t z-50 shadow-lg"
      style={{ 
        // ✅ Posición fija desde abajo: 80px para la barra de navegación + padding
        bottom: "80px",
        paddingBottom: `calc(1rem + env(safe-area-inset-bottom, 0px))`,
        // ✅ Asegurar que el botón sea visible en todos los entornos
        minHeight: "64px",
        // ✅ Asegurar visibilidad en localhost (sin safe-area)
        maxHeight: "100px",
      }}
    >
      <div className="flex gap-3 max-w-2xl mx-auto">
        {step > 1 && (
          <Button variant="outline" onClick={onBack} className="flex-1">
            {t("back")}
          </Button>
        )}
        {step < 6 ? (
          <Button
            onClick={onNext}
            disabled={!canProceed || loading}
            className="flex-1"
          >
            {t("next") || "Continuar"}
          </Button>
        ) : (
          <Button onClick={onConfirm} disabled={loading || !canProceed} className="flex-1 bg-success hover:bg-success/90">
            {loading ? t("loading") || "Cargando..." : t("confirm") || "Confirmar"}
          </Button>
        )}
      </div>
    </div>
  );
}
