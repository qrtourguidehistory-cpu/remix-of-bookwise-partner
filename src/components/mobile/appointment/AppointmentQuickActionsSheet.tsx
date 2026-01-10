import type React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ClipboardList, Activity, CalendarClock, EyeOff, X, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface AppointmentQuickActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddNote?: () => void;
  onViewActivity?: () => void;
  onReschedule?: () => void;
  onNoShow?: () => void;
  onCancel?: () => void;
}

export function AppointmentQuickActionsSheet({
  open,
  onOpenChange,
  onAddNote,
  onViewActivity,
  onReschedule,
  onNoShow,
  onCancel,
}: AppointmentQuickActionsSheetProps) {
  const { language } = useLanguage();

  const Row = ({
    Icon,
    label,
    danger,
    onClick,
  }: {
    Icon: React.ComponentType<{ className?: string }>;
    label: string;
    danger?: boolean;
    onClick?: () => void;
  }) => (
    <button
      className={cn(
        "w-full flex items-center gap-4 px-6 py-4 text-left",
        danger ? "text-destructive" : "text-foreground"
      )}
      onClick={() => {
        onClick?.();
        onOpenChange(false);
      }}
    >
      <Icon className={cn("h-5 w-5", danger ? "text-destructive" : "text-foreground")} />
      <span className="text-base">{label}</span>
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 bg-card border-t border-border" hideDefaultClose>
        <SheetHeader className="sr-only">
          <SheetTitle>{language === "es" ? "Acciones rápidas" : "Quick actions"}</SheetTitle>
          <SheetDescription>
            {language === "es"
              ? "Acciones rápidas disponibles para la cita."
              : "Quick actions available for the appointment."}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 flex items-center justify-between">
          <div className="text-lg font-semibold">
            {language === "es" ? "Acciones rápidas" : "Quick actions"}
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="pb-2">
          <Row Icon={ClipboardList} label={language === "es" ? "Agregar nota" : "Add a note"} onClick={onAddNote} />
          <Separator />
          <Row Icon={Activity} label={language === "es" ? "Ver actividad" : "View appointment activity"} onClick={onViewActivity} />
          <Separator />
          <Row Icon={CalendarClock} label={language === "es" ? "Reagendar" : "Reschedule"} onClick={onReschedule} />
          <Row Icon={EyeOff} label={language === "es" ? "No-show" : "No-show"} danger onClick={onNoShow} />
          <Row Icon={XCircle} label={language === "es" ? "Cancelar" : "Cancel"} danger onClick={onCancel} />
        </div>
      </SheetContent>
    </Sheet>
  );
}


