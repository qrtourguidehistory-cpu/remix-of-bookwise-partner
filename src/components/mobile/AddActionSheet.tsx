import { Calendar, DollarSign, Briefcase, Clock, Users, Image, List, Grid3x3 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface AddActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddActionSheet({ open, onOpenChange }: AddActionSheetProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    const saved = localStorage.getItem("add-action-view-mode");
    return (saved as "list" | "grid") || "grid";
  });

  useEffect(() => {
    localStorage.setItem("add-action-view-mode", viewMode);
  }, [viewMode]);

  const actions = [
    { icon: DollarSign, label: language === "es" ? "Venta" : "Sale", color: "text-green-500", path: "/admin/sales/new" },
    { icon: Calendar, label: language === "es" ? "Cita" : "Appointment", color: "text-blue-500", path: "/admin/appointments/new" },
    { icon: Briefcase, label: language === "es" ? "Servicio" : "Service", color: "text-purple-500", path: "/admin/services/new" },
    { icon: Clock, label: language === "es" ? "Horarios" : "Schedules", color: "text-orange-500", path: "/admin/schedules" },
    { icon: Users, label: language === "es" ? "Personal" : "Staff", color: "text-pink-500", path: "/admin/staff/new" },
    { icon: Image, label: language === "es" ? "Galería" : "Gallery", color: "text-cyan-500", path: "/admin/gallery" },
  ];

  const handleAction = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-t border-border">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>{language === "es" ? "Agregar Nuevo" : "Add New"}</SheetTitle>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("list")}
                className={cn(
                  "h-7 px-2",
                  viewMode === "list" && "bg-background"
                )}
                title={language === "es" ? "Vista de lista" : "List view"}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "h-7 px-2",
                  viewMode === "grid" && "bg-background"
                )}
                title={language === "es" ? "Vista de cuadrícula" : "Grid view"}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>
        {viewMode === "list" ? (
          <div className="flex flex-col gap-2 mt-6">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.label}
                  variant="ghost"
                  onClick={() => handleAction(action.path)}
                  className="justify-start gap-3 h-12"
                >
                  <div className={cn("p-2 rounded-full bg-muted", action.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span>{action.label}</span>
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 mt-6">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.label}
                  variant="ghost"
                  onClick={() => handleAction(action.path)}
                  className="flex flex-col items-center gap-1.5 h-auto min-h-[90px] py-3"
                >
                  <div className={cn("p-2.5 rounded-full bg-muted", action.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold leading-tight line-clamp-2 text-center px-1">
                    {action.label}
                  </span>
                </Button>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
