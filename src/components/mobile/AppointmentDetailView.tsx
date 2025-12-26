import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Calendar, Clock, Scissors, User, DollarSign, Phone, Mail, Edit2, ChevronDown, MoreHorizontal, Plus, X, Check, Ban, UserX } from "lucide-react";
import { formatTime } from "@/lib/timeFormat";
import { supabase } from "@/lib/supabaseClient";
import { UserProfileModal } from "./UserProfileModal";
import { toast } from "sonner";
import { AppointmentStatusSheet, type AppointmentStatus } from "./appointment/AppointmentStatusSheet";
import { AppointmentClientActionsSheet } from "./appointment/AppointmentClientActionsSheet";
import { AppointmentQuickActionsSheet } from "./appointment/AppointmentQuickActionsSheet";
import { AddServiceSheet, type ServicePick } from "./appointment/AddServiceSheet";
import { EditServiceSheet } from "./appointment/EditServiceSheet";
import { CheckoutSheet, type CheckoutLine } from "./appointment/CheckoutSheet";
import { PaymentSheet, type PaymentMethod } from "./appointment/PaymentSheet";
import { ClientNoteDialog } from "./clients/ClientNoteDialog";
import { AddNoteSheet } from "./appointment/AddNoteSheet";
import { ClientActivityView } from "./appointment/ClientActivityView";
import { createEarlyArrivalRequest } from "@/lib/earlyArrivalRequestService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AppointmentDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  onEdit?: () => void;
  onQuickAction?: (status: AppointmentStatus) => void;
}

