import MobileLayout from "@/components/mobile/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { BUILD_INFO, getPlatformInfo, getBuildInfoString } from "@/lib/buildInfo";
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
      {/* Build stamp for version verification */}
      <p className="mt-2 text-xs font-mono opacity-60">
        {getBuildInfoString()} | {getPlatformInfo()}
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    const saved = localStorage.getItem("settings-view-mode");
    return (saved as "list" | "grid") || "list";
  });

  useEffect(() => {
    localStorage.setItem("settings-view-mode", viewMode);
  }, [viewMode]);

  const settingSections = [
    {
      title: language === "es" ? "General" : "General",
      items: [
        {
          icon: Building2,
          label: language === "es" ? "Perfil Público" : "Public Profile",
          description: language === "es" ? "Hacer visible tu negocio para clientes" : "Make your business visible to clients",
          path: "/admin/business-profile",
          color: "text-emerald-500"
        },
        {
          icon: Clock,
          label: language === "es" ? "Horarios del Negocio" : "Business Hours",
          description: language === "es" ? "Configurar horarios de apertura y cierre" : "Configure opening and closing hours",
          path: "/admin/business-hours",
          color: "text-blue-500"
        },
        {
          icon: Clock,
          label: language === "es" ? "Cerrar Temporalmente" : "Temporary Close",
          description: language === "es" ? "Cerrar establecimiento por 30min, 1h o hasta mañana" : "Close business for 30min, 1h or until tomorrow",
          path: "/admin/temporary-close",
          color: "text-orange-500"
        },
        {
          icon: Users,
          label: language === "es" ? "Gestión de Personal" : "Staff Management",
          description: language === "es" ? "Horarios, breaks y vacaciones del equipo" : "Team schedules, breaks and vacations",
          path: "/admin/schedules",
          color: "text-green-500"
        },
        {
          icon: Calendar,
          label: language === "es" ? "Configuración de Citas" : "Appointment Settings",
          description: language === "es" ? "Duración de slots, buffer y políticas" : "Slot duration, buffer and policies",
          path: "/admin/appointment-config",
          color: "text-purple-500"
        },
        {
          icon: Type,
          label: language === "es" ? "Texto" : "Text",
          description: language === "es" ? "Tamaño de texto y visibilidad del footer" : "Text size and footer visibility",
          path: "/admin/accessibility-settings",
          color: "text-indigo-500"
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
          color: "text-yellow-500"
        },
        {
          icon: Database,
          label: language === "es" ? "Comisiones del Personal" : "Staff Commissions",
          description: language === "es" ? "Configurar % de comisiones por servicio" : "Configure commission % per service",
          path: "/admin/commissions",
          color: "text-orange-500"
        },
        {
          icon: Package,
          label: language === "es" ? "Inventario" : "Inventory",
          description: language === "es" ? "Gestionar productos y stock" : "Manage products and stock",
          path: "/admin/inventory",
          color: "text-cyan-500"
        },
        {
          icon: BarChart3,
          label: language === "es" ? "Dashboard de Inventario" : "Inventory Dashboard",
          description: language === "es" ? "Gráficos y alertas de stock" : "Charts and stock alerts",
          path: "/admin/inventory/dashboard",
          color: "text-teal-500"
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
          color: "text-pink-500"
        },
        {
          icon: Globe,
          label: language === "es" ? "Idioma y Región" : "Language & Region",
          description: language === "es" ? "Configurar idioma y formato de fechas" : "Configure language and date format",
          path: "/admin/locale-settings",
          color: "text-indigo-500"
        }
      ]
    },
    {
      title: language === "es" ? "Notificaciones" : "Notifications",
      items: [
        {
          icon: Bell,
          label: language === "es" ? "Recordatorios" : "Reminders",
          description: language === "es" ? "Configurar recordatorios automáticos" : "Configure automatic reminders",
          path: "/admin/notification-settings",
          color: "text-red-500"
        },
        {
          icon: MessageSquare,
          label: language === "es" ? "Plantillas SMS" : "SMS Templates",
          description: language === "es" ? "Personalizar mensajes de texto" : "Customize text messages",
          path: "/admin/sms-templates",
          color: "text-blue-500"
        }
      ]
    },
    {
      title: language === "es" ? "Seguridad" : "Security",
      items: [
        {
          icon: Shield,
          label: language === "es" ? "Roles y Permisos" : "Roles & Permissions",
          description: language === "es" ? "Gestionar acceso del equipo" : "Manage team access",
          path: "/admin/roles",
          color: "text-gray-500"
        },
        {
          icon: ShieldOff,
          label: language === "es" ? "Clientes bloqueados" : "Blocked Clients",
          description: language === "es" ? "Administrar clientes bloqueados" : "Manage blocked clients",
          path: "/admin/blocked-clients",
          color: "text-red-500"
        },
        {
          icon: Users,
          label: language === "es" ? "Permisos del Dispositivo" : "Device Permissions",
          description: language === "es" ? "Cámara, ubicación y notificaciones" : "Camera, location and notifications",
          path: "/admin/permissions",
          color: "text-blue-500"
        },
        {
          icon: ShieldOff,
          label: language === "es" ? "Eliminar Cuenta" : "Delete Account",
          description: language === "es" ? "Eliminar permanentemente tu cuenta" : "Permanently delete your account",
          path: "/admin/delete-account",
          color: "text-red-600"
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
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase">
                  {section.title}
                </h2>
                <Card>
                  <CardContent className="p-0">
                    {section.items.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <Button
                          key={item.label}
                          variant="ghost"
                          onClick={() => navigate(item.path)}
                          className={`w-full justify-start h-auto p-4 ${
                            index !== section.items.length - 1 ? 'border-b' : ''
                          }`}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`${item.color}`}>
                              <Icon className="h-6 w-6" />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="font-medium text-base">{item.label}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.description}
                              </p>
                            </div>
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
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase">
                  {section.title}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.label}
                        variant="outline"
                        onClick={() => navigate(item.path)}
                        className="flex flex-col items-center justify-start gap-1.5 h-auto min-h-[110px] p-3 w-full whitespace-normal"
                      >
                        <div className={`${item.color} flex-shrink-0`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="text-center w-full flex flex-col gap-0.5 flex-1 min-w-0 px-1 overflow-visible">
                          <p className="font-medium text-sm leading-tight w-full break-words">
                            {item.label}
                          </p>
                          <p className="text-xs text-muted-foreground leading-tight w-full break-words">
                            {item.description}
                          </p>
                        </div>
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
