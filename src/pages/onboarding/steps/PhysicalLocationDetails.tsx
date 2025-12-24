import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MapPin, Loader2, CheckCircle2 } from "lucide-react";
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
    address: data.locationDetails?.address || "",
    googleMapsUrl: data.locationDetails?.googleMapsUrl || "",
    phone: data.locationDetails?.phone || "",
    reference: data.locationDetails?.reference || "",
    latitude: data.locationDetails?.latitude || null,
    longitude: data.locationDetails?.longitude || null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeSuccess, setGeocodeSuccess] = useState(false);

  const geocodeAddress = useCallback(async (address: string) => {
    if (!address.trim()) return;
    
    setIsGeocoding(true);
    setGeocodeSuccess(false);
    
    try {
      // Try to extract coordinates from Google Maps URL first
      if (formData.googleMapsUrl) {
        const urlMatch = formData.googleMapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (urlMatch) {
          const lat = parseFloat(urlMatch[1]);
          const lng = parseFloat(urlMatch[2]);
          setFormData(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng
          }));
          setGeocodeSuccess(true);
          toast.success("Coordenadas extraídas del enlace de Google Maps");
          setIsGeocoding(false);
          return;
        }
      }

      // Use Nominatim (OpenStreetMap) for geocoding - free and no API key required
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
        {
          headers: {
            'User-Agent': 'BookWisePartner/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }

      const results = await response.json();
      
      if (results.length > 0) {
        const { lat, lon } = results[0];
        setFormData(prev => ({
          ...prev,
          latitude: parseFloat(lat),
          longitude: parseFloat(lon)
        }));
        setGeocodeSuccess(true);
        toast.success("Ubicación encontrada correctamente");
      } else {
        toast.warning("No se encontraron coordenadas para esta dirección. Puedes ingresarlas manualmente.");
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error("Error al buscar coordenadas. Puedes ingresarlas manualmente.");
    } finally {
      setIsGeocoding(false);
    }
  }, [formData.googleMapsUrl]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.address.trim()) {
      newErrors.address = "Address is required";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }

    if (formData.googleMapsUrl && !formData.googleMapsUrl.match(/^https?:\/\/.+/)) {
      newErrors.googleMapsUrl = "Please enter a valid URL";
    }

    // Validate latitude range
    if (formData.latitude !== null && (formData.latitude < -90 || formData.latitude > 90)) {
      newErrors.latitude = "Latitude must be between -90 and 90";
    }

    // Validate longitude range
    if (formData.longitude !== null && (formData.longitude < -180 || formData.longitude > 180)) {
      newErrors.longitude = "Longitude must be between -180 and 180";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validateForm()) {
      onNext({ 
        locationDetails: {
          address: formData.address,
          googleMapsUrl: formData.googleMapsUrl || null,
          phone: formData.phone,
          reference: formData.reference || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
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
        <h2 className="text-xl font-semibold mb-2">Business Location</h2>
        <p className="text-muted-foreground">
          Tell us where your clients can find you
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="address">
            Business Address <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => {
                setFormData({ ...formData, address: e.target.value });
                setGeocodeSuccess(false);
              }}
              placeholder="123 Main Street, City, State ZIP"
              className={errors.address ? "border-destructive" : ""}
            />
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              onClick={() => geocodeAddress(formData.address)}
              disabled={isGeocoding || !formData.address.trim()}
              title="Buscar coordenadas"
            >
              {isGeocoding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : geocodeSuccess ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
            </Button>
          </div>
          {errors.address && (
            <p className="text-sm text-destructive">{errors.address}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">
            Contact Phone <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+1 (555) 123-4567"
            className={errors.phone ? "border-destructive" : ""}
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="googleMapsUrl">
            Google Maps URL <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="googleMapsUrl"
            type="url"
            value={formData.googleMapsUrl}
            onChange={(e) => setFormData({ ...formData, googleMapsUrl: e.target.value })}
            placeholder="https://maps.google.com/..."
            className={errors.googleMapsUrl ? "border-destructive" : ""}
          />
          {errors.googleMapsUrl && (
            <p className="text-sm text-destructive">{errors.googleMapsUrl}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Share your Google Maps link so clients can find you easily. We'll extract coordinates automatically.
          </p>
        </div>

        {/* Latitude and Longitude fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="latitude">
              Latitude <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              value={formData.latitude ?? ""}
              onChange={(e) => setFormData({ 
                ...formData, 
                latitude: e.target.value ? parseFloat(e.target.value) : null 
              })}
              placeholder="e.g., 19.4326"
              className={errors.latitude ? "border-destructive" : ""}
            />
            {errors.latitude && (
              <p className="text-sm text-destructive">{errors.latitude}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="longitude">
              Longitude <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              value={formData.longitude ?? ""}
              onChange={(e) => setFormData({ 
                ...formData, 
                longitude: e.target.value ? parseFloat(e.target.value) : null 
              })}
              placeholder="e.g., -99.1332"
              className={errors.longitude ? "border-destructive" : ""}
            />
            {errors.longitude && (
              <p className="text-sm text-destructive">{errors.longitude}</p>
            )}
          </div>
        </div>

        {formData.latitude && formData.longitude && (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Ubicación configurada: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reference">
            Location Reference <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="reference"
            value={formData.reference}
            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
            placeholder="e.g., Blue building next to the pharmacy, second floor"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Any additional details to help clients find your location
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
