import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowLeft } from "lucide-react";

interface BusinessNameProps {
  data: any;
  onNext: (data: any) => void;
  onBack?: () => void;
}

export default function BusinessName({ data, onNext, onBack }: BusinessNameProps) {
  const [businessName, setBusinessName] = useState(data.businessName || "");
  const [website, setWebsite] = useState(data.website || "");

  const handleContinue = () => {
    onNext({ businessName, website });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="p-4 bg-primary/10 rounded-full">
          <Building2 className="w-12 h-12 text-primary" />
        </div>
      </div>

      <p className="text-center text-muted-foreground">
        This is the brand name your clients will see
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="businessName" className="text-base">
            Business Name *
          </Label>
          <Input
            id="businessName"
            placeholder="e.g., Studio Elite Salon"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="h-12 text-lg"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="website" className="text-base">
            Website (optional)
          </Label>
          <Input
            id="website"
            placeholder="https://yourbusiness.com"
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
          disabled={!businessName.trim()}
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
