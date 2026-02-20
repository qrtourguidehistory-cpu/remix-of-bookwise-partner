import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Briefcase, Users, Clock, DollarSign } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
}

interface Staff {
  id: string;
  full_name: string;
}

interface ManualAppointmentServicesStepProps {
  services: Service[];
  staff: Staff[];
  selectedServices: string[];
  selectedStaff: string | null;
  onServicesChange: (serviceIds: string[]) => void;
  onStaffChange: (staffId: string | null) => void;
}

export function ManualAppointmentServicesStep({
  services,
  staff,
  selectedServices,
  selectedStaff,
  onServicesChange,
  onStaffChange,
}: ManualAppointmentServicesStepProps) {
  const { language } = useLanguage();
  
  const handleServiceToggle = (serviceId: string) => {
    if (selectedServices.includes(serviceId)) {
      onServicesChange(selectedServices.filter(id => id !== serviceId));
    } else {
      onServicesChange([...selectedServices, serviceId]);
    }
  };
  
  // Calcular duración y precio total
  const totalDuration = selectedServices.reduce((sum, serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return sum + (service?.duration_minutes || 0);
  }, 0);
  
  const totalPrice = selectedServices.reduce((sum, serviceId) => {
    const service = services.find(s => s.id === serviceId);
    const price = typeof service?.price === 'number' ? service.price : parseFloat(service?.price || '0');
    return sum + price;
  }, 0);
  
  const isValid = selectedServices.length > 0 && selectedStaff !== null;
  
  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-xl font-semibold mb-2">
          {language === "es" ? "Servicios y Personal" : "Services and Staff"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === "es" 
            ? "Selecciona los servicios y el personal que atenderá la cita"
            : "Select services and staff member for the appointment"}
        </p>
      </div>
      
      {/* Selección de Servicios */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          {language === "es" ? "Servicios" : "Services"} * 
          <span className="text-xs text-muted-foreground font-normal">
            ({language === "es" ? "puedes seleccionar varios" : "you can select multiple"})
          </span>
        </Label>
        <ScrollArea className="h-[200px] border rounded-lg p-4">
          <div className="space-y-3">
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {language === "es" ? "No hay servicios disponibles" : "No services available"}
              </p>
            ) : (
              services.map((service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <div
                    key={service.id}
                    onClick={() => handleServiceToggle(service.id)}
                    className={cn(
                      "flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-accent"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleServiceToggle(service.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{service.name}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {service.duration_minutes} {language === "es" ? "min" : "min"}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${typeof service.price === 'number' ? service.price : parseFloat(service.price || '0')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
        
        {/* Resumen de servicios seleccionados */}
        {selectedServices.length > 0 && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">
              {language === "es" ? "Resumen:" : "Summary:"}
            </p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {language === "es" ? "Servicios seleccionados:" : "Selected services:"}
                </span>
                <span className="font-medium">{selectedServices.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {language === "es" ? "Duración total:" : "Total duration:"}
                </span>
                <span className="font-medium">{totalDuration} {language === "es" ? "min" : "min"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {language === "es" ? "Precio total:" : "Total price:"}
                </span>
                <span className="font-medium">${totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Selección de Staff */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {language === "es" ? "Personal" : "Staff"} *
        </Label>
        <Select
          value={selectedStaff || ""}
          onValueChange={(value) => onStaffChange(value || null)}
        >
          <SelectTrigger>
            <SelectValue placeholder={language === "es" ? "Seleccionar personal..." : "Select staff..."} />
          </SelectTrigger>
          <SelectContent>
            {staff.length === 0 ? (
              // ✅ No usar SelectItem con value vacío, usar un div o texto simple
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {language === "es" ? "No hay personal disponible" : "No staff available"}
              </div>
            ) : (
              staff
                .filter(member => {
                  // ✅ Filtrar miembros sin ID válido
                  const id = member.id?.toString().trim();
                  return id && id !== "" && id !== "null" && id !== "undefined";
                })
                .map((member) => {
                  // ✅ Convertir ID a string explícitamente
                  const memberId = member.id.toString();
                  return (
                    <SelectItem key={memberId} value={memberId}>
                      {member.full_name}
                    </SelectItem>
                  );
                })
            )}
          </SelectContent>
        </Select>
      </div>
      
      {!isValid && (
        <p className="text-sm text-destructive text-center">
          {language === "es" 
            ? "Por favor selecciona al menos un servicio y un miembro del personal"
            : "Please select at least one service and a staff member"}
        </p>
      )}
    </div>
  );
}

