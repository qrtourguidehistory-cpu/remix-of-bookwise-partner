import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { applyThemeColor } from "@/lib/themeUtils";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Palette, Moon, Sun, Calendar } from "lucide-react";

const BRAND_COLORS = [
  { name: "Black", value: "#000000" },
  { name: "White", value: "#ffffff" },
  { name: "Dark Blue", value: "#1e3a8a" },
  { name: "Sky Blue", value: "#0ea5e9" },
  { name: "Bright Red", value: "#ff0000" },
  { name: "Dark Gray", value: "#1a1a1a" },
  { name: "Gray", value: "#4a4a4a" },
  { name: "Light Gray", value: "#808080" },
];

export default function ThemeSettingsPage() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language } = useLanguage();
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [appointmentColor, setAppointmentColor] = useState("#000000");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadThemeSettings();
  }, [profile]);

  const loadThemeSettings = async () => {
    if (!profile?.business_id) return;

    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("theme_settings")
        .eq("id", profile.business_id)
        .single();

      if (error) throw error;
      if (data?.theme_settings && typeof data.theme_settings === 'object') {
        if ('primaryColor' in data.theme_settings) {
          setSelectedColor(data.theme_settings.primaryColor as string || "#000000");
        }
        if ('appointmentColor' in data.theme_settings) {
          setAppointmentColor(data.theme_settings.appointmentColor as string || "#000000");
        }
      }
    } catch (error: any) {
      console.error("Error loading theme settings:", error);
    }
  };

  const handleSave = async () => {
    if (!profile?.business_id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          theme_settings: {
            primaryColor: selectedColor,
            appointmentColor: appointmentColor,
            darkMode: theme === "dark",
          },
        })
        .eq("id", profile.business_id);

      if (error) throw error;
      
      // Apply the color to CSS variables immediately
      applyThemeColor(selectedColor);
      
      toast.success("Theme settings saved");
    } catch (error: any) {
      toast.error("Error saving theme settings");
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
          <h2 className="text-lg font-semibold">Theme & Colors</h2>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Dark Mode Toggle */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon className="w-5 h-5 text-primary" />
              ) : (
                <Sun className="w-5 h-5 text-primary" />
              )}
              <div>
                <Label className="text-base font-semibold">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">
                  {theme === "dark" ? "Currently in dark mode" : "Currently in light mode"}
                </p>
              </div>
            </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => {
                  if ((checked && theme === "light") || (!checked && theme === "dark")) {
                    toggleTheme();
                  }
                }}
              />
          </div>
        </Card>

        {/* Brand Color Selector */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5 text-primary" />
              <div>
                <Label className="text-base font-semibold">Brand Color</Label>
                <p className="text-sm text-muted-foreground">
                  Choose your primary brand color
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {BRAND_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setSelectedColor(color.value)}
                  className={`aspect-square rounded-lg border-2 transition-all ${
                    selectedColor === color.value
                      ? "border-primary scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {selectedColor === color.value && (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-black"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7"></path>
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="text-center text-sm text-muted-foreground">
              Selected: {BRAND_COLORS.find((c) => c.value === selectedColor)?.name}
            </div>
          </div>
        </Card>

        {/* Appointment Color Selector */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <Label className="text-base font-semibold">
                  {language === "es" ? "Color de Citas" : "Appointment Color"}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {language === "es" 
                    ? "Color del borde izquierdo de las citas en el calendario" 
                    : "Left border color for appointments in calendar"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {BRAND_COLORS.map((color) => (
                <button
                  key={`appt-${color.value}`}
                  onClick={() => setAppointmentColor(color.value)}
                  className={`aspect-square rounded-lg border-2 transition-all ${
                    appointmentColor === color.value
                      ? "border-primary scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {appointmentColor === color.value && (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-black"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7"></path>
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="text-center text-sm text-muted-foreground">
              {language === "es" ? "Seleccionado: " : "Selected: "}
              {BRAND_COLORS.find((c) => c.value === appointmentColor)?.name}
            </div>

            {/* Preview of appointment card */}
            <div className="mt-4 p-3 bg-muted/50 rounded-lg border-l-4" style={{ borderLeftColor: appointmentColor }}>
              <div className="text-sm font-semibold">8:00am - 8:45am Cliente Ejemplo</div>
              <div className="text-xs text-muted-foreground mt-0.5">Servicio de ejemplo</div>
            </div>
          </div>
        </Card>

        {/* Preview */}
        <Card className="p-4">
          <Label className="text-base font-semibold mb-4 block">Preview</Label>
          <div className="space-y-3">
            <Button className="w-full" style={{ backgroundColor: selectedColor }}>
              Primary Button
            </Button>
            <Button variant="outline" className="w-full">
              Outline Button
            </Button>
          </div>
        </Card>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
          {saving ? "Saving..." : "Save Theme Settings"}
        </Button>
      </div>
    </MobileLayout>
  );
}
