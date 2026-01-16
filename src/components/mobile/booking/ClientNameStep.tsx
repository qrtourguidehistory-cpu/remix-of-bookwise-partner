import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

interface ClientNameStepProps {
  clientName: string;
  onClientNameChange: (name: string) => void;
}

export function ClientNameStep({ clientName, onClientNameChange }: ClientNameStepProps) {
  const { t, language } = useLanguage();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {language === "es" ? "Nombre del Cliente" : "Client Name"}
      </h2>
      <div className="space-y-2">
        <Label htmlFor="clientName">
          {language === "es" ? "Nombre completo" : "Full Name"} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="clientName"
          value={clientName}
          onChange={(e) => onClientNameChange(e.target.value)}
          placeholder={language === "es" ? "Ingresa el nombre del cliente" : "Enter client name"}
          required
          className="h-12"
        />
        <p className="text-xs text-muted-foreground">
          {language === "es" ? "Nombre de la persona para quien es la cita" : "Name of the person the appointment is for"}
        </p>
      </div>
    </div>
  );
}

