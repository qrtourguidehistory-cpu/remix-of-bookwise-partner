import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { convertTo24Hour } from "@/lib/timeFormat";

export interface ManualAppointmentFormData {
  // Paso 1: Cliente
  selectedClientId: string | null;
  manualName: string;
  manualPhone: string;
  
  // Paso 2: Fecha y Hora
  selectedDate: Date | null;
  selectedTime: string; // formato "HH:MM:SS" o "HH:MM"
  
  // Paso 3: Servicios y Staff
  selectedServices: string[]; // Array de service_ids
  selectedStaff: string | null;
  
  // Paso 4: Notas
  notes?: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
}

interface Client {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}

/**
 * Calcula el tiempo de finalización basado en el tiempo de inicio y la duración total
 */
function calculateEndTime(startTime: string, totalDurationMinutes: number): string {
  // Parsear startTime (formato "HH:MM:SS" o "HH:MM")
  const timeMatch = startTime.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!timeMatch) {
    throw new Error("Formato de hora inválido");
  }
  
  let hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  
  // Convertir a minutos totales desde medianoche
  const startTotalMinutes = hours * 60 + minutes;
  const endTotalMinutes = startTotalMinutes + totalDurationMinutes;
  
  // Convertir de vuelta a horas y minutos
  const endHours = Math.floor(endTotalMinutes / 60) % 24;
  const endMinutes = endTotalMinutes % 60;
  
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:00`;
}

/**
 * Crea una cita manual en Supabase
 */
export async function createManualAppointment(
  formData: ManualAppointmentFormData,
  services: Service[],
  clients: Client[],
  businessId: string
): Promise<any> {
  // Validaciones básicas
  if (!formData.selectedDate) {
    throw new Error("Fecha es requerida");
  }
  if (!formData.selectedTime) {
    throw new Error("Hora es requerida");
  }
  if (formData.selectedServices.length === 0) {
    throw new Error("Al menos un servicio es requerido");
  }
  if (!formData.selectedStaff) {
    throw new Error("Staff es requerido");
  }
  
  // Validar cliente
  if (!formData.selectedClientId && !formData.manualName.trim()) {
    throw new Error("Nombre del cliente es requerido");
  }
  
  // Obtener datos del cliente
  let clientName = "";
  let clientPhone: string | null = null;
  let clientEmail: string | null = null;
  
  if (formData.selectedClientId) {
    const selectedClient = clients.find(c => c.id === formData.selectedClientId);
    if (selectedClient) {
      clientName = selectedClient.full_name;
      clientPhone = selectedClient.phone || null;
      clientEmail = selectedClient.email || null;
    }
  } else {
    clientName = formData.manualName.trim();
    clientPhone = formData.manualPhone.trim() || null;
  }
  
  // Calcular duración y precio total de todos los servicios
  const totalDuration = formData.selectedServices.reduce((sum, serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return sum + (service?.duration_minutes || 0);
  }, 0);
  
  const totalPrice = formData.selectedServices.reduce((sum, serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return sum + (typeof service?.price === 'number' ? service.price : parseFloat(service?.price || '0'));
  }, 0);
  
  // Obtener el primer servicio para service_id principal
  const firstService = services.find(s => s.id === formData.selectedServices[0]);
  if (!firstService) {
    throw new Error("Servicio no encontrado");
  }
  
  // Convertir tiempo a formato 24h
  // TimePicker devuelve "HH:MM:SS" en formato 24h, pero puede venir en formato 12h también
  let startTime24h: string;
  if (formData.selectedTime.includes("am") || formData.selectedTime.includes("pm")) {
    // Formato 12h, convertir
    startTime24h = convertTo24Hour(formData.selectedTime);
  } else {
    // Ya está en formato 24h "HH:MM:SS" o "HH:MM"
    const timeMatch = formData.selectedTime.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (timeMatch) {
      const hours = timeMatch[1].padStart(2, "0");
      const minutes = timeMatch[2];
      startTime24h = `${hours}:${minutes}:00`;
    } else {
      throw new Error("Formato de hora inválido");
    }
  }
  const endTime24h = calculateEndTime(startTime24h, totalDuration);
  
  // Preparar datos de la cita
  const appointmentDateStr = format(formData.selectedDate, "yyyy-MM-dd");
  
  const appointmentData: any = {
    business_id: businessId,
    appointment_date: appointmentDateStr,
    date: appointmentDateStr,
    start_time: startTime24h,
    end_time: endTime24h,
    service_id: firstService.id,
    staff_id: formData.selectedStaff,
    status: "confirmed",
    payment_amount: totalPrice,
    
    // ✅ CRÍTICO: Cita manual - NO client_id, NO user_id
    client_id: null, // NULL para citas manuales
    user_id: null,   // NULL para citas manuales (si existe el campo)
    
    // ✅ Datos manuales del cliente
    client_name: clientName,
    client_phone: clientPhone,
    client_email: clientEmail,
    
    notes: formData.notes?.trim() || null,
  };
  
  // Insertar cita principal
  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert(appointmentData)
    .select()
    .single();
  
  if (error) {
    console.error("Error creating appointment:", error);
    throw error;
  }
  
  // Si hay servicios adicionales, agregarlos a appointment_services
  const otherServices = formData.selectedServices.slice(1);
  if (otherServices.length > 0 && appointment) {
    const appointmentServicesData = otherServices.map(serviceId => {
      const service = services.find(s => s.id === serviceId);
      return {
        appointment_id: appointment.id,
        service_id: serviceId,
        price: typeof service?.price === 'number' ? service.price : parseFloat(service?.price || '0'),
        staff_id: formData.selectedStaff,
        duration_minutes: service?.duration_minutes || 30,
        quantity: 1,
      };
    });
    
    const { error: servicesError } = await supabase
      .from("appointment_services")
      .insert(appointmentServicesData);
    
    if (servicesError) {
      console.error("Error adding additional services:", servicesError);
      // No fallar la creación de la cita si falla agregar servicios adicionales
      // Solo loguear el error
    }
  }
  
  return appointment;
}

