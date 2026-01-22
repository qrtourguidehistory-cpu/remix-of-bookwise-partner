import MobileLayout from "@/components/mobile/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { BUILD_INFO } from "@/lib/buildInfo";
import { supabase } from "@/integrations/supabase/client";
import { 
  Clock, 
  Users, 
  Calendar, 
  DollarSign, 
  Shield, 
  ShieldOff,
  Bell,
  Database,
  Palette,
  Globe,
  ArrowLeft,
  Package,
  MessageSquare,
  BarChart3,
  Building2,
  List,
  Grid3x3,
  Type
} from "lucide-react";

// Footer component that respects accessibility settings
function FooterText() {
  const { language } = useLanguage();
  const [showFooter, setShowFooter] = useState(() => {
    return localStorage.getItem("show-footer-text") !== "false";
  });

  useEffect(() => {
    // Listen for accessibility settings changes
    const handleSettingsChange = (event: CustomEvent) => {
      setShowFooter(event.detail.showFooterText);
    };

    window.addEventListener('accessibility-settings-changed', handleSettingsChange as EventListener);
    
    // Also check localStorage periodically (in case changed from another tab)
    const interval = setInterval(() => {
      const saved = localStorage.getItem("show-footer-text") !== "false";
      if (saved !== showFooter) {
        setShowFooter(saved);
      }
    }, 500);

    return () => {
      window.removeEventListener('accessibility-settings-changed', handleSettingsChange as EventListener);
      clearInterval(interval);
    };
  }, [showFooter]);

  if (!showFooter) return null;

  return (
    <div className="mt-8 p-4 border rounded-lg text-center text-sm text-muted-foreground" data-footer-text>
      <p>{language === "es" ? "Versión" : "Version"} {BUILD_INFO.version}</p>
      <p className="mt-1">© 2026 Mí Turnow - {language === "es" ? "Sistema de Gestión de Citas" : "Appointment Management System"}</p>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    const saved = localStorage.getItem("settings-view-mode");
    return (saved as "list" | "grid") || "list";
  });
  const [hasPendingPayment, setHasPendingPayment] = useState(false);

  useEffect(() => {
    localStorage.setItem("settings-view-mode", viewMode);
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

  const settingSections = [
    {
      title: language === "es" ? "General" : "General",
      items: [
        {
          icon: Building2,
          label: language === "es" ? "Perfil Público" : "Public Profile",
          description: language === "es" ? "Hacer visible tu negocio para clientes" : "Make your business visible to clients",
          path: "/admin/business-profile",
          color: "text-black dark:text-white"
        },
        {
          icon: Clock,
          label: language === "es" ? "Horarios del Negocio" : "Business Hours",
          description: language === "es" ? "Configurar horarios de apertura y cierre" : "Configure opening and closing hours",
          path: "/admin/business-hours",
          color: "text-black dark:text-white"
        },
        {
          icon: Clock,
          label: language === "es" ? "Cerrar Temporalmente" : "Temporary Close",
          description: language === "es" ? "Cerrar establecimiento por 30min, 1h o hasta mañana" : "Close business for 30min, 1h or until tomorrow",
          path: "/admin/temporary-close",
          color: "text-black dark:text-white"
        },
        {
          icon: Users,
          label: language === "es" ? "Gestión de Personal" : "Staff Management",
          description: language === "es" ? "Horarios, breaks y vacaciones del equipo" : "Team schedules, breaks and vacations",
          path: "/admin/schedules",
          color: "text-black dark:text-white"
        },
        {
          icon: Calendar,
          label: language === "es" ? "Configuración de Citas" : "Appointment Settings",
          description: language === "es" ? "Duración de slots, buffer y políticas" : "Slot duration, buffer and policies",
          path: "/admin/appointment-config",
          color: "text-black dark:text-white"
        },
        {
          icon: Type,
          label: language === "es" ? "Texto" : "Text",
          description: language === "es" ? "Tamaño de texto y visibilidad del footer" : "Text size and footer visibility",
          path: "/admin/accessibility-settings",
          color: "text-black dark:text-white"
        }
      ]
    },
    {
      title: language === "es" ? "Finanzas" : "Finance",
      items: [
        {
          icon: DollarSign,
          label: language === "es" ? "Métodos de Pago" : "Payment Methods",
          description: language === "es" ? "Configurar formas de pago aceptadas" : "Configure accepted payment methods",
          path: "/admin/payment-methods",
          color: "text-black dark:text-white"
        },
        {
          icon: Database,
          label: language === "es" ? "Comisiones del Personal" : "Staff Commissions",
          description: language === "es" ? "Configurar % de comisiones por servicio" : "Configure commission % per service",
          path: "/admin/commissions",
          color: "text-black dark:text-white"
        },
        {
          icon: Package,
          label: language === "es" ? "Inventario" : "Inventory",
          description: language === "es" ? "Gestionar productos y stock" : "Manage products and stock",
          path: "/admin/inventory",
          color: "text-black dark:text-white"
        },
        {
          icon: BarChart3,
          label: language === "es" ? "Dashboard de Inventario" : "Inventory Dashboard",
          description: language === "es" ? "Gráficos y alertas de stock" : "Charts and stock alerts",
          path: "/admin/inventory/dashboard",
          color: "text-black dark:text-white"
        },
        {
          icon: DollarSign,
          label: language === "es" ? "Suscripción" : "Subscription",
          description: language === "es" ? "Gestiona tu suscripción y método de pago" : "Manage your subscription and payment method",
          path: "/admin/subscription",
          color: "text-black dark:text-white"
        }
      ]
    },
    {
      title: language === "es" ? "Apariencia" : "Appearance",
      items: [
        {
          icon: Palette,
          label: language === "es" ? "Tema y Colores" : "Theme & Colors",
          description: language === "es" ? "Personalizar la apariencia de la app" : "Customize app appearance",
          path: "/admin/theme-settings",
          color: "text-black dark:text-white"
        },
        {
          icon: Globe,
          label: language === "es" ? "Idioma y Región" : "Language & Region",
          description: language === "es" ? "Configurar idioma y formato de fechas" : "Configure language and date format",
          path: "/admin/locale-settings",
          color: "text-black dark:text-white"
        }
      ]
    },
    {
      title: language === "es" ? "Notificaciones" : "Notifications",
      items: [
        {
          icon: Bell,
          label: language === "es" ? "Configurar Notificaciones" : "Notification Settings",
          description: language === "es" ? "Gestiona notificaciones que recibes y envías" : "Manage notifications you receive and send",
          path: "/admin/notification-settings",
          color: "text-black dark:text-white"
        }
      ]
    },
    {
      title: language === "es" ? "Seguridad" : "Security",
      items: [
        {
          icon: Shield,
          label: language === "es" ? "Legal y Ayuda" : "Legal & Help",
          description: language === "es" ? "Políticas, términos y guía de uso" : "Policies, terms and usage guide",
          path: "/admin/roles",
          color: "text-black dark:text-white"
        },
        {
          icon: ShieldOff,
          label: language === "es" ? "Clientes bloqueados" : "Blocked Clients",
          description: language === "es" ? "Administrar clientes bloqueados" : "Manage blocked clients",
          path: "/admin/blocked-clients",
          color: "text-black dark:text-white"
        },
        {
          icon: ShieldOff,
          label: language === "es" ? "Eliminar Cuenta" : "Delete Account",
          description: language === "es" ? "Eliminar permanentemente tu cuenta" : "Permanently delete your account",
          path: "/admin/delete-account",
          color: "text-black dark:text-white"
        }
      ]
    }
  ];

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">
              {language === "es" ? "Configuración" : "Settings"}
            </h1>
          </div>
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

        {viewMode === "list" ? (
          <div className="space-y-6">
            {settingSections.map((section) => (
              <div key={section.title}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase">
                  {section.title}
                </h2>
                <Card className="shadow-md border-0 rounded-xl bg-gradient-to-br from-white to-gray-50/50">
                  <CardContent className="p-0">
                    {section.items.map((item, index) => {
                      const Icon = item.icon;
                      const showIndicator = item.path === "/admin/subscription" && hasPendingPayment;
                      return (
                        <Button
                          key={item.label}
                          variant="ghost"
                          onClick={() => navigate(item.path)}
                          className={`w-full justify-start h-auto p-4 relative rounded-none ${
                            index !== section.items.length - 1 ? 'border-b border-gray-100' : ''
                          } ${index === 0 ? 'rounded-t-xl' : ''} ${index === section.items.length - 1 ? 'rounded-b-xl' : ''}`}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`${item.color} p-2 rounded-lg bg-gray-50 shadow-sm`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="font-semibold text-base">{item.label}</p>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {item.description}
                              </p>
                            </div>
                            {showIndicator && (
                              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            )}
                          </div>
                        </Button>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {settingSections.map((section) => (
              <div key={section.title}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase">
                  {section.title}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const showIndicator = item.path === "/admin/subscription" && hasPendingPayment;
                    return (
                      <Button
                        key={item.label}
                        variant="outline"
                        onClick={() => navigate(item.path)}
                        className="flex flex-col items-center justify-start gap-1.5 h-auto min-h-[110px] p-3 w-full whitespace-normal relative shadow-md border-0 rounded-xl bg-gradient-to-br from-white to-gray-50/50 hover:shadow-lg transition-shadow"
                      >
                        <div className={`${item.color} flex-shrink-0 p-2 rounded-lg bg-gray-50 shadow-sm`}>
                          <Icon className="h-7 w-7 stroke-[1.5]" />
                        </div>
                        <div className="text-center w-full flex flex-col gap-0.5 flex-1 min-w-0 px-1 overflow-visible">
                          <p className="font-semibold text-sm leading-tight w-full break-words">
                            {item.label}
                          </p>
                        </div>
                        {showIndicator && (
                          <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <FooterText />
      </div>
    </MobileLayout>
  );
}
