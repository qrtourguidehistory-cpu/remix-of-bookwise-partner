import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  image_url?: string;
}

interface ServiceStepProps {
  services: Service[];
  selectedService: string;
  onServiceChange: (serviceId: string) => void;
}

export function ServiceStep({ services, selectedService, onServiceChange }: ServiceStepProps) {
  const { t } = useLanguage();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{t("selectService")}</h2>
      <RadioGroup value={selectedService} onValueChange={onServiceChange}>
        <div className="space-y-3">
          {services.map((service) => (
            <Label
              key={service.id}
              htmlFor={service.id}
              className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value={service.id} id={service.id} />
                <div className="flex items-center gap-3">
                  {service.image_url && (
                    <img
                      src={service.image_url}
                      alt={service.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {service.duration_minutes} min • ${service.price}
                    </p>
                  </div>
                </div>
              </div>
            </Label>
          ))}
        </div>
      </RadioGroup>
    </div>
  );
}
