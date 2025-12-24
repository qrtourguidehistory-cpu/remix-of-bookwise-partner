import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scissors, Sparkles, Eye, Heart, Droplet, Users, HandMetal, Waves, Flame, Activity, Stethoscope, PawPrint, MoreHorizontal, ArrowLeft } from "lucide-react";

interface Category {
  id: string;
  label: string;
  icon: any;
}

const categories: Category[] = [
  { id: "hair_salon", label: "Hair salon", icon: Scissors },
  { id: "nails", label: "Nails", icon: Sparkles },
  { id: "eyebrows_lashes", label: "Eyebrows & lashes", icon: Eye },
  { id: "beauty_salon", label: "Beauty salon", icon: Heart },
  { id: "medspa", label: "Medspa", icon: Droplet },
  { id: "barber", label: "Barber", icon: Scissors },
  { id: "massage", label: "Massage", icon: HandMetal },
  { id: "spa_sauna", label: "Spa & sauna", icon: Waves },
  { id: "waxing", label: "Waxing salon", icon: Flame },
  { id: "tattoo_piercing", label: "Tattooing & piercing", icon: HandMetal },
  { id: "tanning", label: "Tanning studio", icon: Waves },
  { id: "fitness", label: "Fitness & recovery", icon: Activity },
  { id: "physical_therapy", label: "Physical therapy", icon: Stethoscope },
  { id: "health_practice", label: "Health practice", icon: Heart },
  { id: "pet_grooming", label: "Pet grooming", icon: PawPrint },
  { id: "other", label: "Other", icon: MoreHorizontal },
];

interface SelectCategoriesProps {
  data: any;
  onNext: (data: any) => void;
  onBack?: () => void;
}

export default function SelectCategories({ data, onNext, onBack }: SelectCategoriesProps) {
  const [primaryCategory, setPrimaryCategory] = useState(data.primaryCategory || "");
  const [secondaryCategories, setSecondaryCategories] = useState<string[]>(data.secondaryCategories || []);

  const handleCategoryClick = (categoryId: string) => {
    if (primaryCategory === categoryId) {
      // Unselect primary
      setPrimaryCategory("");
    } else if (secondaryCategories.includes(categoryId)) {
      // Remove from secondary
      setSecondaryCategories(secondaryCategories.filter(id => id !== categoryId));
    } else if (!primaryCategory) {
      // Set as primary
      setPrimaryCategory(categoryId);
    } else if (secondaryCategories.length < 3) {
      // Add to secondary
      setSecondaryCategories([...secondaryCategories, categoryId]);
    }
  };

  const isSelected = (categoryId: string) => {
    return primaryCategory === categoryId || secondaryCategories.includes(categoryId);
  };

  const handleContinue = () => {
    onNext({ primaryCategory, secondaryCategories });
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-muted-foreground">
        Select your primary business category and up to 3 additional categories
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {categories.map((category) => {
          const Icon = category.icon;
          const isPrimary = primaryCategory === category.id;
          const isSecondary = secondaryCategories.includes(category.id);
          
          return (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className={`relative p-4 rounded-lg border-2 transition-all hover:border-primary/50 ${
                isSelected(category.id)
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              }`}
            >
              {isPrimary && (
                <Badge className="absolute -top-2 -right-2 text-xs">
                  Primary
                </Badge>
              )}
              <div className="flex flex-col items-center gap-2 text-center">
                <Icon className="w-8 h-8" />
                <span className="text-sm">{category.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleContinue}
          disabled={!primaryCategory}
          className="w-full h-12 text-base"
        >
          Continuar
        </Button>
        {onBack && (
          <Button
            variant="outline"
            onClick={onBack}
            className="w-full h-12 text-base"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>
        )}
      </div>
    </div>
  );
}
