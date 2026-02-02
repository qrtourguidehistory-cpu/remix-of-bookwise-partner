import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";
import { CalendarHeader, FilterState } from "@/components/mobile/CalendarHeader";
import { DayView } from "@/components/mobile/DayView";
import { WeekView } from "@/components/mobile/WeekView";
import { MonthView } from "@/components/mobile/MonthView";
import { StaffCalendarView } from "@/components/mobile/StaffCalendarView";
import { NextTurnowView } from "@/components/mobile/NextTurnowView";
import { TutorialTip } from "@/components/mobile/TutorialTip";
import { ApprovalSuccessBanner } from "@/components/mobile/ApprovalSuccessBanner";
import { useTutorialTips } from "@/hooks/useTutorialTips";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { isSameDay, parseISO } from "date-fns";

export default function MobileCalendar() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { canShowTip, markTipAsSeen, setActiveTip } = useTutorialTips();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week" | "month" | "staff" | "next" | "next-turnow">("day");
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    statuses: [],
    staffIds: [],
    serviceIds: []
  });
  const [appointmentToOpen, setAppointmentToOpen] = useState<string | null>(null);
  const [showPublicProfileTip, setShowPublicProfileTip] = useState(false);
  const today = new Date();
  const isToday = isSameDay(currentDate, today);


  // Check if we should show the public profile tip
  useEffect(() => {
    const checkBusinessPublicStatus = async () => {
      if (!profile?.business_id) return;

      try {
        const { data } = await supabase
          .from("businesses")
          .select("is_public, onboarding_completed")
          .eq("id", profile.business_id)
          .maybeSingle();

        // Show tip if business exists, onboarding is completed, and is_public is false
        // Only show after a short delay and if no other tip is active
        if (data?.onboarding_completed && !data?.is_public && canShowTip("complete_public_profile")) {
          setTimeout(() => {
            setShowPublicProfileTip(true);
            setActiveTip("complete_public_profile");
          }, 2000);
        }
      } catch (error) {
        console.error("Error checking business status:", error);
      }
    };

    checkBusinessPublicStatus();
  }, [profile?.business_id, canShowTip]);

  // ✅ FUNCIÓN AUXILIAR: Abrir cita con fecha (usando useCallback para estabilidad)
  const openAppointmentWithDate = useCallback(async (appointmentId: string, appointmentDate?: string) => {
    console.log('[MobileCalendar] 🎯 openAppointmentWithDate llamado:', { appointmentId, appointmentDate });
    
    if (!appointmentId) {
      console.error('[MobileCalendar] ❌ appointmentId es requerido');
      return;
    }
    
    let finalDate = appointmentDate;
    
    // Si no tenemos fecha, obtenerla de la BD
    if (!finalDate && appointmentId) {
      console.log('[MobileCalendar] 🔍 Obteniendo fecha de BD para appointmentId:', appointmentId);
      try {
        const { data: apt, error } = await supabase
          .from('appointments')
          .select('appointment_date')
          .eq('id', appointmentId)
          .single();
        
        if (error) {
          console.error('[MobileCalendar] ❌ Error en query:', error);
        } else if (apt?.appointment_date) {
          finalDate = apt.appointment_date;
          console.log('[MobileCalendar] ✅ Fecha obtenida de BD:', finalDate);
        } else {
          console.warn('[MobileCalendar] ⚠️ No se encontró appointment_date en BD');
        }
      } catch (error) {
        console.error('[MobileCalendar] ❌ Excepción obteniendo fecha de cita:', error);
      }
    }
    
    // Cambiar a la fecha de la cita
    if (finalDate) {
      try {
        // Intentar parsear como ISO string (YYYY-MM-DD)
        const date = parseISO(finalDate);
        console.log('[MobileCalendar] 📅 Cambiando fecha del calendario a:', date.toISOString());
        setCurrentDate(date);
        setView("day");
      } catch (e) {
        console.error('[MobileCalendar] ❌ Error parseando fecha:', e, 'fecha recibida:', finalDate);
        setView("day");
      }
    } else {
      console.warn('[MobileCalendar] ⚠️ No se pudo obtener fecha, usando vista día actual');
      setView("day");
    }
    
    // Abrir la cita
    console.log('[MobileCalendar] 📌 Estableciendo appointmentToOpen:', appointmentId);
    setAppointmentToOpen(appointmentId);
  }, []);

  // ✅ EVENT BUS: Listener para ROUTING_REQUEST desde push notifications (legacy, mantenido para compatibilidad)
  useEffect(() => {
    const handleRoutingRequest = (event: CustomEvent) => {
      const { path, appointmentId, appointmentDate } = event.detail;
      
      // Navegar a la ruta solicitada (usar replace para evitar refrescos)
      if (path && window.location.pathname !== path) {
        navigate(path, { replace: true });
      }
      
      // Si tenemos appointmentId, abrir la cita
      if (appointmentId) {
        // Pequeño delay para asegurar que la navegación se complete
        setTimeout(() => {
          openAppointmentWithDate(appointmentId, appointmentDate);
        }, 100);
      }
    };

    window.addEventListener('ROUTING_REQUEST', handleRoutingRequest as EventListener);
    
    return () => {
      window.removeEventListener('ROUTING_REQUEST', handleRoutingRequest as EventListener);
    };
  }, [navigate, openAppointmentWithDate]);

  // ✅ LISTENER: openAppointmentDetail desde notificaciones del panel y push notifications
  useEffect(() => {
    const handleOpenAppointment = (event: CustomEvent) => {
      console.log('[MobileCalendar] 📨 Evento openAppointmentDetail recibido:', event.detail);
      const { appointmentId, appointmentDate } = event.detail || {};
      
      if (appointmentId) {
        console.log('[MobileCalendar] ✅ Procesando evento con appointmentId:', appointmentId, 'appointmentDate:', appointmentDate);
        // ✅ Navegación sin refrescos: Si no estamos en /mobile/calendar, navegar primero
        const currentPath = window.location.pathname;
        if (currentPath !== '/mobile/calendar') {
          navigate('/mobile/calendar', { replace: true });
          // Esperar a que la navegación se complete antes de abrir la cita
          setTimeout(() => {
            openAppointmentWithDate(appointmentId, appointmentDate);
          }, 200);
        } else {
          // Ya estamos en el calendario, abrir directamente
          openAppointmentWithDate(appointmentId, appointmentDate);
        }
      } else {
        console.warn('[MobileCalendar] ⚠️ Evento openAppointmentDetail sin appointmentId. Detail completo:', event.detail);
      }
    };

    console.log('[MobileCalendar] 🎧 Registrando listener para openAppointmentDetail');
    window.addEventListener('openAppointmentDetail', handleOpenAppointment as EventListener);
    
    return () => {
      console.log('[MobileCalendar] 🧹 Removiendo listener openAppointmentDetail');
      window.removeEventListener('openAppointmentDetail', handleOpenAppointment as EventListener);
    };
  }, [navigate, openAppointmentWithDate]);

  const handleDateSelect = (date: Date) => {
    setCurrentDate(date);
    setView("day");
  };

  const handleReturnToToday = () => {
    setCurrentDate(new Date());
    setView("day");
  };

  return (
    <MobileLayout>
      {/* Approval Success Banner */}
      <ApprovalSuccessBanner />
      
      <CalendarHeader
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        view={view}
        onViewChange={setView}
        filters={filters}
        onFiltersChange={setFilters}
      />
      
      {view === "day" && (
        <DayView 
          date={currentDate} 
          filters={filters} 
          appointmentToOpen={appointmentToOpen}
          onAppointmentOpened={() => setAppointmentToOpen(null)}
        />
      )}
      {view === "week" && <WeekView date={currentDate} filters={filters} />}
      {view === "month" && <MonthView date={currentDate} onDateSelect={handleDateSelect} />}
      {view === "staff" && <StaffCalendarView date={currentDate} filters={filters} />}
      {view === "next" && <NextTurnowView filters={filters} />}
      

      
      {/* Floating button to return to today - only show when not on today */}
      {!isToday && (
        <Button
          onClick={handleReturnToToday}
          size="icon"
          className="fixed right-4 h-12 w-12 rounded-full shadow-lg z-40"
          style={{ 
            bottom: "calc(var(--bottom-nav-height, 76px) + max(16px, env(safe-area-inset-bottom, 0px)) + 16px)" 
          }}
          title="Regresar a hoy"
        >
          <Calendar className="h-5 w-5" />
        </Button>
      )}

      {/* Tutorial tip for completing public profile */}
      <TutorialTip
        isVisible={showPublicProfileTip}
        title="¡Publica tu establecimiento!"
        message="Para que tus clientes puedan encontrarte, completa tu perfil público en Configuración."
        onDismiss={() => {
          setShowPublicProfileTip(false);
          markTipAsSeen("complete_public_profile");
        }}
        actionLabel="Ir a Configuración"
        onAction={() => navigate("/admin/business-profile")}
        position="bottom"
        delay={1000}
      />
    </MobileLayout>
  );
}
