import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, User, Phone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Client {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}

interface ManualAppointmentClientStepProps {
  clients: Client[];
  selectedClientId: string | null;
  manualName: string;
  manualPhone: string;
  onClientIdChange: (clientId: string | null) => void;
  onManualNameChange: (name: string) => void;
  onManualPhoneChange: (phone: string) => void;
}

export function ManualAppointmentClientStep({
  clients,
  selectedClientId,
  manualName,
  manualPhone,
  onClientIdChange,
  onManualNameChange,
  onManualPhoneChange,
}: ManualAppointmentClientStepProps) {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  
  // ✅ Cuando se selecciona un cliente existente, auto-completar nombre y teléfono en los campos manuales
  useEffect(() => {
    if (selectedClientId && selectedClientId !== "none") {
      const selectedClient = clients.find(c => c.id?.toString() === selectedClientId);
      if (selectedClient) {
        // Auto-rellenar los campos manuales con los datos del cliente seleccionado
        // Esto permite que el servicio use estos datos directamente
        onManualNameChange(selectedClient.full_name || "");
        onManualPhoneChange(selectedClient.phone || "");
      }
    }
    // No limpiar cuando se deselecciona - el usuario puede querer mantener los datos
  }, [selectedClientId, clients]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Filtrar clientes por búsqueda y asegurar que tengan ID válido
  const filteredClients = clients.filter(client => {
    // ✅ Filtrar clientes sin ID válido
    if (!client.id || client.id.trim() === "" || client.id === "null" || client.id === "undefined") {
      return false;
    }
    // ✅ Filtrar por búsqueda - usar optional chaining para evitar errores con nombres null
    const clientName = client.full_name?.toLowerCase() ?? "";
    const searchLower = searchQuery.toLowerCase();
    return (
      clientName.includes(searchLower) ||
      client.phone?.includes(searchQuery)
    );
  });
  
  const isValid = selectedClientId || manualName.trim().length > 0;
  
  // Handler para cuando se selecciona un cliente del dropdown
  const handleClientSelect = (value: string) => {
    if (value && value !== "none") {
      onClientIdChange(value);
      // Los datos se auto-rellenan en el useEffect
    } else {
      onClientIdChange(null);
      // Limpiar campos manuales cuando se selecciona "Ninguno"
      onManualNameChange("");
      onManualPhoneChange("");
    }
  };
  
  return (
    <div className="space-y-6 p-4 w-full max-w-full overflow-x-hidden">
      <div>
        <h2 className="text-xl font-semibold mb-2">
          {language === "es" ? "Identificación del Cliente" : "Client Identification"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === "es" 
            ? "Selecciona un cliente existente o ingresa los datos manualmente"
            : "Select an existing client or enter data manually"}
        </p>
      </div>
      
      {/* Opción A: Seleccionar Cliente Existente */}
      <div className="space-y-2 w-full">
        <Label>
          {language === "es" ? "Cliente Existente" : "Existing Client"}
        </Label>
        <Select
          value={selectedClientId ? selectedClientId.toString() : "none"}
          onValueChange={handleClientSelect}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={language === "es" ? "Buscar cliente..." : "Search client..."} />
          </SelectTrigger>
          <SelectContent className="max-w-[calc(100vw-2rem)]">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === "es" ? "Buscar por nombre o teléfono..." : "Search by name or phone..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <ScrollArea className="h-[200px]">
              {/* ✅ Usar "none" en lugar de string vacío para el valor de "Ninguno" */}
              <SelectItem value="none">{language === "es" ? "Ninguno (ingresar manualmente)" : "None (enter manually)"}</SelectItem>
              {/* ✅ Filtrar y convertir IDs a string explícitamente */}
              {filteredClients
                .filter(client => {
                  // Validación adicional: asegurar que el ID es válido
                  const id = client.id?.toString().trim();
                  return id && id !== "" && id !== "null" && id !== "undefined";
                })
                .map((client) => {
                  // ✅ Convertir ID a string explícitamente
                  const clientId = client.id.toString();
                  return (
                    <SelectItem key={clientId} value={clientId}>
                      <div className="flex flex-col">
                        <span className="font-medium">{client.full_name || (language === "es" ? "Sin nombre" : "No name")}</span>
                        {client.phone && (
                          <span className="text-xs text-muted-foreground">{client.phone}</span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
            </ScrollArea>
          </SelectContent>
        </Select>
        
        {/* Mostrar datos del cliente seleccionado */}
        {selectedClientId && selectedClientId !== "none" && (
          <div className="p-3 bg-muted rounded-lg">
            {(() => {
              // ✅ Asegurar que el ID sea válido antes de buscar
              const clientId = selectedClientId.toString().trim();
              if (!clientId || clientId === "none") return null;
              
              const selectedClient = clients.find(c => c.id?.toString() === clientId);
              if (!selectedClient) return null;
              return (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{selectedClient.full_name || (language === "es" ? "Sin nombre" : "No name")}</span>
                  </div>
                  {selectedClient.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{selectedClient.phone}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
      
      {/* Opción B: Campos Manuales (solo si no hay cliente seleccionado) */}
      {(!selectedClientId || selectedClientId === "none") && (
        <div className="space-y-4 pt-4 border-t w-full">
          <div className="w-full">
            <Label htmlFor="manual-name">
              {language === "es" ? "Nombre del Cliente" : "Client Name"} *
            </Label>
            <Input
              id="manual-name"
              value={manualName}
              onChange={(e) => onManualNameChange(e.target.value)}
              placeholder={language === "es" ? "Nombre del cliente" : "Client name"}
              className="mt-1 w-full"
            />
          </div>
          
          <div className="w-full">
            <Label htmlFor="manual-phone">
              {language === "es" ? "Número de Teléfono" : "Phone Number"} 
              <span className="text-muted-foreground text-xs ml-1">({language === "es" ? "opcional" : "optional"})</span>
            </Label>
            <Input
              id="manual-phone"
              value={manualPhone}
              onChange={(e) => onManualPhoneChange(e.target.value)}
              placeholder={language === "es" ? "Número de teléfono (opcional)" : "Phone number (optional)"}
              className="mt-1 w-full"
              type="tel"
            />
          </div>
        </div>
      )}
      
      {!isValid && (
        <p className="text-sm text-destructive">
          {language === "es" 
            ? "Por favor selecciona un cliente o ingresa un nombre"
            : "Please select a client or enter a name"}
        </p>
      )}
    </div>
  );
}
