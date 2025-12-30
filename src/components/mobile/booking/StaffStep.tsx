import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

interface Staff {
  id: string;
  full_name: string;
  avatar_url?: string;
  specialties?: string[];
}

interface StaffStepProps {
  staff: Staff[];
  selectedStaff: string;
  onStaffChange: (staffId: string) => void;
}

export function StaffStep({ staff, selectedStaff, onStaffChange }: StaffStepProps) {
  const { language } = useLanguage();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {language === "es" ? "Seleccionar Personal" : "Select Staff"}
      </h2>
      <RadioGroup value={selectedStaff} onValueChange={onStaffChange}>
        <div className="space-y-3">
          {staff.map((member) => (
            <Label
              key={member.id}
              htmlFor={member.id}
              className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value={member.id} id={member.id} />
                <div className="flex items-center gap-3">
                  {member.avatar_url && (
                    <img
                      src={member.avatar_url}
                      alt={member.full_name}
                      className="w-12 h-12 object-cover rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium">{member.full_name}</p>
                    {member.specialties && (
                      <p className="text-sm text-muted-foreground">
                        {member.specialties.join(", ")}
                      </p>
                    )}
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
