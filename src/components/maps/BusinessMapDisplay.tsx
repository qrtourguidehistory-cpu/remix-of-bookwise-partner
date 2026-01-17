import { useEffect, useRef } from "react";
import { useMapbox } from "@/hooks/useMapbox";
import { Card } from "@/components/ui/card";
import { MapPin, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import mapboxgl from 'mapbox-gl';

interface BusinessMapDisplayProps {
  latitude: number;
  longitude: number;
  businessName: string;
  address?: string;
  className?: string;
  height?: string;
  showDirectionsButton?: boolean;
}

/**
 * Componente para mostrar la ubicación de un negocio en Mapbox
 * 
 * @example
 * ```tsx
 * <BusinessMapDisplay
 *   latitude={19.432608}
 *   longitude={-99.133209}
 *   businessName="Mi Negocio"
 *   address="Av. Paseo de la Reforma 222"
 *   showDirectionsButton
 * />
 * ```
 */
export default function BusinessMapDisplay({
  latitude,
  longitude,
  businessName,
  address,
  className = "",
  height = "400px",
  showDirectionsButton = true,
}: BusinessMapDisplayProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Token de Mapbox (mismo que la App Cliente)
  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 
    'pk.eyJ1IjoibWl0b3Vybm93IiwiYSI6ImNta2hzYnN3aTBtaHIzZHB1MHgydTZ1OWMifQ.I90chYaZczEFiJ33M7hdxw';

  const { isLoaded, loadError } = useMapbox({
    accessToken: MAPBOX_TOKEN,
  });

  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return;

    // Crear mapa centrado en la ubicación del negocio
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [longitude, latitude],
      zoom: 16,
    });

    // Crear marcador en la ubicación del negocio (rojo)
    const marker = new mapboxgl.Marker({
      color: '#ef4444', // Rojo
    })
      .setLngLat([longitude, latitude])
      .addTo(map);

    // Crear popup con información del negocio
    const popup = new mapboxgl.Popup({
      offset: 25,
      closeButton: false,
    }).setHTML(`
      <div style="padding: 8px; max-width: 200px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${businessName}</h3>
        ${address ? `<p style="margin: 0; font-size: 14px; color: #666;">${address}</p>` : ''}
      </div>
    `);

    marker.setPopup(popup);

    // Mostrar popup por defecto
    popup.addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, [isLoaded, latitude, longitude, businessName, address]);

  // Abrir Google Maps/Mapbox en una nueva pestaña con direcciones
  const handleGetDirections = () => {
    // Usar Google Maps para direcciones (más común en móviles)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    window.open(url, '_blank');
  };

  if (loadError) {
    return (
      <Card className={`p-6 border-destructive ${className}`}>
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Error al cargar el mapa</h3>
            <p className="text-sm text-muted-foreground">
              No se pudo cargar el mapa
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Mapa */}
      <div 
        ref={mapContainerRef} 
        className="w-full rounded-lg border-2 border-border overflow-hidden bg-muted"
        style={{ height }}
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

      {/* Información y botón de direcciones */}
      {isLoaded && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1">
            <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {address && (
                <p className="text-sm font-medium break-words">{address}</p>
              )}
              <p className="text-xs text-muted-foreground font-mono">
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </p>
            </div>
          </div>

          {showDirectionsButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGetDirections}
              className="flex-shrink-0"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Cómo llegar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
