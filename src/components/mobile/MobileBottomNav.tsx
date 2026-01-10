import { useState, useEffect } from "react";
import { CalendarDays, Tag, Plus, Smile, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AddActionSheet } from "./AddActionSheet";
import { ClientActionSheet } from "./ClientActionSheet";
import { SettingsSheet } from "./SettingsSheet";
import { TutorialTip } from "./TutorialTip";
import { useTutorialTips } from "@/hooks/useTutorialTips";
import { useLanguage } from "@/contexts/LanguageContext";

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { canShowTip, markTipAsSeen, setActiveTip } = useTutorialTips();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [clientSheetOpen, setClientSheetOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [showAddTip, setShowAddTip] = useState(false);
  const [showClientsTip, setShowClientsTip] = useState(false);
  const [addButtonPressed, setAddButtonPressed] = useState(false);
  const [clientsButtonPressed, setClientsButtonPressed] = useState(false);
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

  // Show add tip when button is pressed for first time
  const handleAddButtonClick = () => {
    if (canShowTip("add_button_tip") && !addButtonPressed) {
      setAddButtonPressed(true);
      setShowAddTip(true);
      setActiveTip("add_button_tip");
    }
    setAddSheetOpen(true);
  };

  // Show clients tip when button is pressed for first time
  const handleClientsButtonClick = () => {
    if (canShowTip("clients_button_tip") && !clientsButtonPressed) {
      setClientsButtonPressed(true);
      setShowClientsTip(true);
      setActiveTip("clients_button_tip");
    }
    setClientSheetOpen(true);
  };

  const navItems = [
    { icon: CalendarDays, label: t("calendar"), path: "/", onClick: () => navigate("/") },
    { icon: Tag, label: t("sales"), path: "/admin/sales", onClick: () => navigate("/admin/sales") },
    { icon: Plus, label: t("add"), isSpecial: true, onClick: handleAddButtonClick },
    { icon: Smile, label: t("clients"), onClick: handleClientsButtonClick },
    { icon: LayoutGrid, label: t("menu"), onClick: () => setSettingsSheetOpen(true) },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 shadow-lg pb-safe">
        <div className="flex items-center justify-around px-1 py-2 max-w-2xl mx-auto">
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
                      ? "gap-0 h-10 w-10 -mt-6" 
                      : "gap-0.5 h-auto py-1 px-2"
                    : "gap-0 h-10 w-10"
                )}
                title={!showFooterText ? item.label : undefined}
              >
                <Icon className={cn(
                  "transition-all duration-200 flex-shrink-0 !pointer-events-none",
                  showFooterText ? "!h-5 !w-5" : "!h-6 !w-6"
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

      {/* Tutorial tip for add button */}
      <TutorialTip
        isVisible={showAddTip}
        title="Botón de Agregar"
        message="Usa este botón para agregar citas, ventas, servicios y más."
        onDismiss={() => {
          setShowAddTip(false);
          markTipAsSeen("add_button_tip");
        }}
        position="bottom"
        delay={300}
      />

      {/* Tutorial tip for clients button */}
      <TutorialTip
        isVisible={showClientsTip}
        title="Gestión de Clientes"
        message="Administra tus clientes, ve su historial y añade nuevos desde aquí."
        onDismiss={() => {
          setShowClientsTip(false);
          markTipAsSeen("clients_button_tip");
        }}
        position="bottom"
        delay={300}
      />
    </>
  );
}