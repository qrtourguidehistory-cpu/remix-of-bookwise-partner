import { useState, useEffect } from "react";
import { Calendar, DollarSign, Plus, Users, Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AddActionSheet } from "./AddActionSheet";
import { ClientActionSheet } from "./ClientActionSheet";
import { SettingsSheet } from "./SettingsSheet";
import { useLanguage } from "@/contexts/LanguageContext";

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [clientSheetOpen, setClientSheetOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [showFooterText, setShowFooterText] = useState(() => {
    return localStorage.getItem("show-footer-text") !== "false";
  });

  useEffect(() => {
    // Listen for accessibility settings changes
    const handleSettingsChange = (event: CustomEvent) => {
      setShowFooterText(event.detail.showFooterText);
    };

    window.addEventListener('accessibility-settings-changed', handleSettingsChange as EventListener);
    
    // Also check localStorage periodically (in case changed from another tab)
    const interval = setInterval(() => {
      const saved = localStorage.getItem("show-footer-text") !== "false";
      if (saved !== showFooterText) {
        setShowFooterText(saved);
      }
    }, 500);

    return () => {
      window.removeEventListener('accessibility-settings-changed', handleSettingsChange as EventListener);
      clearInterval(interval);
    };
  }, [showFooterText]);

  const navItems = [
    { icon: Calendar, label: t("calendar"), path: "/", onClick: () => navigate("/") },
    { icon: DollarSign, label: t("sales"), path: "/admin/sales", onClick: () => navigate("/admin/sales") },
    { icon: Plus, label: t("add"), isSpecial: true, onClick: () => setAddSheetOpen(true) },
    { icon: Users, label: t("clients"), onClick: () => setClientSheetOpen(true) },
    { icon: Grid3x3, label: t("menu"), onClick: () => setSettingsSheetOpen(true) },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border pb-safe z-50 shadow-lg">
        <div className="flex items-center justify-around px-2 py-2 max-w-2xl mx-auto">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = item.path && location.pathname === item.path;
            
            return (
              <Button
                key={index}
                variant={item.isSpecial ? "default" : "ghost"}
                onClick={item.onClick}
                className={cn(
                  "flex flex-col items-center justify-center transition-all duration-200",
                  item.isSpecial 
                    ? "rounded-full bg-primary hover:bg-primary/90 shadow-lg aspect-square" 
                    : isActive 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground",
                  showFooterText 
                    ? item.isSpecial 
                      ? "gap-0 h-12 w-12 -mt-8" 
                      : "gap-1 h-auto py-2 px-3"
                    : "gap-0 h-12 w-12"
                )}
                title={!showFooterText ? item.label : undefined}
              >
                <Icon className={cn(
                  "transition-all duration-200 flex-shrink-0 !pointer-events-none",
                  showFooterText ? "!h-6 !w-6" : "!h-8 !w-8"
                )} />
                {showFooterText && !item.isSpecial && (
                  <span className="text-xs font-medium">{item.label}</span>
                )}
              </Button>
            );
          })}
        </div>
      </nav>

      <AddActionSheet open={addSheetOpen} onOpenChange={setAddSheetOpen} />
      <ClientActionSheet open={clientSheetOpen} onOpenChange={setClientSheetOpen} />
      <SettingsSheet open={settingsSheetOpen} onOpenChange={setSettingsSheetOpen} />
    </>
  );
}
