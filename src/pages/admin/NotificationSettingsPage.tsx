import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Calendar, MessageSquare, Star, AlertCircle, UserCheck, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotificationSettingsPage() {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    // Notificaciones para Partner (recibir)
    new_appointment_enabled: true,
    appointment_status_change_enabled: true,
    appointment_cancellation_enabled: true,
    payment_received_enabled: true,
    new_review_enabled: true,
    
    // Notificaciones para Clientes (enviar)
    send_appointment_reminders: true,
    send_booking_confirmations: true,
    send_review_requests: false,
  });

  useEffect(() => {
    loadNotificationSettings();
  }, [profile]);

  const loadNotificationSettings = async () => {
    if (!profile?.business_id) return;

    try {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("business_id", profile.business_id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setSettings({
          new_appointment_enabled: data.new_appointment_enabled ?? true,
          appointment_status_change_enabled: data.appointment_status_change_enabled ?? true,
          appointment_cancellation_enabled: data.appointment_cancellation_enabled ?? true,
          payment_received_enabled: data.payment_received_enabled ?? true,
          new_review_enabled: data.new_review_enabled ?? true,
          send_appointment_reminders: data.reminder_enabled ?? true,
          send_booking_confirmations: data.confirmation_enabled ?? true,
          send_review_requests: data.review_request_enabled ?? false,
        });
      }
    } catch (error: any) {
      console.error("Error loading notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile?.business_id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_settings")
        .upsert(
          {
            business_id: profile.business_id,
            // Map to database columns
            new_appointment_enabled: settings.new_appointment_enabled,
            appointment_status_change_enabled: settings.appointment_status_change_enabled,
            appointment_cancellation_enabled: settings.appointment_cancellation_enabled,
            payment_received_enabled: settings.payment_received_enabled,
            new_review_enabled: settings.new_review_enabled,
            reminder_enabled: settings.send_appointment_reminders,
            confirmation_enabled: settings.send_booking_confirmations,
            review_request_enabled: settings.send_review_requests,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'business_id'
          }
        );

      if (error) throw error;
      toast.success(language === "es" ? "Configuración guardada" : "Settings saved");
    } catch (error: any) {
      toast.error(language === "es" ? "Error al guardar" : "Error saving settings");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="p-4 text-center">
          {language === "es" ? "Cargando..." : "Loading..."}
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {language === "es" ? "Notificaciones" : "Notifications"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {language === "es" 
                ? "Gestiona cómo recibes y envías notificaciones" 
                : "Manage how you receive and send notifications"}
            </p>
          </div>
        </div>

        {/* Partner Notifications (Receive) */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">
              {language === "es" ? "Notificaciones que Recibes" : "Notifications You Receive"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {language === "es" 
                ? "Recibe actualizaciones sobre tu negocio" 
                : "Get updates about your business"}
            </p>
          </div>

          {/* New Appointments */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 flex-1">
                <div className="p-2 bg-primary/10 rounded-lg h-fit">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="new-appointment" className="text-base font-medium cursor-pointer">
                    {language === "es" ? "Nuevas Citas" : "New Appointments"}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === "es" 
                      ? "Recibe notificación cuando un cliente reserve una cita" 
                      : "Get notified when a client books an appointment"}
                  </p>
                </div>
              </div>
              <Switch
                id="new-appointment"
                checked={settings.new_appointment_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, new_appointment_enabled: checked })
                }
              />
            </div>
          </Card>

          {/* Status Changes */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 flex-1">
                <div className="p-2 bg-blue-500/10 rounded-lg h-fit">
                  <UserCheck className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="status-change" className="text-base font-medium cursor-pointer">
                    {language === "es" ? "Cambios de Estado" : "Status Changes"}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === "es" 
                      ? "Notificaciones cuando el estado de una cita cambia" 
                      : "Notifications when an appointment status changes"}
                  </p>
                </div>
              </div>
              <Switch
                id="status-change"
                checked={settings.appointment_status_change_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, appointment_status_change_enabled: checked })
                }
              />
            </div>
          </Card>

          {/* Cancellations */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 flex-1">
                <div className="p-2 bg-red-500/10 rounded-lg h-fit">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="cancellation" className="text-base font-medium cursor-pointer">
                    {language === "es" ? "Cancelaciones" : "Cancellations"}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === "es" 
                      ? "Alerta cuando un cliente cancela una cita" 
                      : "Alert when a client cancels an appointment"}
                  </p>
                </div>
              </div>
              <Switch
                id="cancellation"
                checked={settings.appointment_cancellation_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, appointment_cancellation_enabled: checked })
                }
              />
            </div>
          </Card>

          {/* Payment Received */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 flex-1">
                <div className="p-2 bg-green-500/10 rounded-lg h-fit">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="payment" className="text-base font-medium cursor-pointer">
                    {language === "es" ? "Pagos Recibidos" : "Payments Received"}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === "es" 
                      ? "Notificación cuando se registre un pago" 
                      : "Notification when a payment is recorded"}
                  </p>
                </div>
              </div>
              <Switch
                id="payment"
                checked={settings.payment_received_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, payment_received_enabled: checked })
                }
              />
            </div>
          </Card>

          {/* New Reviews */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 flex-1">
                <div className="p-2 bg-yellow-500/10 rounded-lg h-fit">
                  <Star className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="review" className="text-base font-medium cursor-pointer">
                    {language === "es" ? "Nuevas Reseñas" : "New Reviews"}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === "es" 
                      ? "Recibe notificación cuando un cliente deja una reseña" 
                      : "Get notified when a client leaves a review"}
                  </p>
                </div>
              </div>
              <Switch
                id="review"
                checked={settings.new_review_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, new_review_enabled: checked })
                }
              />
            </div>
          </Card>
        </div>

        {/* Client Notifications (Send) */}
        <div className="space-y-4 pt-6 border-t">
          <div>
            <h2 className="text-lg font-semibold mb-1">
              {language === "es" ? "Notificaciones que Envías" : "Notifications You Send"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {language === "es" 
                ? "Envía notificaciones automáticas a tus clientes" 
                : "Send automatic notifications to your clients"}
            </p>
          </div>

          {/* Appointment Reminders */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 flex-1">
                <div className="p-2 bg-primary/10 rounded-lg h-fit">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="reminders" className="text-base font-medium cursor-pointer">
                    {language === "es" ? "Recordatorios" : "Appointment Reminders"}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === "es" 
                      ? "Enviar recordatorios a clientes antes de las citas" 
                      : "Send reminders to clients before appointments"}
                  </p>
                </div>
              </div>
              <Switch
                id="reminders"
                checked={settings.send_appointment_reminders}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, send_appointment_reminders: checked })
                }
              />
            </div>
          </Card>

          {/* Booking Confirmations */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 flex-1">
                <div className="p-2 bg-green-500/10 rounded-lg h-fit">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="confirmations" className="text-base font-medium cursor-pointer">
                    {language === "es" ? "Confirmaciones de Reserva" : "Booking Confirmations"}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === "es" 
                      ? "Confirmar automáticamente cuando se reserve una cita" 
                      : "Auto-send confirmation when booking is made"}
                  </p>
                </div>
              </div>
              <Switch
                id="confirmations"
                checked={settings.send_booking_confirmations}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, send_booking_confirmations: checked })
                }
              />
            </div>
          </Card>

          {/* Review Requests */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3 flex-1">
                <div className="p-2 bg-yellow-500/10 rounded-lg h-fit">
                  <Star className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="review-requests" className="text-base font-medium cursor-pointer">
                    {language === "es" ? "Solicitudes de Reseña" : "Review Requests"}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === "es" 
                      ? "Pedir reseñas a clientes después de las citas" 
                      : "Ask clients for reviews after appointments"}
                  </p>
                </div>
              </div>
              <Switch
                id="review-requests"
                checked={settings.send_review_requests}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, send_review_requests: checked })
                }
              />
            </div>
          </Card>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full"
          size="lg"
        >
          {saving
            ? (language === "es" ? "Guardando..." : "Saving...")
            : (language === "es" ? "Guardar Configuración" : "Save Notification Settings")}
        </Button>
      </div>
    </MobileLayout>
  );
}
