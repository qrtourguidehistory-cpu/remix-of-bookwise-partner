import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Menu, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addDays, subDays, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TutorialTip } from "./TutorialTip";
import { useTutorialTips } from "@/hooks/useTutorialTips";

export interface FilterState {
  searchQuery: string;
  statuses: string[];
  staffIds: string[];
  serviceIds: string[];
}

interface CalendarHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: "day" | "week" | "month" | "staff";
  onViewChange: (view: "day" | "week" | "month" | "staff") => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function CalendarHeader({ currentDate, onDateChange, view, onViewChange, filters, onFiltersChange }: CalendarHeaderProps) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const { canShowTip, markTipAsSeen, setActiveTip, activeTip } = useTutorialTips();
  const [filterOpen, setFilterOpen] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [showFilterTip, setShowFilterTip] = useState(false);
  const [filterButtonPressed, setFilterButtonPressed] = useState(false);

  // Show filter tip when button is pressed for first time
  const handleFilterButtonClick = () => {
    if (canShowTip("filter_button_tip") && !filterButtonPressed) {
      setFilterButtonPressed(true);
      setShowFilterTip(true);
      setActiveTip("filter_button_tip");
    }
    setFilterOpen(true);
  };

  useEffect(() => {
    if (profile?.business_id) {
      fetchStaffAndServices();
    }
  }, [profile?.business_id]);

  const fetchStaffAndServices = async () => {
    if (!profile?.business_id) return;
    
    const [staffData, servicesData] = await Promise.all([
      supabase
        .from("staff")
        .select("id, full_name")
        .eq("business_id", profile.business_id)
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("services")
        .select("id, name")
        .eq("business_id", profile.business_id)
        .eq("is_active", true)
        .order("name")
    ]);
    
    if (staffData.data) setStaff(staffData.data);
    if (servicesData.data) setServices(servicesData.data);
  };

  const activeFiltersCount = 
    (filters.searchQuery ? 1 : 0) +
    (filters.statuses.length > 0 && filters.statuses.length < 5 ? 1 : 0) +
    (filters.staffIds.length > 0 ? 1 : 0) +
    (filters.serviceIds.length > 0 ? 1 : 0);

  const handlePrev = () => {
    if (view === "day") {
      onDateChange(subDays(currentDate, 1));
    } else if (view === "week") {
      onDateChange(subDays(currentDate, 7));
    } else {
      onDateChange(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === "day") {
      onDateChange(addDays(currentDate, 1));
    } else if (view === "week") {
      onDateChange(addDays(currentDate, 7));
    } else {
      onDateChange(addMonths(currentDate, 1));
    }
  };

  const getDateDisplay = () => {
    if (view === "month") {
      return format(currentDate, "MMMM yyyy", { locale: es });
    }
    if (view === "staff") {
      return format(currentDate, "EEE d MMM", { locale: es });
    }
    return format(currentDate, "EEE d MMM", { locale: es });
  };

  const handleStatusToggle = (status: string, checked: boolean) => {
    const newStatuses = checked
      ? [...filters.statuses, status]
      : filters.statuses.filter(s => s !== status);
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const handleStaffToggle = (staffId: string, checked: boolean) => {
    const newStaffIds = checked
      ? [...filters.staffIds, staffId]
      : filters.staffIds.filter(id => id !== staffId);
    onFiltersChange({ ...filters, staffIds: newStaffIds });
  };

  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    const newServiceIds = checked
      ? [...filters.serviceIds, serviceId]
      : filters.serviceIds.filter(id => id !== serviceId);
    onFiltersChange({ ...filters, serviceIds: newServiceIds });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      searchQuery: "",
      statuses: [],
      staffIds: [],
      serviceIds: []
    });
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-foreground">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onViewChange("day")}>
              {t("calendar")} - {t("day") || "Día"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewChange("week")}>
              {t("calendar")} - {t("week") || "Semana"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewChange("month")}>
              {t("calendar")} - {t("month") || "Mes"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewChange("staff")}>
              {t("calendar")} - Por Personal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handlePrev} className="text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium capitalize min-w-[120px] text-center text-foreground">
            {getDateDisplay()}
          </span>
          <Button variant="ghost" size="icon" onClick={handleNext} className="text-foreground">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleFilterButtonClick} 
            className="text-primary relative"
          >
            <Filter className="h-5 w-5" />
            {activeFiltersCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      {activeFiltersCount > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, servicio o personal..."
                value={filters.searchQuery}
                onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
                className="pl-10 pr-10"
              />
              {filters.searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => onFiltersChange({ ...filters, searchQuery: "" })}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              Limpiar
            </Button>
          </div>
        </div>
      )}

      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="bg-card h-[85vh]">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              {t("filter") || "Filtros"}
              {activeFiltersCount > 0 && (
                <Badge variant="secondary">{activeFiltersCount} activos</Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(85vh-120px)] mt-6">
            <div className="space-y-6 pr-4">
              {/* Search */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Búsqueda</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente, servicio o personal..."
                    value={filters.searchQuery}
                    onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Status Filters */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Estado de Citas</Label>
                <div className="space-y-2">
                  {[
                    { value: "confirmed", label: "Confirmada" },
                    { value: "pending", label: "Pendiente" },
                    { value: "completed", label: "Completada" },
                    { value: "cancelled", label: "Cancelada" },
                    { value: "no_show", label: "No Asistió" }
                  ].map((status) => (
                    <div key={status.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={status.value}
                        checked={filters.statuses.includes(status.value)}
                        onCheckedChange={(checked) => handleStatusToggle(status.value, checked as boolean)}
                      />
                      <label htmlFor={status.value} className="text-sm cursor-pointer">
                        {status.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff Filters */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Personal</Label>
                <div className="space-y-2">
                  {staff.map((member) => (
                    <div key={member.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`staff-${member.id}`}
                        checked={filters.staffIds.includes(member.id)}
                        onCheckedChange={(checked) => handleStaffToggle(member.id, checked as boolean)}
                      />
                      <label htmlFor={`staff-${member.id}`} className="text-sm cursor-pointer">
                        {member.full_name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Service Filters */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Servicios</Label>
                <div className="space-y-2">
                  {services.map((service) => (
                    <div key={service.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`service-${service.id}`}
                        checked={filters.serviceIds.includes(service.id)}
                        onCheckedChange={(checked) => handleServiceToggle(service.id, checked as boolean)}
                      />
                      <label htmlFor={`service-${service.id}`} className="text-sm cursor-pointer">
                        {service.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t">
            <div className="flex gap-2">
              <Button variant="outline" onClick={clearAllFilters} className="flex-1">
                Limpiar Todo
              </Button>
              <Button onClick={() => setFilterOpen(false)} className="flex-1">
                Aplicar Filtros
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Tutorial tip for filter button */}
      <TutorialTip
        isVisible={showFilterTip}
        title="Filtros del Calendario"
        message="Filtra las citas por estado, personal o servicio para encontrar lo que buscas rápidamente."
        onDismiss={() => {
          setShowFilterTip(false);
          markTipAsSeen("filter_button_tip");
        }}
        position="top"
        delay={300}
      />
    </>
  );
}
