import { Home, Users, Calendar, Image, UsersRound, BarChart3, Settings, User, List, Grid3x3, Briefcase, Star } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    const saved = localStorage.getItem("menu-view-mode");
    return (saved as "list" | "grid") || "list";
  });
  const [hasPendingPayment, setHasPendingPayment] = useState(false);

  useEffect(() => {
    localStorage.setItem("menu-view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (profile?.business_id) {
      checkPendingPayment();
    }
  }, [profile?.business_id]);

  const checkPendingPayment = async () => {
    if (!profile?.business_id) return;
    
    try {
      const { data, error } = await supabase
        .from("business_subscriptions")
        .select("status, payment_due_date")
        .eq("business_id", profile.business_id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Error checking subscription:", error);
        return;
      }

      if (data) {
        const isPastDue = data.status === 'past_due' || data.status === 'suspended';
        const isTrialingExpired = data.status === 'trialing' && 
          data.payment_due_date && 
          new Date(data.payment_due_date) < new Date();
        
        setHasPendingPayment(isPastDue || isTrialingExpired);
      }
    } catch (error) {
      console.error("Error checking pending payment:", error);
    }
  };

  const menuItems = [
    { icon: Home, label: t("home"), path: "/admin" },
    { icon: Users, label: t("clients"), path: "/admin/clients" },
    { icon: Calendar, label: t("appointments"), path: "/admin/appointments" },
    { icon: Image, label: t("gallery"), path: "/admin/gallery" },
    { icon: Briefcase, label: language === "es" ? "Servicios" : "Services", path: "/admin/services" },
    { icon: Star, label: language === "es" ? "Reseñas" : "Reviews", path: "/admin/reviews" },
    { icon: UsersRound, label: t("team"), path: "/admin/staff" },
    { icon: BarChart3, label: t("reports"), path: "/admin/reports" },
    { icon: User, label: t("profile"), path: "/admin/profile" },
    { icon: Settings, label: t("settings"), path: "/admin/settings" },
  ];

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-t border-border h-[80vh]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>{t("menu")}</SheetTitle>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("list")}
                className={cn(
                  "h-7 px-2",
                  viewMode === "list" && "bg-background"
                )}
                title={language === "es" ? "Vista de lista" : "List view"}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "h-7 px-2",
                  viewMode === "grid" && "bg-background"
                )}
                title={language === "es" ? "Vista de cuadrícula" : "Grid view"}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>
        {viewMode === "list" ? (
          <div className="flex flex-col gap-2 mt-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const showIndicator = item.path === "/admin/settings" && hasPendingPayment;
              return (
                <Button
                  key={item.label}
                  variant="ghost"
                  onClick={() => handleNavigate(item.path)}
                  className="justify-start gap-3 h-12 relative"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span>{item.label}</span>
                  {showIndicator && (
                    <div className="ml-auto w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const showIndicator = item.path === "/admin/settings" && hasPendingPayment;
              return (
                <Button
                  key={item.label}
                  variant="outline"
                  onClick={() => handleNavigate(item.path)}
                  className="flex flex-col items-center justify-center gap-1.5 h-auto min-h-[90px] p-3 relative shadow-md border-0 rounded-xl bg-gradient-to-br from-white to-gray-50/50 hover:shadow-lg transition-shadow"
                >
                  <div className="p-2 rounded-lg bg-gray-50 shadow-sm">
                    <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                  </div>
                  <span className="text-xs font-semibold leading-tight line-clamp-2 text-center px-1">
                    {item.label}
                  </span>
                  {showIndicator && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </Button>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
