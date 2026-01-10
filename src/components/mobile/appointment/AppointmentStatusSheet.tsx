import type React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Check, CalendarCheck, ThumbsUp, Clock, Play, EyeOff, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "started"
  | "completed"
  | "cancelled"
  | "no_show";

interface StatusSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: AppointmentStatus;
  onChange: (next: AppointmentStatus) => void;
  appointment?: {
    id: string;
    business_id: string | null;
    staff_id: string | null;
    status: string | null;
    early_invited?: boolean | null;
    // Check if there's a pending request
    has_pending_request?: boolean | null;
  } | null;
  onEarlyArrivalRequest?: () => void;
}

export function AppointmentStatusSheet({
  open,
  onOpenChange,
  value,
  onChange,
  appointment,
  onEarlyArrivalRequest,
}: StatusSheetProps) {
  const { language } = useLanguage();

  const items: Array<{
    value: AppointmentStatus;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    danger?: boolean;
  }> = [
    {
      value: "pending",
      label: language === "es" ? "Booked" : "Booked",
      Icon: CalendarCheck,
    },
    {
      value: "confirmed",
      label: language === "es" ? "Confirmada" : "Confirmed",
      Icon: ThumbsUp,
    },
    {
      value: "started",
      label: language === "es" ? "Iniciada" : "Started",
      Icon: Play,
    },
    {
      value: "no_show",
      label: language === "es" ? "No-show" : "No-show",
      Icon: EyeOff,
      danger: true,
    },
    {
      value: "cancelled",
      label: language === "es" ? "Cancelar" : "Cancel",
      Icon: XCircle,
      danger: true,
    },
  ];

  // Check if "Puede asistir" button should be shown
  // Only for future appointments (pending or confirmed) that are not cancelled or completed
  const showEarlyArrivalRequest = appointment && 
    appointment.status !== "cancelled" &&
    appointment.status !== "completed" &&
    appointment.status !== "no_show" &&
    appointment.status !== "started" &&
    (appointment.status === "pending" || appointment.status === "confirmed");
  
  // REMOVED: No longer checking for pending requests - allows multiple requests
  // Users can send "puede asistir" multiple times without limit

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 bg-card border-t border-border" hideDefaultClose>
        <SheetHeader className="sr-only">
          <SheetTitle>{language === "es" ? "Estado de la cita" : "Appointment status"}</SheetTitle>
          <SheetDescription>
            {language === "es" ? "Selecciona un estado para la cita." : "Select a status for the appointment."}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 flex justify-end">
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="pb-6">
          {items.map(({ value: v, label, Icon, danger }) => {
            const selected = v === value;
            return (
              <button
                key={v}
                className={cn(
                  "w-full flex items-center justify-between px-6 py-4 text-left border-t border-border/60",
                  danger ? "text-destructive" : "text-foreground"
                )}
                onClick={() => {
                  onChange(v);
                  onOpenChange(false);
                }}
              >
                <div className="flex items-center gap-4">
                  <Icon className={cn("h-5 w-5", danger ? "text-destructive" : "text-foreground")} />
                  <span className="text-base">{label}</span>
                </div>
                {selected ? <Check className="h-5 w-5" /> : <span className="w-5" />}
              </button>
            );
          })}
          
          {/* Early Arrival Request Option - Always visible if status is pending or confirmed */}
          {/* Can be sent multiple times without limit */}
          {showEarlyArrivalRequest && onEarlyArrivalRequest && (
            <>
              <div className="border-t border-border/60" />
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left border-t border-border/60 text-foreground hover:bg-accent/50 transition-colors"
                onClick={() => {
                  onEarlyArrivalRequest();
                  onOpenChange(false);
                }}
              >
                <div className="flex items-center gap-4">
                  <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-base">
                    {language === "es" 
                      ? "Puede asistir"
                      : "Can attend early"
                    }
                  </span>
                </div>
                <span className="w-5" />
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}


