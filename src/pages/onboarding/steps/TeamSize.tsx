import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft } from "lucide-react";

interface TeamSizeProps {
  data: any;
  onNext: (data: any) => void;
  onBack?: () => void;
}

const teamSizes = [
  { id: "2-5", label: "2-5 personas", description: "Equipo pequeño" },
  { id: "6-10", label: "6-10 personas", description: "Equipo mediano" },
  { id: "11+", label: "11+ personas", description: "Equipo grande" },
];

export default function TeamSize({ data, onNext, onBack }: TeamSizeProps) {
  const [teamSize, setTeamSize] = useState(data.teamSize || "");

  const handleContinue = () => {
    onNext({ teamSize });
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-muted-foreground">
        ¿Cuántas personas trabajan en tu negocio?
      </p>

      <div className="grid gap-4">
        {teamSizes.map((size) => (
          <button
            key={size.id}
            onClick={() => setTeamSize(size.id)}
            className={`p-6 rounded-lg border-2 transition-all hover:border-primary/50 ${
              teamSize === size.id
                ? "border-primary bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Users className="w-8 h-8" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-lg mb-1">{size.label}</h3>
                <p className="text-sm text-muted-foreground">{size.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleContinue}
          disabled={!teamSize}
          className="w-full h-12 text-base"
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
