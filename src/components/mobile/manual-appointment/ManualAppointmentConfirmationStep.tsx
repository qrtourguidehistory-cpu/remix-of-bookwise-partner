import { User, Phone, Calendar, Clock, Briefcase, Users, DollarSign } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatTime } from "@/lib/timeFormat";

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

interface Client {
  id: string;
  full_name: string;
  phone: string | null;
}

interface ManualAppointmentConfirmationStepProps {
  // Cliente
  selectedClientId: string | null;
  manualName: string;
  manualPhone: string;
  clients: Client[];
  
  // Fecha y Hora
  selectedDate: Date | null;
  selectedTime: string;
  
  // Servicios y Staff
  selectedServices: string[];
  selectedStaff: string | null;
  services: Service[];
  staff: Staff[];
  
  // Notas
  notes?: string;
}

export function ManualAppointmentConfirmationStep({
  selectedClientId,
  manualName,
  manualPhone,
  clients,
  selectedDate,
  selectedTime,
  selectedServices,
  selectedStaff,
  services,
  staff,
  notes,
}: ManualAppointmentConfirmationStepProps) {
  const { language } = useLanguage();
  
  // Obtener datos del cliente
  let clientName = "";
  let clientPhone: string | null = null;
  
  if (selectedClientId) {
    const selectedClient = clients.find(c => c.id === selectedClientId);
    if (selectedClient) {
      clientName = selectedClient.full_name;
      clientPhone = selectedClient.phone;
    }
  } else {
    clientName = manualName.trim();
    clientPhone = manualPhone.trim() || null;
  }
  
  // Obtener datos del staff
  const selectedStaffMember = staff.find(s => s.id === selectedStaff);
  const staffName = selectedStaffMember?.full_name || "";
  
  // Calcular totales
  const selectedServicesData = selectedServices
    .map(id => services.find(s => s.id === id))
    .filter(Boolean) as Service[];
  
  const totalDuration = selectedServicesData.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const totalPrice = selectedServicesData.reduce((sum, s) => {
    const price = typeof s.price === 'number' ? s.price : parseFloat(s.price || '0');
    return sum + price;
  }, 0);
  
  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-xl font-semibold mb-2">
          {language === "es" ? "Confirmación" : "Confirmation"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === "es" 
            ? "Revisa los detalles de la cita antes de confirmar"
            : "Review appointment details before confirming"}
        </p>
      </div>
      
      <div className="space-y-4">
        {/* Información del Cliente */}
        <div className="p-4 border rounded-lg space-y-2">
          <h3 className="font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            {language === "es" ? "Cliente" : "Client"}
          </h3>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{clientName}</p>
            {clientPhone && (
              <p className="text-muted-foreground flex items-center gap-2">
                <Phone className="h-3 w-3" />
                {clientPhone}
              </p>
            )}
          </div>
        </div>
        
        {/* Fecha y Hora */}
        <div className="p-4 border rounded-lg space-y-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {language === "es" ? "Fecha y Hora" : "Date and Time"}
          </h3>
          <div className="space-y-1 text-sm">
            {selectedDate && (
              <p className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {format(selectedDate, "EEEE, d 'de' MMMM, yyyy", { locale: language === "es" ? es : undefined })}
              </p>
            )}
            {selectedTime && (
              <p className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                {formatTime(selectedTime, "12h")}
              </p>
            )}
          </div>
        </div>
        
        {/* Servicios */}
        <div className="p-4 border rounded-lg space-y-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            {language === "es" ? "Servicios" : "Services"}
          </h3>
          <div className="space-y-2">
            {selectedServicesData.map((service) => (
              <div key={service.id} className="flex justify-between text-sm">
                <span>{service.name}</span>
                <span className="text-muted-foreground">
                  {service.duration_minutes} {language === "es" ? "min" : "min"} • ${typeof service.price === 'number' ? service.price : parseFloat(service.price || '0')}
                </span>
              </div>
            ))}
            <div className="pt-2 border-t flex justify-between font-medium">
              <span>{language === "es" ? "Total:" : "Total:"}</span>
              <span>
                {totalDuration} {language === "es" ? "min" : "min"} • ${totalPrice.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Staff */}
        <div className="p-4 border rounded-lg space-y-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            {language === "es" ? "Personal" : "Staff"}
          </h3>
          <p className="text-sm">{staffName}</p>
        </div>
        
        {/* Notas */}
        {notes && notes.trim() && (
          <div className="p-4 border rounded-lg space-y-2">
            <h3 className="font-semibold">
              {language === "es" ? "Notas" : "Notes"}
            </h3>
            <p className="text-sm text-muted-foreground">{notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

