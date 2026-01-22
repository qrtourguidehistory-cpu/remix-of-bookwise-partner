import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MapPin, Loader2, CheckCircle2, AlertCircle, Navigation } from "lucide-react";
import { toast } from "sonner";
import { useMapbox } from "@/hooks/useMapbox";
import { Card } from "@/components/ui/card";
import mapboxgl from 'mapbox-gl';
import { Geolocation } from '@capacitor/geolocation';

interface BusinessLocationStepProps {
  data: any;
  onNext: (data: any) => void;
  onBack?: () => void;
}

interface LocationData {
  latitude: number | null;
  longitude: number | null;
  address: string;
  city: string;
  state: string;
  country: string;
}

export default function BusinessLocationStep({ 
  data, 
  onNext, 
  onBack 
}: BusinessLocationStepProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const [location, setLocation] = useState<LocationData>({
    latitude: data.locationDetails?.latitude || null,
    longitude: data.locationDetails?.longitude || null,
    address: data.locationDetails?.address || data.address || "",
    city: data.locationDetails?.city || "",
    state: data.locationDetails?.state || "",
    country: data.locationDetails?.country || "",
  });

  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);

  // Token de Mapbox desde variables de entorno (opcional)
  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || import.meta.env.VITE_MAPBOX_TOKEN;
  const hasMapboxToken = !!MAPBOX_TOKEN;

  const { isLoaded, loadError } = useMapbox({
    accessToken: MAPBOX_TOKEN || '',
    enabled: hasMapboxToken, // Solo habilitar si hay token
  });

  // Geocodificación inversa usando Mapbox Geocoding API
  const reverseGeocode = async (lng: number, lat: number) => {
    if (!hasMapboxToken) {
      // Si no hay token, solo guardar coordenadas
      setLocation(prev => ({
        ...prev,
        latitude: lat,
        longitude: lng,
      }));
      toast.info("Coordenadas guardadas (Mapbox no disponible)");
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=es`
      );
      
      if (!response.ok) throw new Error('Geocoding failed');
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const context = feature.context || [];
        
        // Extraer componentes de dirección
        let city = "";
        let state = "";
        let country = "";
        
        context.forEach((item: any) => {
          if (item.id.startsWith('place.')) {
            city = item.text;
          } else if (item.id.startsWith('region.')) {
            state = item.text;
          } else if (item.id.startsWith('country.')) {
            country = item.text;
          }
        });
        
        setLocation({
          latitude: lat,
          longitude: lng,
          address: feature.place_name || feature.text || "",
          city: city || location.city,
          state: state || location.state,
          country: country || location.country,
        });
        
        toast.success("Ubicación actualizada");
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      // Si falla, solo guardar coordenadas
      setLocation(prev => ({
        ...prev,
        latitude: lat,
        longitude: lng,
      }));
    }
  };

  // Inicializar mapa
  useEffect(() => {
    if (!hasMapboxToken || !isLoaded || !mapContainerRef.current || mapRef.current) return;

    // Coordenadas por defecto (Ciudad de México)
    const defaultLat = location.latitude || 19.4326;
    const defaultLng = location.longitude || -99.1332;

    // Crear mapa
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [defaultLng, defaultLat],
      zoom: location.latitude ? 15 : 12,
    });

    // Crear marcador draggable (rojo)
    const marker = new mapboxgl.Marker({
      draggable: true,
      color: '#ef4444', // Rojo
    })
      .setLngLat([defaultLng, defaultLat])
      .addTo(map);

    // Evento: cuando el usuario arrastra el marcador
    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      setIsConfirmed(false);
      reverseGeocode(lngLat.lng, lngLat.lat);
    });

    // Evento: cuando el usuario hace clic en el mapa
    map.on('click', (e) => {
      marker.setLngLat(e.lngLat);
      setIsConfirmed(false);
      reverseGeocode(e.lngLat.lng, e.lngLat.lat);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Si ya hay coordenadas, hacer geocodificación inversa
    if (location.latitude && location.longitude && !location.address) {
      reverseGeocode(location.longitude, location.latitude);
    }

    return () => {
      map.remove();
    };
  }, [isLoaded, hasMapboxToken]);

  // Obtener ubicación actual del usuario (GPS)
  const handleGetCurrentLocation = async () => {
    setIsGeolocating(true);
    toast.loading("Obteniendo tu ubicación...", { id: 'geolocation' });

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (mapRef.current && markerRef.current) {
        // Animar el mapa hacia la nueva ubicación
        mapRef.current.flyTo({
          center: [lng, lat],
          zoom: 16,
          duration: 2000,
        });
        
        markerRef.current.setLngLat([lng, lat]);
        await reverseGeocode(lng, lat);
      }

      toast.success("Ubicación obtenida", { id: 'geolocation' });
    } catch (error: any) {
      console.error('Geolocation error:', error);
      toast.error("No se pudo obtener tu ubicación", { id: 'geolocation' });
    } finally {
      setIsGeolocating(false);
    }
  };

  // Confirmar ubicación
  const handleConfirmLocation = () => {
    if (!location.latitude || !location.longitude) {
      toast.error("Por favor selecciona una ubicación en el mapa");
      return;
    }

    if (!location.city || !location.state || !location.country) {
      toast.error("Falta información de ubicación (ciudad, estado o país)");
      return;
    }

    setIsConfirmed(true);
    toast.success("Ubicación confirmada", {
      description: `${location.city}, ${location.state}, ${location.country}`,
    });
  };

  // Continuar al siguiente paso
  const handleContinue = () => {
    if (!isConfirmed) {
      toast.error("Por favor confirma la ubicación antes de continuar");
      return;
    }

    onNext({
      address: location.address,
      locationDetails: {
        ...data.locationDetails,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        city: location.city,
        state: location.state,
        country: location.country,
      }
    });
  };

  // Manejo de errores de carga o falta de token
  if (!hasMapboxToken) {
    return (
      <div className="space-y-6">
        <Card className="p-6 border-orange-500">
          <div className="flex items-center gap-3 text-orange-600">
            <AlertCircle className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Mapbox no configurado</h3>
              <p className="text-sm text-muted-foreground">
                Para usar el mapa interactivo, configura VITE_MAPBOX_ACCESS_TOKEN en tus variables de entorno.
              </p>
            </div>
          </div>
        </Card>
        <div className="space-y-4">
          <div className="p-4 border rounded-lg space-y-3">
            <Label className="text-sm font-medium">Ubicación manual</Label>
            <p className="text-sm text-muted-foreground">
              Puedes ingresar la dirección manualmente o usar coordenadas GPS.
            </p>
            <div className="grid gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Dirección</Label>
                <Input
                  value={location.address}
                  onChange={(e) => setLocation(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Calle, número, colonia"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Ciudad</Label>
                  <Input
                    value={location.city}
                    onChange={(e) => setLocation(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Ciudad"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <Input
                    value={location.state}
                    onChange={(e) => setLocation(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="Estado"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">País</Label>
                  <Input
                    value={location.country}
                    onChange={(e) => setLocation(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="País"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-3 pt-2">
          <Button
            onClick={() => {
              if (!location.city || !location.state || !location.country) {
                toast.error("Por favor completa ciudad, estado y país");
                return;
              }
              setIsConfirmed(true);
              onNext({
                address: location.address || `${location.city}, ${location.state}, ${location.country}`,
                locationDetails: {
                  ...data.locationDetails,
                  address: location.address || `${location.city}, ${location.state}, ${location.country}`,
                  city: location.city,
                  state: location.state,
                  country: location.country,
                }
              });
            }}
            className="w-full h-12 text-base"
            disabled={!location.city || !location.state || !location.country}
          >
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

  // Manejo de errores de carga
  if (loadError) {
    return (
      <div className="space-y-6">
        <Card className="p-6 border-destructive">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Error al cargar el mapa</h3>
              <p className="text-sm text-muted-foreground">
                No se pudo cargar Mapbox. Verifica tu conexión.
              </p>
            </div>
          </div>
        </Card>
        {onBack && (
          <Button variant="outline" onClick={onBack} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <MapPin className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Ubicación del negocio</h2>
        <p className="text-muted-foreground text-sm">
          Selecciona la ubicación exacta de tu negocio en el mapa
        </p>
      </div>

      {/* Botón de geolocalización */}
      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          onClick={handleGetCurrentLocation}
          disabled={!isLoaded || isGeolocating}
          className="gap-2"
        >
          {isGeolocating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Obteniendo ubicación...
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              Usar mi ubicación actual
            </>
          )}
        </Button>
      </div>

      {/* Mapa */}
      <div className="space-y-3">
        <div 
          ref={mapContainerRef} 
          className="w-full h-[400px] rounded-lg border-2 border-border overflow-hidden bg-muted"
        >
          {!isLoaded && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Cargando mapa...</p>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          💡 <strong>Tip:</strong> Arrastra el marcador rojo o haz clic en el mapa para ajustar la ubicación
        </p>
      </div>

      {/* Información de ubicación */}
      {location.latitude && location.longitude && (
        <Card className={`p-4 ${isConfirmed ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'}`}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Ubicación seleccionada</span>
              {isConfirmed ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-orange-600" />
              )}
            </div>
            
            <div className="text-sm space-y-1">
              <p className="font-medium">{location.address || "Dirección no disponible"}</p>
              <p className="text-muted-foreground">
                {location.city && `${location.city}, `}
                {location.state && `${location.state}, `}
                {location.country}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </p>
            </div>

            {!isConfirmed && (
              <Button 
                onClick={handleConfirmLocation} 
                className="w-full mt-2"
                variant="default"
                size="sm"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirmar ubicación
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Botones de navegación */}
      <div className="space-y-3 pt-2">
        <Button 
          onClick={handleContinue} 
          className="w-full h-12 text-base"
          disabled={!isConfirmed}
        >
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
