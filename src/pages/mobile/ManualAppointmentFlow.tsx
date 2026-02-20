import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { ManualAppointmentStepper } from "@/components/mobile/manual-appointment/ManualAppointmentStepper";
import { ManualAppointmentClientStep } from "@/components/mobile/manual-appointment/ManualAppointmentClientStep";
import { ManualAppointmentDateTimeStep } from "@/components/mobile/manual-appointment/ManualAppointmentDateTimeStep";
import { ManualAppointmentServicesStep } from "@/components/mobile/manual-appointment/ManualAppointmentServicesStep";
import { ManualAppointmentConfirmationStep } from "@/components/mobile/manual-appointment/ManualAppointmentConfirmationStep";
import { ManualAppointmentSuccessAnimation } from "@/components/mobile/manual-appointment/ManualAppointmentSuccessAnimation";
import { createManualAppointment, ManualAppointmentFormData } from "@/lib/manualAppointmentService";
import type { ManualAppointmentFormData as FormData } from "@/lib/manualAppointmentService";

interface ManualAppointmentFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function ManualAppointmentFlow({
  open,
  onOpenChange,
  onSuccess,
}: ManualAppointmentFlowProps) {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  
  // Datos del formulario
  const [formData, setFormData] = useState<FormData>({
    selectedClientId: null,
    manualName: "",
    manualPhone: "",
    selectedDate: null,
    selectedTime: "",
    selectedServices: [],
    selectedStaff: null,
    notes: "",
  });
  
  // Datos cargados
  const [clients, setClients] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  
  // Cargar datos cuando se abre el modal
  useEffect(() => {
    if (open && profile?.business_id) {
      fetchData();
    }
  }, [open, profile?.business_id]);
  
  // Resetear formulario cuando se cierra
  useEffect(() => {
    if (!open) {
      setStep(1);
      setFormData({
        selectedClientId: null,
        manualName: "",
        manualPhone: "",
        selectedDate: null,
        selectedTime: "",
        selectedServices: [],
        selectedStaff: null,
        notes: "",
      });
      setShowSuccessAnimation(false);
    }
  }, [open]);
  
  const fetchData = async () => {
    if (!profile?.business_id) return;
    
    try {
      const [clientsRes, servicesRes, staffRes] = await Promise.all([
        supabase
          .from("clients")
          .select("*")
          .eq("business_id", profile.business_id)
          .order("full_name"),
        supabase
          .from("services")
          .select("*")
          .eq("business_id", profile.business_id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("staff")
          .select("*")
          .eq("business_id", profile.business_id)
          .eq("is_active", true)
          .order("full_name"),
      ]);
      
      if (clientsRes.data) setClients(clientsRes.data);
      if (servicesRes.data) setServices(servicesRes.data);
      if (staffRes.data) setStaff(staffRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };
  
  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return formData.selectedClientId !== null || formData.manualName.trim().length > 0;
      case 2:
        return formData.selectedDate !== null && formData.selectedTime.length > 0;
      case 3:
        return formData.selectedServices.length > 0 && formData.selectedStaff !== null;
      case 4:
        return true; // Confirmación siempre puede proceder
      default:
        return false;
    }
  };
  
  const handleNext = () => {
    if (!canProceed()) {
      toast({
        title: "Error",
        description: language === "es" 
          ? "Por favor completa todos los campos requeridos"
          : "Please complete all required fields",
        variant: "destructive",
      });
      return;
    }
    
    if (step < 4) {
      setStep(step + 1);
    }
  };
  
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };
  
  const handleConfirm = async () => {
    if (!profile?.business_id) {
      toast({
        title: "Error",
        description: language === "es" ? "Error de autenticación" : "Authentication error",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      await createManualAppointment(
        formData,
        services,
        clients,
        profile.business_id
      );
      
      // Mostrar animación de éxito
      setShowSuccessAnimation(true);
      
      // Cerrar después de 2 segundos
      setTimeout(() => {
        setShowSuccessAnimation(false);
        onOpenChange(false);
        onSuccess?.();
        
        // Disparar evento para refrescar citas en tiempo real
        window.dispatchEvent(new CustomEvent('appointment-created'));
      }, 2000);
      
      toast({
        title: language === "es" ? "Cita creada" : "Appointment created",
        description: language === "es" 
          ? "La cita ha sido creada exitosamente"
          : "The appointment has been created successfully",
      });
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      toast({
        title: "Error",
        description: error?.message || (language === "es" 
          ? "Error al crear la cita"
          : "Failed to create appointment"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="bottom" 
          className="h-[90vh] overflow-hidden p-0 w-full max-w-full"
        >
          <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
            {/* Header con Stepper */}
            <div className="border-b p-4 w-full max-w-full shrink-0">
              <ManualAppointmentStepper currentStep={step} totalSteps={4} />
            </div>
            
            {/* Contenido del paso actual */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full">
              {step === 1 && (
                <ManualAppointmentClientStep
                  clients={clients}
                  selectedClientId={formData.selectedClientId}
                  manualName={formData.manualName}
                  manualPhone={formData.manualPhone}
                  onClientIdChange={(id) => {
                    // ✅ Convertir "none" a null
                    const clientId = id === "none" ? null : id;
                    setFormData({ ...formData, selectedClientId: clientId });
                  }}
                  onManualNameChange={(name) => setFormData({ ...formData, manualName: name })}
                  onManualPhoneChange={(phone) => setFormData({ ...formData, manualPhone: phone })}
                />
              )}
              
              {step === 2 && (
                <ManualAppointmentDateTimeStep
                  selectedDate={formData.selectedDate}
                  selectedTime={formData.selectedTime}
                  onDateChange={(date) => setFormData({ ...formData, selectedDate: date || null })}
                  onTimeChange={(time) => setFormData({ ...formData, selectedTime: time })}
                />
              )}
              
              {step === 3 && (
                <ManualAppointmentServicesStep
                  services={services}
                  staff={staff}
                  selectedServices={formData.selectedServices}
                  selectedStaff={formData.selectedStaff}
                  onServicesChange={(services) => setFormData({ ...formData, selectedServices: services })}
                  onStaffChange={(staff) => setFormData({ ...formData, selectedStaff: staff })}
                />
              )}
              
              {step === 4 && (
                <ManualAppointmentConfirmationStep
                  selectedClientId={formData.selectedClientId}
                  manualName={formData.manualName}
                  manualPhone={formData.manualPhone}
                  clients={clients}
                  selectedDate={formData.selectedDate}
                  selectedTime={formData.selectedTime}
                  selectedServices={formData.selectedServices}
                  selectedStaff={formData.selectedStaff}
                  services={services}
                  staff={staff}
                  notes={formData.notes}
                />
              )}
            </div>
            
            {/* Navegación */}
            <div className="border-t p-4 flex items-center justify-between gap-2 w-full max-w-full shrink-0 bg-background">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 1 || loading}
                className="shrink-0"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {language === "es" ? "Atrás" : "Back"}
              </Button>
              
              {step < 4 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed() || loading}
                  className="shrink-0"
                >
                  {language === "es" ? "Siguiente" : "Next"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleConfirm}
                  disabled={loading || !canProceed()}
                  className="flex-1 min-w-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {language === "es" ? "Creando..." : "Creating..."}
                    </>
                  ) : (
                    language === "es" ? "Confirmar Cita" : "Confirm Appointment"
                  )}
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Animación de éxito */}
      <ManualAppointmentSuccessAnimation show={showSuccessAnimation} />
    </>
  );
}

