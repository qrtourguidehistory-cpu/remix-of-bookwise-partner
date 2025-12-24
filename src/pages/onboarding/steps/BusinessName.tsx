import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowLeft, User } from "lucide-react";

interface BusinessNameProps {
  data: any;
  onNext: (data: any) => void;
  onBack?: () => void;
}

export default function BusinessName({ data, onNext, onBack }: BusinessNameProps) {
  const [businessName, setBusinessName] = useState(data.businessName || "");
  const [website, setWebsite] = useState(data.website || "");
  const [ownerFirstName, setOwnerFirstName] = useState(data.ownerFirstName || "");
  const [ownerLastName, setOwnerLastName] = useState(data.ownerLastName || "");

  const handleContinue = () => {
    onNext({ businessName, website, ownerFirstName, ownerLastName });
  };

  const isValid = businessName.trim() && ownerFirstName.trim() && ownerLastName.trim();

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="p-4 bg-primary/10 rounded-full">
          <Building2 className="w-12 h-12 text-primary" />
        </div>
      </div>

      <p className="text-center text-muted-foreground">
        Información de tu negocio y propietario
      </p>

      <div className="space-y-4">
        {/* Owner Information Section */}
        <div className="p-4 bg-muted/30 rounded-lg space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <User className="w-4 h-4" />
            <span>Información del propietario</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ownerFirstName" className="text-base">
                Nombre *
              </Label>
              <Input
                id="ownerFirstName"
                placeholder="Juan"
                value={ownerFirstName}
                onChange={(e) => setOwnerFirstName(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerLastName" className="text-base">
                Apellido *
              </Label>
              <Input
                id="ownerLastName"
                placeholder="Pérez"
                value={ownerLastName}
                onChange={(e) => setOwnerLastName(e.target.value)}
                className="h-12"
              />
            </div>
          </div>
        </div>

        {/* Business Information Section */}
        <div className="space-y-2">
          <Label htmlFor="businessName" className="text-base">
            Nombre del negocio *
          </Label>
          <Input
            id="businessName"
            placeholder="ej., Studio Elite Salon"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="h-12 text-lg"
          />
          <p className="text-xs text-muted-foreground">
            Este es el nombre que verán tus clientes
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="website" className="text-base">
            Sitio web (opcional)
          </Label>
          <Input
            id="website"
            placeholder="https://tunegocio.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="h-12"
            type="url"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleContinue}
          disabled={!isValid}
          className="w-full h-12 text-base"
          size="lg"
        >
          Continuar
        </Button>
        {onBack && (
          <Button
            variant="outline"
            onClick={onBack}
            className="w-full h-12 text-base"
            size="lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>
        )}
      </div>
    </div>
  );
}
