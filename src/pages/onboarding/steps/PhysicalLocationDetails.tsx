import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MapPin, Loader2, CheckCircle2, Phone, User, Building2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface PhysicalLocationDetailsProps {
  data: any;
  onNext: (data: any) => void;
  onBack?: () => void;
}

export default function PhysicalLocationDetails({ 
  data, 
  onNext, 
  onBack 
}: PhysicalLocationDetailsProps) {
  const [formData, setFormData] = useState({
    country: data.locationDetails?.country || "",
    state: data.locationDetails?.state || "",
    city: data.locationDetails?.city || "",
    googleMapsUrl: data.locationDetails?.googleMapsUrl || "",
    businessPhone: data.locationDetails?.businessPhone || data.locationDetails?.phone || "",
    ownerPhone: data.locationDetails?.ownerPhone || "",
    reference: data.locationDetails?.reference || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isExtracting, setIsExtracting] = useState(false);

  const extractLocationFromUrl = useCallback(async () => {
    if (!formData.googleMapsUrl.trim()) {
      toast.error("Por favor ingresa un enlace de Google Maps");
      return;
    }
    
    setIsExtracting(true);
    
    try {
      // Extract place name from various Google Maps URL formats
      let placeName = "";
      
      // Format: /place/Place+Name/
      const placeMatch = formData.googleMapsUrl.match(/\/place\/([^/]+)\//);
      if (placeMatch) {
        placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      }
      
      // Format: /maps/search/Place+Name/
      const searchMatch = formData.googleMapsUrl.match(/\/maps\/search\/([^/]+)/);
      if (!placeName && searchMatch) {
        placeName = decodeURIComponent(searchMatch[1].replace(/\+/g, " "));
      }

      if (placeName) {
        // Try to extract city, state, country from the place name
        const parts = placeName.split(",").map(p => p.trim());
        
        if (parts.length >= 3) {
          setFormData(prev => ({
            ...prev,
            city: parts[0] || prev.city,
            state: parts[1] || prev.state,
            country: parts[parts.length - 1] || prev.country,
          }));
          toast.success("Ubicación extraída del enlace");
        } else if (parts.length === 2) {
          setFormData(prev => ({
            ...prev,
            city: parts[0] || prev.city,
            state: parts[1] || prev.state,
          }));
          toast.success("Ubicación parcialmente extraída");
        } else {
          toast.info("Ingresa manualmente el país, estado y ciudad");
        }
      } else {
        toast.info("No se pudo extraer la ubicación automáticamente. Ingresa los datos manualmente.");
      }
    } catch (error) {
      console.error('Error extracting location:', error);
      toast.error("Error al procesar el enlace");
    } finally {
      setIsExtracting(false);
    }
  }, [formData.googleMapsUrl]);

  const openGoogleMaps = () => {
    window.open("https://maps.google.com", "_blank");
  };

  // Phone validation function
  const validatePhoneFormat = (phone: string): boolean => {
    if (!phone.trim()) return false;
    // Allow formats: +52 555 123 4567, (555) 123-4567, 5551234567, +1-555-123-4567
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;
    const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 15 && phoneRegex.test(phone.replace(/[\s]/g, ''));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.country.trim()) {
      newErrors.country = "El país es requerido";
    }

    if (!formData.state.trim()) {
      newErrors.state = "El estado es requerido";
    }

    if (!formData.city.trim()) {
      newErrors.city = "La ciudad es requerida";
    }

    if (!formData.businessPhone.trim()) {
      newErrors.businessPhone = "El teléfono del negocio es requerido";
    } else if (!validatePhoneFormat(formData.businessPhone)) {
      newErrors.businessPhone = "Formato de teléfono inválido (mínimo 10 dígitos)";
    }

    if (formData.ownerPhone.trim() && !validatePhoneFormat(formData.ownerPhone)) {
      newErrors.ownerPhone = "Formato de teléfono inválido (mínimo 10 dígitos)";
    }

    if (formData.googleMapsUrl && !formData.googleMapsUrl.match(/^https?:\/\/.+/)) {
      newErrors.googleMapsUrl = "Por favor ingresa una URL válida";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validateForm()) {
      // Build address from components
      const address = [formData.city, formData.state, formData.country]
        .filter(Boolean)
        .join(", ");

      onNext({ 
        address,
        phone: formData.businessPhone,
        locationDetails: {
          country: formData.country,
          state: formData.state,
          city: formData.city,
          googleMapsUrl: formData.googleMapsUrl || null,
          businessPhone: formData.businessPhone,
          ownerPhone: formData.ownerPhone || null,
          reference: formData.reference || null,
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <MapPin className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Ubicación del negocio</h2>
        <p className="text-muted-foreground">
          Indica dónde pueden encontrarte tus clientes
        </p>
      </div>

      <div className="space-y-4">
        {/* Google Maps URL Section */}
        <div className="p-4 bg-muted/30 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="googleMapsUrl" className="text-sm font-medium">
              Enlace de Google Maps
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={openGoogleMaps}
              className="text-xs h-7"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Abrir Maps
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              id="googleMapsUrl"
              type="url"
              value={formData.googleMapsUrl}
              onChange={(e) => setFormData({ ...formData, googleMapsUrl: e.target.value })}
              placeholder="https://maps.google.com/..."
              className={errors.googleMapsUrl ? "border-destructive" : ""}
            />
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              onClick={extractLocationFromUrl}
              disabled={isExtracting || !formData.googleMapsUrl.trim()}
              title="Extraer ubicación"
            >
              {isExtracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Busca tu negocio en Google Maps, copia el enlace y pégalo aquí. Este enlace también aparecerá en tu perfil público.
          </p>
        </div>

        {/* Location Fields */}
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="country">
              País <span className="text-destructive">*</span>
            </Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              placeholder="México"
              className={errors.country ? "border-destructive" : ""}
            />
            {errors.country && (
              <p className="text-sm text-destructive">{errors.country}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="state">
                Estado <span className="text-destructive">*</span>
              </Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="Jalisco"
                className={errors.state ? "border-destructive" : ""}
              />
              {errors.state && (
                <p className="text-sm text-destructive">{errors.state}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">
                Ciudad <span className="text-destructive">*</span>
              </Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Guadalajara"
                className={errors.city ? "border-destructive" : ""}
              />
              {errors.city && (
                <p className="text-sm text-destructive">{errors.city}</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Phone className="w-4 h-4" />
            <span>Información de contacto</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessPhone" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Teléfono del negocio <span className="text-destructive">*</span>
            </Label>
            <Input
              id="businessPhone"
              type="tel"
              value={formData.businessPhone}
              onChange={(e) => setFormData({ ...formData, businessPhone: e.target.value })}
              placeholder="+52 (555) 123-4567"
              className={errors.businessPhone ? "border-destructive" : ""}
            />
            {errors.businessPhone && (
              <p className="text-sm text-destructive">{errors.businessPhone}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Este número será visible en tu perfil público
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerPhone" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Teléfono del propietario <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="ownerPhone"
              type="tel"
              value={formData.ownerPhone}
              onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
              placeholder="+52 (555) 987-6543"
              className={errors.ownerPhone ? "border-destructive" : ""}
            />
            {errors.ownerPhone && (
              <p className="text-sm text-destructive">{errors.ownerPhone}</p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Este número NO será publicado
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reference">
            Referencia de ubicación <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="reference"
            value={formData.reference}
            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
            placeholder="ej., Edificio azul junto a la farmacia, segundo piso"
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            Detalles adicionales para ayudar a tus clientes a encontrarte
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Button onClick={handleContinue} className="w-full h-12 text-base">
          Continuar
        </Button>
        {onBack && (
          <Button variant="outline" onClick={onBack} className="w-full h-12 text-base">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>
        )}
      </div>
    </div>
  );
}
