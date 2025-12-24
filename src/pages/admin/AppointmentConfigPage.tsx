import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

interface AppointmentSettings {
  id?: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  max_advance_booking_days: number;
  min_advance_booking_hours: number;
  cancellation_policy: string;
  allow_same_day_booking: boolean;
  require_deposit: boolean;
  deposit_percentage: number | null;
}

export default function AppointmentConfigPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppointmentSettings>({
    slot_duration_minutes: 30,
    buffer_minutes: 0,
    max_advance_booking_days: 90,
    min_advance_booking_hours: 2,
    cancellation_policy: "",
    allow_same_day_booking: true,
    require_deposit: false,
    deposit_percentage: null,
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get business_id from profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", user.id)
        .single() as any;

      if (!profileData?.business_id) return;

      // Load existing settings
      const { data, error } = await supabase
        .from("appointment_settings")
        .select("*")
        .eq("business_id", profileData.business_id)
        .maybeSingle() as any;

      if (error) throw error;

      const settingsData = data as any;
      if (settingsData) {
        setSettings({
          id: settingsData.id,
          slot_duration_minutes: settingsData.slot_duration_minutes ?? 30,
          buffer_minutes: settingsData.buffer_minutes ?? 0,
          max_advance_booking_days: settingsData.max_advance_booking_days ?? 90,
          min_advance_booking_hours: settingsData.min_advance_booking_hours ?? 2,
          cancellation_policy: settingsData.cancellation_policy || "",
          allow_same_day_booking: settingsData.allow_same_day_booking ?? true,
          require_deposit: settingsData.require_deposit ?? false,
          deposit_percentage: settingsData.deposit_percentage,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);

      // Get business_id from profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", user.id)
        .single() as any;

      if (!profileData?.business_id) {
        toast.error("No se encontró el negocio");
        return;
      }

      const settingsData = {
        business_id: profileData.business_id,
        slot_duration_minutes: settings.slot_duration_minutes,
        buffer_minutes: settings.buffer_minutes,
        max_advance_booking_days: settings.max_advance_booking_days,
        min_advance_booking_hours: settings.min_advance_booking_hours,
        cancellation_policy: settings.cancellation_policy || null,
        allow_same_day_booking: settings.allow_same_day_booking,
        require_deposit: settings.require_deposit,
        deposit_percentage: settings.require_deposit ? settings.deposit_percentage : null,
      };

      if (settings.id) {
        // Update existing
        const { error } = await supabase
          .from("appointment_settings")
          .update(settingsData)
          .eq("id", settings.id)
          .eq("business_id", profileData.business_id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("appointment_settings")
          .insert(settingsData);

        if (error) throw error;
      }

      toast.success("Configuración guardada exitosamente");
      navigate("/admin/settings");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/settings")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Configuración de Citas</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-64 p-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/settings")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Configuración de Citas</h1>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Duración y Espaciado</CardTitle>
            <CardDescription>
              Configura la duración de los slots y el tiempo entre citas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slot_duration">Duración del Slot (minutos)</Label>
              <Input
                id="slot_duration"
                type="number"
                min="15"
                step="15"
                value={settings.slot_duration_minutes}
                onChange={(e) =>
                  setSettings({ ...settings, slot_duration_minutes: parseInt(e.target.value) || 30 })
                }
              />
              <p className="text-sm text-muted-foreground">
                Duración estándar de cada cita
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buffer_minutes">Tiempo Buffer (minutos)</Label>
              <Input
                id="buffer_minutes"
                type="number"
                min="0"
                step="5"
                value={settings.buffer_minutes}
                onChange={(e) =>
                  setSettings({ ...settings, buffer_minutes: parseInt(e.target.value) || 0 })
                }
              />
              <p className="text-sm text-muted-foreground">
                Tiempo adicional entre citas para limpieza o preparación
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Políticas de Reserva</CardTitle>
            <CardDescription>
              Configura las reglas para hacer reservas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max_advance_days">Días Máximos de Anticipación</Label>
              <Input
                id="max_advance_days"
                type="number"
                min="1"
                value={settings.max_advance_booking_days}
                onChange={(e) =>
                  setSettings({ ...settings, max_advance_booking_days: parseInt(e.target.value) || 90 })
                }
              />
              <p className="text-sm text-muted-foreground">
                Cuántos días de anticipación pueden reservar los clientes
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_advance_hours">Horas Mínimas de Anticipación</Label>
              <Input
                id="min_advance_hours"
                type="number"
                min="0"
                value={settings.min_advance_booking_hours}
                onChange={(e) =>
                  setSettings({ ...settings, min_advance_booking_hours: parseInt(e.target.value) || 2 })
                }
              />
              <p className="text-sm text-muted-foreground">
                Tiempo mínimo de anticipación requerido para reservar
              </p>
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label>Permitir Reservas el Mismo Día</Label>
                <p className="text-sm text-muted-foreground">
                  Los clientes pueden reservar citas para el mismo día
                </p>
              </div>
              <Switch
                checked={settings.allow_same_day_booking}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, allow_same_day_booking: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Política de Cancelación</CardTitle>
            <CardDescription>
              Define las reglas para cancelar citas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancellation_policy">Política de Cancelación</Label>
              <Textarea
                id="cancellation_policy"
                rows={4}
                placeholder="Ej: Se requiere 24 horas de anticipación para cancelar sin cargo. Cancelaciones tardías incurren en un cargo del 50%."
                value={settings.cancellation_policy}
                onChange={(e) =>
                  setSettings({ ...settings, cancellation_policy: e.target.value })
                }
              />
              <p className="text-sm text-muted-foreground">
                Esta política se mostrará a los clientes al reservar
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Depósito</CardTitle>
            <CardDescription>
              Configura si requieres depósito para las reservas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label>Requiere Depósito</Label>
                <p className="text-sm text-muted-foreground">
                  Solicitar un depósito al momento de reservar
                </p>
              </div>
              <Switch
                checked={settings.require_deposit}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, require_deposit: checked })
                }
              />
            </div>

            {settings.require_deposit && (
              <div className="space-y-2">
                <Label htmlFor="deposit_percentage">Porcentaje de Depósito (%)</Label>
                <Input
                  id="deposit_percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={settings.deposit_percentage || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      deposit_percentage: parseFloat(e.target.value) || null,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Porcentaje del precio del servicio requerido como depósito
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/settings")} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar Configuración"
            )}
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
