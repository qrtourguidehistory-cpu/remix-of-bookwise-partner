import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Globe, Calendar, Clock, DollarSign } from "lucide-react";

export default function LocaleSettingsPage() {
  const { profile } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    language: "es",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12h",
    timezone: "America/Mexico_City",
    currency: "MXN",
  });

  useEffect(() => {
    loadLocaleSettings();
  }, [profile]);

  const loadLocaleSettings = async () => {
    if (!profile?.business_id) return;

    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("locale_settings")
        .eq("id", profile.business_id)
        .single();

      if (error) throw error;
      if (data?.locale_settings && typeof data.locale_settings === 'object') {
        const localeData = data.locale_settings as any;
        setSettings({
          language: localeData.language || "es",
          dateFormat: localeData.dateFormat || "DD/MM/YYYY",
          timeFormat: localeData.timeFormat || "12h",
          timezone: localeData.timezone || "America/Mexico_City",
          currency: localeData.currency || "MXN",
        });
      }
    } catch (error: any) {
      console.error("Error loading locale settings:", error);
    }
  };

  const handleSave = async () => {
    if (!profile?.business_id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({ locale_settings: settings })
        .eq("id", profile.business_id);

      if (error) throw error;
      
      // Update language context if changed
      if (settings.language !== language) {
        setLanguage(settings.language as "en" | "es");
      }
      
      toast.success("Language & region settings saved");
    } catch (error: any) {
      toast.error("Error saving settings");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout>
      <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            ← Back
          </Button>
          <h2 className="text-lg font-semibold">Language & Region</h2>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Language */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-primary" />
            <Label className="text-base font-semibold">Language</Label>
          </div>
          <Select
            value={settings.language}
            onValueChange={(value) => setSettings({ ...settings, language: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {/* Date Format */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <Label className="text-base font-semibold">Date Format</Label>
          </div>
          <RadioGroup
            value={settings.dateFormat}
            onValueChange={(value) => setSettings({ ...settings, dateFormat: value })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="DD/MM/YYYY" id="date1" />
              <Label htmlFor="date1" className="cursor-pointer">
                DD/MM/YYYY (e.g., 23/11/2025)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="MM/DD/YYYY" id="date2" />
              <Label htmlFor="date2" className="cursor-pointer">
                MM/DD/YYYY (e.g., 11/23/2025)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="YYYY-MM-DD" id="date3" />
              <Label htmlFor="date3" className="cursor-pointer">
                YYYY-MM-DD (e.g., 2025-11-23)
              </Label>
            </div>
          </RadioGroup>
        </Card>

        {/* Time Format */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <Label className="text-base font-semibold">Time Format</Label>
          </div>
          <RadioGroup
            value={settings.timeFormat}
            onValueChange={(value) => setSettings({ ...settings, timeFormat: value })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="12h" id="time1" />
              <Label htmlFor="time1" className="cursor-pointer">
                12-hour (e.g., 2:30 PM)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="24h" id="time2" />
              <Label htmlFor="time2" className="cursor-pointer">
                24-hour (e.g., 14:30)
              </Label>
            </div>
          </RadioGroup>
        </Card>

        {/* Timezone */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-primary" />
            <Label className="text-base font-semibold">Timezone</Label>
          </div>
          <Select
            value={settings.timezone}
            onValueChange={(value) => setSettings({ ...settings, timezone: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
              <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
              <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
              <SelectItem value="America/Mexico_City">Mexico City (CDMX)</SelectItem>
              <SelectItem value="America/Cancun">Cancún</SelectItem>
              <SelectItem value="America/Tijuana">Tijuana</SelectItem>
              <SelectItem value="America/Monterrey">Monterrey</SelectItem>
              <SelectItem value="America/Santo_Domingo">Santo Domingo</SelectItem>
              <SelectItem value="America/Bogota">Bogotá</SelectItem>
              <SelectItem value="America/Lima">Lima</SelectItem>
              <SelectItem value="America/Santiago">Santiago</SelectItem>
              <SelectItem value="America/Buenos_Aires">Buenos Aires</SelectItem>
              <SelectItem value="America/Sao_Paulo">São Paulo</SelectItem>
              <SelectItem value="America/Caracas">Caracas</SelectItem>
              <SelectItem value="America/Panama">Panama City</SelectItem>
              <SelectItem value="America/Costa_Rica">San José, Costa Rica</SelectItem>
              <SelectItem value="America/Guatemala">Guatemala City</SelectItem>
              <SelectItem value="America/Havana">Havana</SelectItem>
              <SelectItem value="America/Puerto_Rico">San Juan, Puerto Rico</SelectItem>
              <SelectItem value="Europe/London">London (GMT)</SelectItem>
              <SelectItem value="Europe/Madrid">Madrid (CET)</SelectItem>
              <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
              <SelectItem value="Europe/Berlin">Berlin (CET)</SelectItem>
              <SelectItem value="Asia/Dubai">Dubai</SelectItem>
              <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
              <SelectItem value="Australia/Sydney">Sydney</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {/* Currency */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-5 h-5 text-primary" />
            <Label className="text-base font-semibold">Currency</Label>
          </div>
          <Select
            value={settings.currency}
            onValueChange={(value) => setSettings({ ...settings, currency: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
              <SelectItem value="MXN">MXN - Mexican Peso ($)</SelectItem>
              <SelectItem value="DOP">DOP - Dominican Peso (RD$)</SelectItem>
              <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
              <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
              <SelectItem value="CAD">CAD - Canadian Dollar ($)</SelectItem>
              <SelectItem value="COP">COP - Colombian Peso ($)</SelectItem>
              <SelectItem value="ARS">ARS - Argentine Peso ($)</SelectItem>
              <SelectItem value="CLP">CLP - Chilean Peso ($)</SelectItem>
              <SelectItem value="PEN">PEN - Peruvian Sol (S/)</SelectItem>
              <SelectItem value="BRL">BRL - Brazilian Real (R$)</SelectItem>
              <SelectItem value="VES">VES - Venezuelan Bolívar (Bs)</SelectItem>
              <SelectItem value="CRC">CRC - Costa Rican Colón (₡)</SelectItem>
              <SelectItem value="GTQ">GTQ - Guatemalan Quetzal (Q)</SelectItem>
              <SelectItem value="PAB">PAB - Panamanian Balboa (B/.)</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </MobileLayout>
  );
}
