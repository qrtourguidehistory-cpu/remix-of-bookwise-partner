import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

interface BusinessDetailsProps {
  data: any;
  onNext: (data: any) => void;
  onBack?: () => void;
}

export default function BusinessDetails({ data, onNext, onBack }: BusinessDetailsProps) {
  const [businessName, setBusinessName] = useState(data.businessName || "");
  const [website, setWebsite] = useState(data.website || "");

  const handleContinue = () => {
    onNext({ businessName, website });
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-muted-foreground">
        Let's set up your business profile
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="businessName">Business Name *</Label>
          <Input
            id="businessName"
            placeholder="My Awesome Salon"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website (optional)</Label>
          <Input
            id="website"
            type="url"
            placeholder="www.yoursite.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
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
          disabled={!businessName}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