export function AppointmentDetailView({
  open,
  onOpenChange,
  appointment,
  onEdit,
  onQuickAction,
}: AppointmentDetailViewProps) {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const hasAppointment = Boolean(appointment);
  // ✅ FIX: Calculate reserverUserId with better fallback logic
  const reserverUserId = appointment?.user_id || 
                        appointment?.clients?.user_id || 
                        undefined;
  // Use client_id from appointment, or fallback to clients.id if relation is loaded
  const clientId = appointment?.client_id || 
                   appointment?.clients?.id || 
                   undefined;
  
  // Debug logging
  useEffect(() => {
    if (open && appointment) {
      console.log("📋 AppointmentDetailView - Appointment data:", {
        appointment_id: appointment.id,
        client_id: appointment.client_id,
        user_id: appointment.user_id,
        clients_relation: appointment.clients,
        clientId_calculated: clientId,
        reserverUserId_calculated: reserverUserId,
        business_id: profile?.business_id
      });
    }
  }, [open, appointment, clientId, reserverUserId, profile?.business_id]);
  const [profileModalTarget, setProfileModalTarget] = useState<{ userId?: string; clientId?: string }>({});
  const [allergyOpen, setAllergyOpen] = useState(false);
  const [allergyText, setAllergyText] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [fetchedService, setFetchedService] = useState<any>(null);
  const [fetchedBusiness, setFetchedBusiness] = useState<any>(null);
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const [reserverName, setReserverName] = useState<string>("");
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [clientActionsOpen, setClientActionsOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [editServiceOpen, setEditServiceOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pickedService, setPickedService] = useState<ServicePick | null>(null);
  const [addonItems, setAddonItems] = useState<any[]>([]);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [clientActivityOpen, setClientActivityOpen] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  // Fetch service for this appointment
  useEffect(() => {
    if (open && appointment) {
      const fetchService = async () => {
        if (!profile?.business_id || !appointment?.service_id) return;
        
        try {
          const { data, error } = await supabase
            .from("services")
            .select("name, price, price_usd, price_mxn, duration_minutes")
            .eq("id", appointment.service_id)
            .eq("business_id", profile.business_id)
            .single();
          
          if (!error && data) {
            setFetchedService(data);
          }
        } catch (err) {
          // Silent error handling
        }
      };
      
      fetchService();
    } else {
      setFetchedService(null);
    }
  }, [open, appointment, profile?.business_id]);

  // Subscribe to realtime updates for services
  useEffect(() => {
    if (!open || !appointment?.service_id) return;

    const channel = supabase
      .channel(`service-updates-${appointment.service_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'services',
          filter: `id=eq.${appointment.service_id}`
        },
        (payload) => {
          setFetchedService(payload.new as any);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, appointment?.service_id]);

  // Subscribe to realtime updates for the appointment itself (to catch early_invited changes)
  useEffect(() => {
    if (!open || !appointment?.id || !profile?.business_id) return;

    const channel = supabase
      .channel(`appointment-updates-${appointment.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `id=eq.${appointment.id}`
        },
        (payload) => {
          // When appointment is updated, trigger a refresh via onQuickAction
          if (onQuickAction && payload.new) {
            const updatedAppointment = payload.new as any;
            onQuickAction(updatedAppointment.status as AppointmentStatus);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, appointment?.id, profile?.business_id, onQuickAction]);

  // Fetch business data for real-time updates
  useEffect(() => {
    if (open && appointment?.business_id) {
      const fetchBusiness = async () => {
        const { data, error } = await supabase
          .from("businesses")
          .select("business_name, address")
          .eq("id", appointment.business_id)
          .single();
        
        if (!error && data) {
          setFetchedBusiness(data);
        }
      };
      fetchBusiness();
    } else {
      setFetchedBusiness(null);
    }
  }, [open, appointment?.business_id]);

  // Subscribe to realtime updates for businesses
  useEffect(() => {
    if (!open || !appointment?.business_id) return;

    const channel = supabase
      .channel(`business-updates-${appointment.business_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'businesses',
          filter: `id=eq.${appointment.business_id}`
        },
        (payload) => {
          setFetchedBusiness(payload.new as any);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, appointment?.business_id]);

  // Fetch reserver name if user_id exists - search in multiple tables
  useEffect(() => {
    if (open && appointment?.user_id) {
      const fetchReserverName = async () => {
        // Try profiles table first (partners/staff)
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", appointment.user_id)
          .maybeSingle();

        if (profileData && !profileError && profileData.full_name) {
          setReserverName(profileData.full_name);
          return;
        }

        // Try client_profiles table (clients from client app)
        const { data: clientProfileData, error: clientProfileError } = await (supabase
          .from("client_profiles" as any)
          .select("full_name")
          .eq("id", appointment.user_id)
          .maybeSingle() as any);

        if (clientProfileData && !clientProfileError && (clientProfileData as any).full_name) {
          setReserverName((clientProfileData as any).full_name);
          return;
        }

        // Try clients table (business clients) - search by user_id
        if (profile?.business_id) {
          const { data: clientData, error: clientError } = await supabase
            .from("clients")
            .select("full_name")
            .eq("user_id", appointment.user_id)
            .eq("business_id", profile.business_id)
            .maybeSingle();

          if (clientData && !clientError && clientData.full_name) {
            setReserverName(clientData.full_name);
            return;
          }
        }

        // If appointment has client_id, try to get name from clients table
        if (appointment?.client_id && profile?.business_id) {
          const { data: clientByIdData, error: clientByIdError } = await supabase
            .from("clients")
            .select("full_name, user_id")
            .eq("id", appointment.client_id)
            .eq("business_id", profile.business_id)
            .maybeSingle();

          // Only use if the user_id matches (same person)
          if (clientByIdData && !clientByIdError && 
              clientByIdData.user_id === appointment.user_id && 
              clientByIdData.full_name) {
            setReserverName(clientByIdData.full_name);
            return;
          }
        }

        // Last fallback: try to get from appointment.client_name if available
        if (appointment?.client_name) {
          setReserverName(appointment.client_name);
          return;
        }

        // Final fallback to generic name
        setReserverName(language === "es" ? "Usuario" : "User");
      };
      
      fetchReserverName();
    } else {
      // If no user_id, try to get name from client_name or clients relation
      if (open && appointment) {
        const name = appointment?.clients?.full_name || 
                    appointment?.client_name || 
                    appointment?.guest_name || 
                    "";
        setReserverName(name || "");
      } else {
        setReserverName("");
      }
    }
  }, [open, appointment?.user_id, appointment?.client_id, appointment?.client_name, appointment?.clients?.full_name, profile?.business_id, language]);

  // Check if there's a pending early arrival request for this appointment
  useEffect(() => {
    // Reset state when modal closes or appointment changes
    if (!open || !appointment?.id || !profile?.business_id) {
      setHasPendingRequest(false);
      return;
    }

    const checkPendingRequest = async () => {
      try {
        const { data, error } = await supabase
          .from("appointment_requests" as any)
          .select("id, status, expires_at")
          .eq("appointment_id", appointment.id)
          .eq("business_id", profile.business_id)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

        if (!error && data) {
          setHasPendingRequest(true);
        } else {
          setHasPendingRequest(false);
        }
      } catch (err) {
        console.error("Error checking pending request:", err);
        setHasPendingRequest(false);
      }
    };

    checkPendingRequest();
  }, [open, appointment?.id, profile?.business_id]);

  useEffect(() => {
    if (!open) {
      // Reset state when modal closes
      setHasPendingRequest(false);
      return;
    }
    // Refresh appointment client data when opening to ensure client_id is present
    refreshAppointmentClient();
    // default target when opening: show business client if available; otherwise reserver user
    setProfileModalTarget({ clientId: clientId, userId: clientId ? undefined : reserverUserId });
    setAllergyText(appointment?.clients?.allergy_notes || "");
  }, [open, clientId, reserverUserId]);

  const safeStartTime = appointment?.start_time || "00:00:00";
  const safeEndTime = appointment?.end_time || "00:00:00";
  const safeAppointmentDate = appointment?.date || appointment?.appointment_date || null;

  const statusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return language === "es" ? "Confirmada" : "Confirmed";
      case "started":
        return language === "es" ? "Iniciada" : "Started";
      case "completed":
        return language === "es" ? "Completada" : "Completed";
      case "cancelled":
        return language === "es" ? "Cancelada" : "Cancelled";
      case "no_show":
        return language === "es" ? "No-show" : "No-show";
      default:
        return "Booked";
    }
  };

  const statusColors: Record<string, string> = {
    confirmed: "bg-green-500",
    started: "bg-orange-500",
    pending: "bg-yellow-500",
    completed: "bg-blue-500",
    cancelled: "bg-red-500",
    no_show: "bg-gray-500",
  };

  const calculateDuration = (startTime: string, endTime: string): number => {
    const [startHour, startMin] = (startTime || "00:00").split(":").map(Number);
    const [endHour, endMin] = (endTime || "00:00").split(":").map(Number);
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;
    const diff = endTotal - startTotal;
    return Number.isFinite(diff) ? diff : 0;
  };

  const duration = calculateDuration(safeStartTime, safeEndTime);
  // ✅ FIX: Use clients relation for client info, fallback to appointment.client_name if no relation
  // Ensure we always show a name, even if client_id is NULL
  const clientName = appointment?.clients?.full_name || 
                     appointment?.client_name || 
                     appointment?.guest_name || 
                     "";
  const clientEmail = appointment?.clients?.email || appointment?.client_email || "";
  const clientPhone = appointment?.clients?.phone || appointment?.client_phone || "";
  
  // Get service info
  const service = fetchedService || appointment?.services;
  const serviceName = service?.name || "";
  const servicePrice = service?.price || 0;
  const servicePriceUSD = service?.price_usd || 0;
  const serviceDuration = service?.duration_minutes || duration;
  
  const staffName = appointment?.staff?.full_name || "";
  const appointmentDate = safeAppointmentDate;

  const mainLine = useMemo(() => {
    const subtitle = [formatTime(safeStartTime, "12h"), `${serviceDuration} min`, staffName || null]
      .filter(Boolean)
      .join(" • ");
    return {
      id: "main",
      name: serviceName,
      subtitle,
      amount: Number(servicePrice || 0),
    } satisfies CheckoutLine;
  }, [serviceName, safeStartTime, serviceDuration, staffName, servicePrice]);

  const addonLines: CheckoutLine[] = useMemo(() => {
    return (addonItems || []).map((it: any, idx: number) => {
      const sName = it.services?.name || language === "es" ? "Servicio" : "Service";
      const sDur = it.duration_minutes || it.services?.duration_minutes;
      const sStaff = it.staff?.full_name;
      const sTime = it.start_time ? formatTime(it.start_time, "12h") : null;
      const sub = [sTime, sDur ? `${sDur} min` : null, sStaff].filter(Boolean).join(" • ");
      return {
        id: `addon-${idx}-${it.service_id}`,
        name: sName,
        subtitle: sub || undefined,
        amount: Number(it.price || 0) * Number(it.quantity || 1),
      };
    });
  }, [addonItems, language]);

  const subtotal = useMemo(() => {
    return [mainLine, ...addonLines].reduce((sum, l) => sum + Number(l.amount || 0), 0);
  }, [mainLine, addonLines]);

  const tax = 0;
  const total = subtotal + tax;

  const handlePay = async (method: PaymentMethod) => {
    if (!profile?.business_id) return;
    if (!appointment?.id) return;

    // Map payment methods
    const payment_method_map: Record<PaymentMethod, string> = {
      cash: "cash",
      card: "card",
      transfer: "bank_transfer",
      crypto: "crypto",
      credit: "credit",
    };
    const payment_method = payment_method_map[method] || "other";
    const isCredit = method === "credit";

    // 1) Update appointment payment fields + mark completed
    const { error: aptError } = await supabase
      .from("appointments")
      .update({
        payment_method: isCredit ? null : payment_method as any, // Don't set payment_method for credit
        payment_amount: isCredit ? null : total, // Don't set payment_amount for credit
        status: "completed",
      })
      .eq("id", appointment.id)
      .eq("business_id", profile.business_id);

    if (aptError) {
      toast.error(aptError.message || (language === "es" ? "No se pudo completar el pago" : "Could not complete payment"));
      return;
    }

    if (isCredit) {
      // Note: client_credits table doesn't exist yet, just log for now
      console.log("Credit payment requested but client_credits table not implemented yet", {
        business_id: profile.business_id,
        client_id: appointment.client_id,
        appointment_id: appointment.id,
        amount: total,
      });
      toast.success(language === "es" ? "Crédito registrado" : "Credit recorded");
    } else {
      // Create a sale record (so it shows in Sales)
      const salePayloadBase: any = {
        business_id: profile.business_id,
        client_id: appointment.client_id || null,
        client_name: clientName || appointment.client_name || (language === "es" ? "Cliente" : "Client"),
        client_type: "existing",
        service_id: appointment.service_id || null,
        service_name: serviceName || (language === "es" ? "Servicio" : "Service"),
        staff_id: appointment.staff_id || null,
        price_usd: total,
        price_mxn: 0,
        tip_amount: 0,
        payment_method: payment_method,
        notes: `appointment:${appointment.id}`,
        sale_date: appointment.date || (appointment.appointment_date ? String(appointment.appointment_date).slice(0, 10) : new Date().toISOString().split("T")[0]),
        sale_time: safeStartTime || new Date().toTimeString().split(" ")[0],
      };

      const { error: saleError } = await supabase.from("sales").insert(salePayloadBase);
      if (saleError) {
        // Fallback if DB check constraints reject payment method
        const fallbackPayload = { ...salePayloadBase, payment_method: "cash" };
        await supabase.from("sales").insert(fallbackPayload);
      }

      toast.success(language === "es" ? "Pago registrado" : "Payment recorded");
    }

    // Reuse existing status handler to trigger notifications/refresh
    onQuickAction?.("completed");
  };

  // Listen for openClientActivity event from UserProfileModal
  useEffect(() => {
    const handleOpenActivity = (event: CustomEvent) => {
      const { clientId: eventClientId, userId: eventUserId } = event.detail;
      if (eventClientId || eventUserId) {
        setClientActivityOpen(true);
      }
    };

    window.addEventListener('openClientActivity', handleOpenActivity as EventListener);
    return () => {
      window.removeEventListener('openClientActivity', handleOpenActivity as EventListener);
    };
  }, []);

  // Important: keep hooks above this point. Returning before hooks breaks React rules.
  if (!hasAppointment) return null;

  const isClientBlocked = Boolean(appointment?.clients?.is_blocked);
  const allergyNotes = appointment?.clients?.allergy_notes as string | undefined;

  const refreshAppointmentClient = async () => {
    // refresh only the client relation fields we care about
    if (!profile?.business_id || !appointment?.id) return;
    const { data } = await supabase
      .from("appointments")
      .select("id, client_id, clients!appointments_client_id_fkey(id, user_id, first_name, last_name, full_name, email, phone, avatar_url, is_blocked, blocked_reason, blocked_at, allergy_notes)")
      .eq("id", appointment.id)
      .eq("business_id", profile.business_id)
      .single();
    if (data) {
      // mutate local appointment object (it's already in state upstream, but this helps UI immediately)
      if (data.clients) {
        (appointment as any).clients = data.clients;
      }
      // Always update client_id, even if null (to ensure it's synced)
      (appointment as any).client_id = data.client_id;
    }
  };

  const handleRemoveClientFromAppointment = async () => {
    if (!profile?.business_id || !appointment?.id) return;
    if (!appointment?.client_id) {
      toast.info(language === "es" ? "Esta cita no tiene cliente" : "This appointment has no client");
      return;
    }
    setActionBusy(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          client_id: null,
          client_name: clientName || appointment.client_name || null,
          client_email: clientEmail || appointment.client_email || null,
          client_phone: clientPhone || appointment.client_phone || null,
        })
        .eq("id", appointment.id)
        .eq("business_id", profile.business_id);
      if (error) throw error;
      toast.success(language === "es" ? "Cliente removido de la cita" : "Client removed from appointment");
      (appointment as any).client_id = null;
      (appointment as any).clients = null;
    } catch (e: any) {
      toast.error(e?.message || (language === "es" ? "No se pudo remover" : "Could not remove"));
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveAllergy = async () => {
    if (!profile?.business_id) return;
    if (!clientId) {
      toast.error(language === "es" ? "Primero agrega el cliente al negocio" : "Add the client to your business first");
      return;
    }
    setActionBusy(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ allergy_notes: allergyText || null })
        .eq("id", clientId)
        .eq("business_id", profile.business_id);
      if (error) throw error;
      toast.success(language === "es" ? "Alergia guardada" : "Allergy saved");
      await refreshAppointmentClient();
      setAllergyOpen(false);
    } catch (e: any) {
      toast.error(e?.message || (language === "es" ? "No se pudo guardar" : "Could not save"));
    } finally {
      setActionBusy(false);
    }
  };

  const handleBlockClient = async () => {
    if (!profile?.business_id) return;
    if (!clientId) {
      toast.error(language === "es" ? "Primero agrega el cliente al negocio" : "Add the client to your business first");
      return;
    }
    setActionBusy(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          is_blocked: true,
          blocked_reason: blockReason || null,
          blocked_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .eq("business_id", profile.business_id);
      if (error) throw error;
      toast.success(language === "es" ? "Cliente bloqueado" : "Client blocked");
      await refreshAppointmentClient();
      setBlockOpen(false);
      setBlockReason("");
    } catch (e: any) {
      toast.error(e?.message || (language === "es" ? "No se pudo bloquear" : "Could not block"));
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!profile?.business_id) return;
    if (!clientId) {
      toast.error(language === "es" ? "Esta cita no tiene cliente registrado" : "This appointment has no registered client");
      return;
    }
    setActionBusy(true);
    try {
      // Unlink appointments first to avoid FK issues
      await supabase
        .from("appointments")
        .update({ client_id: null })
        .eq("business_id", profile.business_id)
        .eq("client_id", clientId);

      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId)
        .eq("business_id", profile.business_id);
      if (error) throw error;
      toast.success(language === "es" ? "Cliente eliminado" : "Client deleted");
      (appointment as any).client_id = null;
      (appointment as any).clients = null;
      setConfirmDeleteOpen(false);
    } catch (e: any) {
      toast.error(e?.message || (language === "es" ? "No se pudo eliminar" : "Could not delete"));
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-t border-border h-[90vh] overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{language === "es" ? "Detalle de cita" : "Appointment details"}</SheetTitle>
          <SheetDescription>
            {language === "es"
              ? "Detalles de la cita, servicios y acciones disponibles."
              : "Appointment details, services, and available actions."}
          </SheetDescription>
        </SheetHeader>
        {/* Header with blue background */}
        <div className="bg-primary text-primary-foreground p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">
              {appointmentDate
                ? format(new Date(appointmentDate), "EEE d MMM", { locale: language === "es" ? es : undefined })
                : "-"}
            </h2>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusSheetOpen(true)}
                className="bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/20"
              >
                {statusLabel(appointment.status)}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* If completed, show only receipt */}
          {appointment.status === 'completed' ? (
            <div className="space-y-4">
              {/* Receipt Header */}
              <div className="text-center border-b border-border pb-4">
                <h3 className="text-xl font-bold">{language === "es" ? "Recibo" : "Receipt"}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {appointmentDate
                    ? format(new Date(appointmentDate), "EEE, d MMM yyyy", { locale: language === "es" ? es : undefined })
                    : "-"}
                </p>
              </div>

              {/* Business Info */}
              <div className="text-center">
                <p className="font-semibold">{appointment.businesses?.business_name || ""}</p>
                {appointment.businesses?.address && (
                  <p className="text-sm text-muted-foreground">{appointment.businesses.address}</p>
                )}
              </div>

              <Separator />

              {/* Client Info */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">{language === "es" ? "Cliente:" : "Client:"}</p>
                <p className="font-medium">{clientName || (language === "es" ? "Cliente" : "Client")}</p>
                {clientEmail && <p className="text-sm text-muted-foreground">{clientEmail}</p>}
              </div>

              <Separator />

              {/* Services */}
              <div>
                <h4 className="font-semibold mb-3">{language === "es" ? "Servicios realizados:" : "Services performed:"}</h4>
                <div className="space-y-2">
                  {/* Main service */}
                  {serviceName && (
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <div>
                        <p className="font-medium">{serviceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(appointment.start_time, "12h")} • {serviceDuration} min{staffName ? ` • ${staffName}` : ""}
                        </p>
                      </div>
                      <p className="font-semibold">DOP {Number(servicePrice || 0).toFixed(0)}</p>
                    </div>
                  )}

                  {/* Add-on services */}
                  {(addonItems || []).map((it: any, idx: number) => {
                    const addName = it.services?.name || (language === "es" ? "Servicio" : "Service");
                    const addStaff = it.staff?.full_name || "";
                    const addDur = it.duration_minutes ?? it.services?.duration_minutes;
                    const addTime = it.start_time || appointment.start_time;
                    const qty = Number(it.quantity || 1);
                    const amt = Number(it.price || 0) * qty;

                    return (
                      <div key={`${it.service_id}-${it.start_time || "na"}-${idx}`} className="flex justify-between items-center py-2 border-b border-border">
                        <div>
                          <p className="font-medium">{addName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(addTime, "12h")}
                            {addDur ? ` • ${addDur} min` : ""}
                            {addStaff ? ` • ${addStaff}` : ""}
                            {qty > 1 ? ` • x${qty}` : ""}
                          </p>
                        </div>
                        <p className="font-semibold">DOP {amt.toFixed(0)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Payment Summary */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === "es" ? "Subtotal" : "Subtotal"}</span>
                  <span>DOP {subtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === "es" ? "Impuestos" : "Tax"}</span>
                  <span>DOP {tax.toFixed(0)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>{language === "es" ? "Total" : "Total"}</span>
                  <span>DOP {total.toFixed(0)}</span>
                </div>
              </div>

              {/* Payment Method */}
              {appointment.payment_method && appointment.payment_amount ? (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{language === "es" ? "Método de pago:" : "Payment method:"}</p>
                    <p className="font-medium">
                      {appointment.payment_method === "cash" ? (language === "es" ? "Efectivo" : "Cash") :
                       appointment.payment_method === "card" ? (language === "es" ? "Tarjeta D/C" : "Card") :
                       appointment.payment_method === "bank_transfer" ? (language === "es" ? "Transferencia" : "Transfer") :
                       appointment.payment_method === "crypto" ? (language === "es" ? "Crypto moneda" : "Crypto") :
                       appointment.payment_method}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {language === "es" ? "Pagado:" : "Paid:"} DOP {Number(appointment.payment_amount || 0).toFixed(0)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Separator />
                  <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      {language === "es" ? "Pendiente de pago (Crédito)" : "Pending payment (Credit)"}
                    </p>
                  </div>
                </>
              )}

              {/* Footer */}
              <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
                <p>{language === "es" ? "Gracias por su visita" : "Thank you for your visit"}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Client Card */}
              <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                  {clientName ? clientName.charAt(0).toUpperCase() : "?"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{clientName || (language === "es" ? "Cliente" : "Client")}</span>
                    <Badge variant="secondary" className="text-xs">New</Badge>
                    {isClientBlocked && (
                      <Badge variant="destructive" className="text-xs">
                        {language === "es" ? "Bloqueado" : "Blocked"}
                      </Badge>
                    )}
                  </div>
                  {clientEmail && (
                    <p className="text-sm text-muted-foreground">{clientEmail}</p>
                  )}
                </div>
              </div>
              
              {/* Actions Button */}
              <Button variant="outline" size="sm" onClick={() => setClientActionsOpen(true)}>
                {language === "es" ? "Acciones" : "Actions"}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {allergyNotes && (
              <div className="mt-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <div className="text-sm font-semibold text-destructive">
                  {language === "es" ? "Alergia" : "Allergy"}
                </div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{allergyNotes}</div>
              </div>
            )}
            
            {/* Contact Icons */}
            <div className="flex gap-2 mt-3">
              {clientPhone && (
                <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                  <a href={`tel:${clientPhone}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {clientEmail && (
                <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                  <a href={`mailto:${clientEmail}`}>
                    <Mail className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Date & Time */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {appointmentDate
                  ? format(new Date(appointmentDate), "EEE, d MMM yyyy", { locale: language === "es" ? es : undefined })
                  : "-"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {formatTime(appointment.start_time, "12h")} - {formatTime(appointment.end_time, "12h")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="ml-6">{language === "es" ? "No se repite" : "Doesn't repeat"}</span>
            </div>
          </div>

          <Separator />

          {/* Services Section */}
          <div className="space-y-3">
            {/* Main service - only show if serviceName exists */}
            {serviceName && (
              <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
                <div className="w-1 h-full bg-primary rounded-full self-stretch" />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-medium truncate">{serviceName}</h4>
                      <p className="text-sm text-muted-foreground truncate">
                        {formatTime(appointment.start_time, "12h")} • {serviceDuration} min{staffName ? ` • ${staffName}` : ""}
                      </p>
                    </div>
                    <span className="font-semibold shrink-0">DOP {Number(servicePrice || 0).toFixed(0)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Add-on services (appointment_services) */}
            {(addonItems || []).map((it: any, idx: number) => {
              const addName = it.services?.name || (language === "es" ? "Servicio" : "Service");
              const addStaff = it.staff?.full_name || "";
              const addDur = it.duration_minutes ?? it.services?.duration_minutes;
              const addTime = it.start_time || appointment.start_time;
              const qty = Number(it.quantity || 1);
              const amt = Number(it.price || 0) * qty;

              return (
                <button
                  key={`${it.service_id}-${it.start_time || "na"}-${idx}`}
                  className="w-full text-left flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/40 transition-colors"
                  onClick={() => {
                    setPickedService({
                      id: it.service_id,
                      name: addName,
                      category: it.services?.category || null,
                      duration_minutes: Number(it.services?.duration_minutes || addDur || 0),
                      price: Number(it.services?.price || 0),
                      // Store additional identifying info
                      existingStartTime: it.start_time || null,
                      existingStaffId: it.staff_id || null,
                      existingCreatedAt: it.created_at || null,
                    } as any);
                    setEditServiceOpen(true);
                  }}
                >
                  <div className="w-1 h-full bg-primary/60 rounded-full self-stretch" />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-medium truncate">{addName}</h4>
                        <p className="text-sm text-muted-foreground truncate">
                          {formatTime(addTime, "12h")}
                          {addDur ? ` • ${addDur} min` : ""}
                          {addStaff ? ` • ${addStaff}` : ""}
                        </p>
                      </div>
                      <span className="font-semibold shrink-0">DOP {amt.toFixed(0)}</span>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Add Service Button */}
            <Button variant="ghost" className="w-full justify-start text-primary" onClick={() => setAddServiceOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {language === "es" ? "Agregar servicio" : "Add service"}
            </Button>
          </div>

          {/* Notes */}
          {appointment.notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {language === "es" ? "Notas" : "Notes"}
                </h4>
                <p className="text-sm text-muted-foreground">{appointment.notes}</p>
              </div>
            </>
          )}

          {/* Reserved by */}
          {reserverName && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {language === "es" ? "Reservado por:" : "Reserved by:"} 
                  <button 
                    className="ml-1 text-primary hover:underline"
                    onClick={async () => {
                      console.log("🔍 Click en Reserved by - Datos disponibles:", {
                        clientId,
                        reserverUserId,
                        appointment_client_id: appointment?.client_id,
                        appointment_user_id: appointment?.user_id,
                        clients_relation: appointment?.clients,
                        business_id: profile?.business_id
                      });
                      
                      // PRIORITY 1: Use clientId if available (most reliable for manually added clients)
                      if (clientId) {
                        console.log("✅ Usando clientId:", clientId);
                        setProfileModalTarget({ clientId: clientId, userId: reserverUserId });
                        setUserProfileModalOpen(true);
                      } else if (appointment?.clients?.id) {
                        // PRIORITY 2: Use clients relation id
                        console.log("✅ Usando clients.id de relación:", appointment.clients.id);
                        setProfileModalTarget({ clientId: appointment.clients.id, userId: appointment.clients.user_id || reserverUserId });
                        setUserProfileModalOpen(true);
                      } else if (reserverUserId) {
                        // PRIORITY 3: Fallback to userId for app-registered users
                        console.log("✅ Usando reserverUserId:", reserverUserId);
                        // Try to find client_id by user_id first
                        if (profile?.business_id) {
                          const { data: clientByUserId } = await supabase
                            .from("clients")
                            .select("id")
                            .eq("user_id", reserverUserId)
                            .eq("business_id", profile.business_id)
                            .maybeSingle();
                          
                          if (clientByUserId?.id) {
                            console.log("✅ Cliente encontrado por user_id:", clientByUserId.id);
                            setProfileModalTarget({ clientId: clientByUserId.id, userId: reserverUserId });
                          } else {
                            console.log("⚠️ No se encontró cliente por user_id, usando solo userId");
                            setProfileModalTarget({ userId: reserverUserId, clientId: undefined });
                          }
                        } else {
                          setProfileModalTarget({ userId: reserverUserId, clientId: undefined });
                        }
                        setUserProfileModalOpen(true);
                      } else if (appointment?.clients?.user_id) {
                        // PRIORITY 4: Try clients.user_id
                        console.log("✅ Usando clients.user_id:", appointment.clients.user_id);
                        setProfileModalTarget({ userId: appointment.clients.user_id, clientId: appointment.clients.id });
                        setUserProfileModalOpen(true);
                      } else {
                        console.error("❌ No hay información de cliente disponible");
                        toast.error(language === "es" ? "No hay cliente asociado a esta reserva" : "No client linked to this booking");
                      }
                    }}
                  >
                    {reserverName}
                  </button>
                </span>
              </div>
            </>
          )}
            </>
          )}
        </div>

        {/* Fixed Footer - Only show if not completed */}
        {appointment.status !== 'completed' && (
          <div className="sticky bottom-0 bg-card border-t border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-muted-foreground">{language === "es" ? "Total" : "Total"}</span>
                <p className="text-xl font-bold">DOP {total.toFixed(0)}</p>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Quick Actions Menu (3 dots) */}
                <Button variant="outline" size="icon" onClick={() => setQuickActionsOpen(true)}>
                  <MoreHorizontal className="h-5 w-5" />
                </Button>

                {/* Checkout Button */}
                <Button className="bg-primary hover:bg-primary/90" onClick={() => setCheckoutOpen(true)}>
                  {language === "es" ? "Checkout" : "Checkout"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>

      {/* User Profile Modal */}
      <UserProfileModal
        open={userProfileModalOpen}
        onOpenChange={setUserProfileModalOpen}
        userId={profileModalTarget.userId}
        clientId={profileModalTarget.clientId}
        appointmentId={appointment?.id}
        onClientAdded={async () => {
          // Refresh client data after adding
          await refreshAppointmentClient();
          // Re-fetch appointment to get updated client_id
          if (appointment?.id && profile?.business_id) {
            const { data: updatedApt } = await supabase
              .from("appointments")
              .select("client_id, clients!appointments_client_id_fkey(id, user_id, full_name, email, phone)")
              .eq("id", appointment.id)
              .eq("business_id", profile.business_id)
              .single();
            
            if (updatedApt?.client_id) {
              // Update profile modal target with new client_id
              setProfileModalTarget({ clientId: updatedApt.client_id, userId: undefined });
            }
          }
          setUserProfileModalOpen(false);
        }}
      />

      <AppointmentStatusSheet
        open={statusSheetOpen}
        onOpenChange={setStatusSheetOpen}
        value={(appointment.status as AppointmentStatus) || "pending"}
        onChange={(next) => onQuickAction?.(next)}
        onEarlyArrivalRequest={async () => {
          if (!appointment?.id || !profile?.business_id) {
            toast.error(language === "es" ? "Error: información de cita incompleta" : "Error: incomplete appointment information");
            return;
          }

          // Validate appointment status - only allow for pending or confirmed appointments
          if (appointment.status !== "pending" && appointment.status !== "confirmed") {
            toast.error(
              language === "es" 
                ? "Solo se puede enviar solicitud para citas en estado 'Booked' o 'Confirmada'" 
                : "Can only send request for 'Booked' or 'Confirmed' appointments"
            );
            return;
          }

          // REMOVED: No longer checking for existing requests
          // Users can send "puede asistir" multiple times without limit

          // Use staff_id if available, otherwise null
          const staffId = appointment.staff_id || null;

          try {
            const result = await createEarlyArrivalRequest({
              appointmentId: appointment.id,
              businessId: profile.business_id,
              staffId: staffId,
            });

            if (!result.success) {
              toast.error(result.error || (language === "es" ? "Error al crear solicitud" : "Failed to create request"));
              return;
            }

            toast.success(
              language === "es" 
                ? "Solicitud enviada. El cliente recibirá una notificación para responder." 
                : "Request sent. Client will receive a notification to respond."
            );

            // Refresh the pending request check to get the actual state
            const checkPendingRequest = async () => {
              try {
                const { data } = await supabase
                  .from("appointment_requests")
                  .select("id, status, expires_at")
                  .eq("appointment_id", appointment.id)
                  .eq("business_id", profile.business_id)
                  .eq("status", "pending")
                  .gt("expires_at", new Date().toISOString())
                  .maybeSingle();

                setHasPendingRequest(!!data);
              } catch (err) {
                console.error("Error checking pending request:", err);
              }
            };
            
            await checkPendingRequest();

            // Refresh appointment data
            if (onQuickAction) {
              onQuickAction(appointment.status as AppointmentStatus);
            }
          } catch (error: any) {
            console.error("Error creating early arrival request:", error);
            toast.error(error.message || (language === "es" ? "Error al crear solicitud" : "Failed to create request"));
          }
        }}
        appointment={{
          id: appointment.id,
          business_id: appointment.business_id,
          staff_id: appointment.staff_id,
          status: appointment.status,
          has_pending_request: hasPendingRequest,
        }}
      />

      <AppointmentClientActionsSheet
        open={clientActionsOpen}
        onOpenChange={setClientActionsOpen}
        onViewClient={() => {
          // Prefer reserver user (who made the booking) for "View client"
          if (reserverUserId) {
            setProfileModalTarget({ userId: reserverUserId, clientId: undefined });
            setUserProfileModalOpen(true);
            return;
          }
          // Fallback: business client record
          if (clientId) {
            setProfileModalTarget({ clientId, userId: undefined });
            setUserProfileModalOpen(true);
            return;
          }
          toast.error(language === "es" ? "Esta cita no tiene cliente asociado" : "This appointment has no linked client");
        }}
        onEditClientDetails={() => {
          if (clientId) {
            setProfileModalTarget({ clientId, userId: undefined });
            setUserProfileModalOpen(true);
            return;
          }
          toast.info(language === "es" ? "Primero agrega el cliente al negocio" : "Add the client to your business first");
        }}
        onRemoveClient={() => setConfirmRemoveOpen(true)}
        onAddAllergy={() => setAllergyOpen(true)}
        onBlockClient={() => setBlockOpen(true)}
        onDeleteClient={() => setConfirmDeleteOpen(true)}
      />

      <AppointmentQuickActionsSheet
        open={quickActionsOpen}
        onOpenChange={setQuickActionsOpen}
        onAddNote={() => {
          setAddNoteOpen(true);
        }}
        onViewActivity={() => {
          setClientActivityOpen(true);
        }}
        onReschedule={onEdit}
        onNoShow={() => onQuickAction?.("no_show")}
        onCancel={() => onQuickAction?.("cancelled")}
      />

      <AddNoteSheet
        open={addNoteOpen}
        onOpenChange={setAddNoteOpen}
        appointmentId={appointment?.id}
        businessId={profile?.business_id || ""}
        onNoteAdded={() => {
          // Refresh appointment data if needed
        }}
      />

      <ClientActivityView
        open={clientActivityOpen}
        onOpenChange={setClientActivityOpen}
        clientId={clientId}
        userId={reserverUserId}
        businessId={profile?.business_id || ""}
        clientName={appointment?.client_name || appointment?.clients?.full_name || reserverName}
      />

      <AddServiceSheet
        open={addServiceOpen}
        onOpenChange={setAddServiceOpen}
        onSelectService={(s) => {
          setPickedService(s);
          setEditServiceOpen(true);
        }}
      />

      <EditServiceSheet
        open={editServiceOpen}
        onOpenChange={(o) => {
          setEditServiceOpen(o);
          if (!o) setPickedService(null);
        }}
        appointmentId={appointment.id}
        appointmentStartTime={appointment.start_time}
        service={pickedService}
        existingStartTime={pickedService?.existingStartTime || null}
        existingStaffId={pickedService?.existingStaffId || null}
        existingCreatedAt={pickedService?.existingCreatedAt || null}
        onApplied={async () => {
          // Note: appointment_services table doesn't exist yet
          // When implemented, this would fetch add-on services for the appointment
          setAddonItems([]);
        }}
      />

      <CheckoutSheet
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        clientName={clientName || (language === "es" ? "Cliente" : "Client")}
        clientEmail={clientEmail || undefined}
        lines={[mainLine, ...addonLines]}
        subtotal={subtotal}
        tax={tax}
        total={total}
        onContinue={() => {
          setCheckoutOpen(false);
          setPaymentOpen(true);
        }}
      />

      <PaymentSheet
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        total={total}
        onPay={handlePay}
      />

      <ClientNoteDialog
        open={allergyOpen}
        onOpenChange={setAllergyOpen}
        title={language === "es" ? "Agregar alergia" : "Add allergy"}
        description={language === "es" ? "Esta nota se mostrará destacada en el perfil." : "This note will be highlighted in the profile."}
        label={language === "es" ? "¿A qué es alérgico?" : "What are they allergic to?"}
        placeholder={language === "es" ? "Ej: al látex, a la acetona..." : "e.g. latex, acetone..."}
        value={allergyText}
        onChange={setAllergyText}
        saving={actionBusy}
        onSave={handleSaveAllergy}
      />

      <ClientNoteDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={language === "es" ? "Bloquear cliente" : "Block client"}
        description={language === "es" ? "El cliente no podrá reservar nuevamente." : "The client will not be able to book again."}
        label={language === "es" ? "Motivo (opcional)" : "Reason (optional)"}
        placeholder={language === "es" ? "Ej: faltas repetidas..." : "e.g. repeated no-shows..."}
        value={blockReason}
        onChange={setBlockReason}
        saving={actionBusy}
        onSave={handleBlockClient}
      />

      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "es" ? "Quitar cliente" : "Remove client"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "es"
                ? "Esto quitará el cliente de esta cita, pero no lo elimina del negocio."
                : "This will remove the client from this appointment, but won't delete them from your business."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>{language === "es" ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveClientFromAppointment}
              disabled={actionBusy}
            >
              {language === "es" ? "Quitar" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "es" ? "Eliminar cliente" : "Delete client"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "es"
                ? "Esto eliminará el cliente del negocio. Se desvinculará de las citas existentes."
                : "This will delete the client from your business. It will unlink from existing appointments."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>{language === "es" ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              disabled={actionBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {language === "es" ? "Eliminar" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
