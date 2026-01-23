import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, Lock, LogOut, User, Sparkles, Calendar, Star, MapPin, X, ArrowLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import ProfilePage from "@/pages/mobile/ProfilePage";

export default function Paywall() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { language } = useLanguage();
  const { subscription } = useSubscriptionStatus();
  const [processing, setProcessing] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const handleActivateSubscription = async () => {
    console.log('[Paywall] 🚀 handleActivateSubscription llamado');
    setProcessing(true);
    try {
      console.log('[Paywall] 📍 Navegando a /admin/subscription...');
      // Navegar a la página de suscripción que manejará la activación
      // Usar replace para evitar que el usuario pueda volver al paywall
      navigate("/admin/subscription", { replace: true });
      console.log('[Paywall] ✅ Navegación completada');
    } catch (error: any) {
      console.error('[Paywall] ❌ Error activando suscripción:', {
        error,
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
      // Mostrar error al usuario
      alert(
        language === "es" 
          ? "Error al abrir la página de suscripción. Por favor, intenta de nuevo." 
          : "Error opening subscription page. Please try again."
      );
    } finally {
      // No resetear processing inmediatamente para dar tiempo a la navegación
      setTimeout(() => {
        setProcessing(false);
      }, 500);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const benefits = [
    {
      text: language === "es" ? "Manejo de Agenda ilimitada" : "Unlimited calendar management",
      icon: <Calendar className="h-6 w-6" />,
    },
    {
      text: language === "es" ? "Soporte Prioritario" : "Priority Support",
      icon: <Star className="h-6 w-6" />,
    },
    {
      text: language === "es" ? "Publicación de establecimiento" : "Business publication",
      icon: <MapPin className="h-6 w-6" />,
    },
  ];

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return "U";
  };

  // Bloquear el footer cuando se muestra el perfil
  useEffect(() => {
    if (showProfile) {
      // Bloquear todos los botones del footer
      const blockFooter = () => {
        const footer = document.querySelector('nav[class*="fixed"]');
        if (footer) {
          const buttons = footer.querySelectorAll('button');
          buttons.forEach((btn) => {
            (btn as HTMLButtonElement).style.pointerEvents = 'none';
            (btn as HTMLButtonElement).style.opacity = '0.5';
          });
        }
      };
      
      // Bloquear inmediatamente y después de un pequeño delay para asegurar que el DOM esté listo
      blockFooter();
      const timer = setTimeout(blockFooter, 100);
      
      return () => {
        clearTimeout(timer);
        // Restaurar al cerrar
        const footer = document.querySelector('nav[class*="fixed"]');
        if (footer) {
          const buttons = footer.querySelectorAll('button');
          buttons.forEach((btn) => {
            (btn as HTMLButtonElement).style.pointerEvents = '';
            (btn as HTMLButtonElement).style.opacity = '';
          });
        }
      };
    }
  }, [showProfile]);

  // Si se muestra el perfil, renderizar ProfilePage bloqueado
  if (showProfile) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        {/* Botón de volver */}
        <div className="absolute top-6 left-6 z-[100]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowProfile(false)}
            className="rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        
        {/* ProfilePage completo */}
        <div className="h-full overflow-auto pb-24">
          <ProfilePage />
        </div>
        
        {/* Overlay que bloquea completamente el footer */}
        <div 
          className="fixed bottom-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur-sm border-t border-border"
          style={{ 
            height: 'calc(var(--bottom-nav-height, 76px) + max(24px, var(--app-safe-bottom, 0px)))',
            pointerEvents: 'auto'
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }}
        >
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground px-4">
            {language === "es" ? "Activa tu suscripción para navegar" : "Activate your subscription to navigate"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 min-h-screen">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_70%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6 py-8 text-center">
        {/* Header - Profile Button */}
        <div className="absolute top-6 right-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowProfile(true)}
            className="rounded-full bg-white/10 hover:bg-white/20 border border-white/20"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src="/ChatGPT Image 19 ene 2026, 11_56_27 a.m..png" 
            alt="Mi Turnow Logo" 
            className="h-24 w-24 object-contain"
          />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">
          {language === "es"
            ? "Desbloquea Mi Turnow Premium para continuar"
            : "Unlock Mi Turnow Premium to continue"}
        </h1>

        {/* Benefits List */}
        <div className="space-y-3 mb-8">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="flex items-center justify-center gap-3 text-white/90"
            >
              <div className="text-white">{benefit.icon}</div>
              <span className="text-lg font-medium">{benefit.text}</span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <Button
          onClick={handleActivateSubscription}
          disabled={processing}
          className="w-full h-14 rounded-xl bg-black text-white text-lg font-semibold shadow-2xl hover:bg-gray-900 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          size="lg"
        >
          {processing ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {language === "es" ? "Procesando..." : "Processing..."}
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5 mr-2" />
              {language === "es" ? "Activar Suscripción" : "Activate Subscription"}
            </>
          )}
        </Button>

        {/* Subtle Footer Text */}
        <p className="mt-6 text-sm text-white/60">
          {language === "es"
            ? "Accede a todas las características premium con un solo clic"
            : "Access all premium features with one click"}
        </p>
      </div>
    </div>
  );
}

