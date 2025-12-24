import { useState } from "react";
import { Button } from "@/components/ui/button";
import { User, Users, ArrowLeft } from "lucide-react";

interface AccountTypeProps {
  data: any;
  onNext: (data: any) => void;
  onBack?: () => void;
}

export default function AccountType({ data, onNext, onBack }: AccountTypeProps) {
  const [accountType, setAccountType] = useState(data.accountType || "");

  const handleContinue = () => {
    onNext({ accountType });
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-muted-foreground">
        Tell us about your business structure
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
              <h3 className="font-semibold text-lg mb-2">I'm an independent</h3>
              <p className="text-sm text-muted-foreground">
                I work independently and manage my own bookings
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
              <h3 className="font-semibold text-lg mb-2">I have a team</h3>
              <p className="text-sm text-muted-foreground">
                I manage a team of professionals and want to oversee operations
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="flex gap-3">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}
        <Button
          onClick={handleContinue}
          disabled={!accountType}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
