import { useState } from "react";
import { Button } from "@/components/ui/button";
import { User, Users, ArrowLeft } from "lucide-react";

interface IndependentOrTeamProps {
  data: any;
  onNext: (data: any) => void;
  onBack?: () => void;
}

export default function IndependentOrTeam({ data, onNext, onBack }: IndependentOrTeamProps) {
  const [accountType, setAccountType] = useState(data.accountType || "");

  const handleContinue = () => {
    onNext({ accountType });
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-muted-foreground">
        Select your business structure
      </p>

      <div className="grid gap-4">
        <button
          onClick={() => setAccountType("independent")}
          className={`p-6 rounded-lg border-2 transition-all hover:border-primary/50 ${
            accountType === "independent"
              ? "border-primary bg-primary/5"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <User className="w-8 h-8" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-semibold text-lg mb-1">I'm an independent</h3>
              <p className="text-sm text-muted-foreground">
                Solo practitioner working alone
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setAccountType("team")}
          className={`p-6 rounded-lg border-2 transition-all hover:border-primary/50 ${
            accountType === "team"
              ? "border-primary bg-primary/5"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Users className="w-8 h-8" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-semibold text-lg mb-1">I have a team</h3>
              <p className="text-sm text-muted-foreground">
                Multiple staff members providing services
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleContinue}
          disabled={!accountType}
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
