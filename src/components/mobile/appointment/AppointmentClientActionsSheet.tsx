import type React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Eye, UserMinus, FileEdit, Ban, Trash2, X, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface AppointmentClientActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewClient?: () => void;
  onRemoveClient?: () => void;
  onAddAllergy?: () => void;
  onEditClientDetails?: () => void;
  onBlockClient?: () => void;
  onDeleteClient?: () => void;
}

export function AppointmentClientActionsSheet({
  open,
  onOpenChange,
  onViewClient,
  onRemoveClient,
  onAddAllergy,
  onEditClientDetails,
  onBlockClient,
  onDeleteClient,
}: AppointmentClientActionsSheetProps) {
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
          <SheetTitle>{language === "es" ? "Acciones del cliente" : "Client actions"}</SheetTitle>
          <SheetDescription>
            {language === "es"
              ? "Acciones disponibles para el cliente de esta cita."
              : "Actions available for the client of this appointment."}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 flex justify-end">
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="pb-2">
          <Row Icon={Eye} label={language === "es" ? "Ver cliente" : "View client"} onClick={onViewClient} />
          <Row Icon={FileEdit} label={language === "es" ? "Editar detalles del cliente" : "Edit client details"} onClick={onEditClientDetails} />
          <Row Icon={UserMinus} label={language === "es" ? "Quitar cliente de la cita" : "Remove client from appointment"} onClick={onRemoveClient} />
          <Separator />
          <Row Icon={AlertTriangle} label={language === "es" ? "Agregar alergia" : "Add allergy"} onClick={onAddAllergy} />
          <Row Icon={Ban} label={language === "es" ? "Bloquear cliente" : "Block client"} onClick={onBlockClient} />
          <Row Icon={Trash2} label={language === "es" ? "Eliminar cliente" : "Delete client"} danger onClick={onDeleteClient} />
        </div>
      </SheetContent>
    </Sheet>
  );
}


