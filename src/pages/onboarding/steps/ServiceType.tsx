import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Store, Truck, Monitor, ArrowLeft } from "lucide-react";

interface ServiceTypeProps {
  data: any;
  onNext: (data: any) => void;
  onBack?: () => void;
}

export default function ServiceType({ data, onNext, onBack }: ServiceTypeProps) {
  const [serviceType, setServiceType] = useState(data.serviceType || "");

  const handleContinue = () => {
    onNext({ serviceType });
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-muted-foreground">
        How do you provide your services?
      </p>

      <div className="grid gap-4">
        <button
          onClick={() => setServiceType("physical")}
          className={`p-6 rounded-lg border-2 transition-all hover:border-primary/50 ${
            serviceType === "physical"
              ? "border-primary bg-primary/5"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Store className="w-8 h-8" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-semibold text-lg mb-2">Physical location</h3>
              <p className="text-sm text-muted-foreground">
                Clients come to me at my business location
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setServiceType("mobile")}
          className={`p-6 rounded-lg border-2 transition-all hover:border-primary/50 ${
            serviceType === "mobile"
              ? "border-primary bg-primary/5"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Truck className="w-8 h-8" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-semibold text-lg mb-2">Mobile service</h3>
              <p className="text-sm text-muted-foreground">
                I visit my clients as a mobile operator
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setServiceType("virtual")}
          className={`p-6 rounded-lg border-2 transition-all hover:border-primary/50 ${
            serviceType === "virtual"
              ? "border-primary bg-primary/5"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Monitor className="w-8 h-8" />
            </div>
            <div className="text-left flex-1">
              <h3 className="font-semibold text-lg mb-2">Virtual services</h3>
              <p className="text-sm text-muted-foreground">
                I provide services online or remotely
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleContinue}
          disabled={!serviceType}
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
