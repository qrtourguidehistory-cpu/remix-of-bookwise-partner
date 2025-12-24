import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Type, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

export default function AccessibilitySettings() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [showFooterText, setShowFooterText] = useState(true);
  const [fontSize, setFontSize] = useState(1); // 1 = 100%, 1.25 = 125%, etc.
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [profile?.business_id]);

  const loadSettings = async () => {
    if (!profile?.business_id) return;

    try {
      // Load from localStorage first (faster)
      const savedShowFooter = localStorage.getItem("show-footer-text");
      const savedFontSize = localStorage.getItem("font-size-scale");

      if (savedShowFooter !== null) {
        setShowFooterText(savedShowFooter === "true");
      }
      if (savedFontSize !== null) {
        setFontSize(parseFloat(savedFontSize));
      }

      // Also try to load from database
      const { data, error } = await (supabase
        .from("businesses")
        .select("*")
        .eq("id", profile.business_id)
        .single() as any);

      if (!error && (data as any)?.accessibility_settings) {
        const settings = (data as any).accessibility_settings;
        if (settings.showFooterText !== undefined) {
          setShowFooterText(settings.showFooterText);
          localStorage.setItem("show-footer-text", String(settings.showFooterText));
        }
        if (settings.fontSize !== undefined) {
          setFontSize(settings.fontSize);
          localStorage.setItem("font-size-scale", String(settings.fontSize));
        }
      }
    } catch (error) {
      console.error("Error loading accessibility settings:", error);
    }
  };

  const handleSave = async () => {
    if (!profile?.business_id) return;

    setSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem("show-footer-text", String(showFooterText));
      localStorage.setItem("font-size-scale", String(fontSize));

      // Apply font size to root element
      document.documentElement.style.setProperty("--font-scale", String(fontSize));

      // Apply footer visibility - use a more robust approach
      const footerElements = document.querySelectorAll('[data-footer-text]');
      footerElements.forEach((el) => {
        if (showFooterText) {
          (el as HTMLElement).style.display = "";
          (el as HTMLElement).removeAttribute('hidden');
        } else {
          (el as HTMLElement).style.display = "none";
          (el as HTMLElement).setAttribute('hidden', 'true');
        }
      });

      // Also dispatch a custom event to notify other components
      window.dispatchEvent(new CustomEvent('accessibility-settings-changed', {
        detail: { showFooterText, fontSize }
      }));

      // Save to database (try to save, but don't fail if column doesn't exist)
      const { error } = await (supabase
        .from("businesses")
        .update({
          accessibility_settings: {
            showFooterText,
            fontSize,
          },
        } as any)
        .eq("id", profile.business_id) as any);

      if (error) {
        // If column doesn't exist (PGRST204), still show success since localStorage is saved
        if (error.code === 'PGRST204' || error.message?.includes('accessibility_settings')) {
          console.warn("accessibility_settings column not found. Please run the migration. Settings saved to localStorage.");
          toast({
            title: language === "es" ? "Guardado (local)" : "Saved (local)",
            description: language === "es" 
              ? "Configuración guardada localmente. Ejecuta la migración SQL para guardar en la base de datos." 
              : "Settings saved locally. Run the SQL migration to save to database.",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: language === "es" ? "Guardado" : "Saved",
          description: language === "es" ? "Configuración guardada correctamente" : "Settings saved successfully",
        });
      }
    } catch (error: any) {
      console.error("Error saving accessibility settings:", error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" ? "No se pudo guardar la configuración" : "Could not save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const fontSizePercentage = Math.round(fontSize * 100);

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            {language === "es" ? "Accesibilidad y Texto" : "Accessibility & Text"}
          </h1>
        </div>

        <div className="space-y-6">
          {/* Footer Text Visibility */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                {showFooterText ? (
                  <Eye className="h-5 w-5 text-primary" />
                ) : (
                  <EyeOff className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-base">
                    {language === "es" ? "Texto del Footer" : "Footer Text"}
                  </CardTitle>
                  <CardDescription>
                    {language === "es" 
                      ? "Ocultar los textos de los botones de navegación inferior, mostrando solo los iconos" 
                      : "Hide text labels on bottom navigation buttons, showing only icons"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="footer-toggle" className="text-sm">
                  {showFooterText 
                    ? (language === "es" ? "Visible" : "Visible")
                    : (language === "es" ? "Oculto" : "Hidden")}
                </Label>
                <Switch
                  id="footer-toggle"
                  checked={showFooterText}
                  onCheckedChange={setShowFooterText}
                />
              </div>
            </CardContent>
          </Card>

          {/* Font Size */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Type className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">
                    {language === "es" ? "Tamaño de Texto" : "Text Size"}
                  </CardTitle>
                  <CardDescription>
                    {language === "es" 
                      ? "Ajusta el tamaño de todos los textos de la aplicación" 
                      : "Adjust the size of all text in the application"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">
                    {language === "es" ? "Tamaño actual" : "Current size"}
                  </Label>
                  <span className="text-sm font-medium">{fontSizePercentage}%</span>
                </div>
                <Slider
                  value={[fontSize]}
                  onValueChange={(value) => setFontSize(value[0])}
                  min={0.875}
                  max={1.5}
                  step={0.125}
                  className="w-full"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{language === "es" ? "Pequeño" : "Small"}</span>
                  <span>{language === "es" ? "Normal" : "Normal"}</span>
                  <span>{language === "es" ? "Grande" : "Large"}</span>
                </div>
              </div>
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-2">
                  {language === "es" ? "Vista previa:" : "Preview:"}
                </p>
                <p 
                  className="text-base"
                  style={{ fontSize: `calc(1rem * ${fontSize})` }}
                >
                  {language === "es" 
                    ? "Este es un ejemplo de cómo se verá el texto con el tamaño seleccionado."
                    : "This is an example of how text will look with the selected size."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="w-full" 
            size="lg"
          >
            {saving 
              ? (language === "es" ? "Guardando..." : "Saving...")
              : (language === "es" ? "Guardar Cambios" : "Save Changes")}
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}

