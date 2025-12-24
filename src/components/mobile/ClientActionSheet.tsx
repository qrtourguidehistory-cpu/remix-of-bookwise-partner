import { UserPlus, UserX, UserCog, List } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ClientActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientActionSheet({ open, onOpenChange }: ClientActionSheetProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const actions = [
    { icon: UserPlus, label: language === "es" ? "Nuevo Cliente" : "New Client", path: "/admin/clients/new", color: "text-green-500" },
    { icon: List, label: language === "es" ? "Lista de Clientes" : "Client List", path: "/admin/clients", color: "text-purple-500" },
  ];

  const handleAction = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-t border-border">
        <SheetHeader>
          <SheetTitle>{language === "es" ? "Clientes" : "Clients"}</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-4 mt-6">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.label}
                variant="ghost"
                onClick={() => handleAction(action.path)}
                className="flex flex-col items-center gap-2 h-auto py-6"
              >
                <div className={cn("p-3 rounded-full bg-muted", action.color)}>
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-sm text-center">{action.label}</span>
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
