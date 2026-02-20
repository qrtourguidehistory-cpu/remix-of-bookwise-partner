import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { purchaseProduct, verifyPremiumEntitlement, identifyUser, forceUnlockPremium, PREMIUM_ENTITLEMENT_ID } from "@/lib/revenueCatService";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, Lock, LogOut, User, Sparkles, Calendar, Star, MapPin, X, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
  const { profile, signOut, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const { refetchSubscription } = useSubscriptionStatus();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // ✅ Verificar y desbloquear tras una compra confirmada por Google Play
  const verifyAndUnlock = async (userId: string, isRetry = false) => {
    console.log(`[Paywall] 🔍 Verificando entitlement${isRetry ? ' (retry)' : ''}...`);
    
    try {
      const hasProAccess = await verifyPremiumEntitlement(userId);
      
      if (hasProAccess) {
        // ✅ RevenueCat confirmó el entitlement — desbloquear
        console.log('[Paywall] ✅ Entitlement confirmado por RevenueCat. Desbloqueando...');
        toast({
          title: language === "es" ? "¡Suscripción activada!" : "Subscription activated!",
          description: language === "es"
            ? "Tu suscripción premium ha sido activada correctamente."
            : "Your premium subscription has been activated successfully.",
        });
        await refreshProfile();        // ← perfil en memoria actualizado
        await refetchSubscription(true); // ← SubscriptionGuard desbloquea
        
        // ✅ REDIRECCIÓN AUTOMÁTICA: Forzar navegación a la ruta principal
        console.log('[Paywall] 🚀 Redirigiendo a la app principal...');
        setTimeout(() => {
          navigate("/admin", { replace: true });
        }, 500); // Pequeño delay para que el toast se muestre
        
        return true;
      }

      // ✅ UNLOCK OPTIMISTA: Google Play confirmó el pago pero el entitlement
      // aún no llegó al SDK (race condition de ~1-3s). La compra ES real.
      // Escribir is_premium=true directamente para desbloquear YA, sin esperar al webhook.
      if (!isRetry) {
        console.log('[Paywall] ⏳ Entitlement pendiente — esperando 2s y reintentando...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return verifyAndUnlock(userId, true);
      }

      // Después del retry, entitlement aún no activo → unlock optimista
      console.warn(`[Paywall] ⚠️ Entitlement '${PREMIUM_ENTITLEMENT_ID}' no activo tras retry. Aplicando unlock optimista...`);
      await forceUnlockPremium(userId); // ← escribe is_premium=true en Supabase
      
      // ✅ POLLING AGRESIVO: Verificar cada 500ms durante 3 segundos (6 intentos)
      // Esto asegura que la UI se actualice inmediatamente cuando el trigger sincronice businesses
      console.log('[Paywall] 🔄 Iniciando polling agresivo (500ms x 6 = 3s)...');
      let unlocked = false;
      
      for (let i = 0; i < 6; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verificar directamente en Supabase si is_premium ya está en true
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_premium')
          .eq('id', userId)
          .maybeSingle();
        
        if (profileData?.is_premium === true) {
          console.log(`[Paywall] ✅ is_premium confirmado en Supabase (intento ${i + 1}/6)`);
          unlocked = true;
          break;
        }
        
        console.log(`[Paywall] ⏳ Polling ${i + 1}/6: is_premium aún no confirmado...`);
      }
      
      if (unlocked) {
        toast({
          title: language === "es" ? "¡Suscripción activada!" : "Subscription activated!",
          description: language === "es"
            ? "Tu suscripción premium ha sido activada correctamente."
            : "Your premium subscription has been activated successfully.",
        });
      } else {
        toast({
          title: language === "es" ? "¡Compra confirmada!" : "Purchase confirmed!",
          description: language === "es"
            ? "Tu pago fue procesado. Activando acceso premium..."
            : "Your payment was processed. Activating premium access...",
        });
      }
      
      // Refrescar estado global independientemente del resultado del polling
      await refreshProfile();        // ← perfil en memoria actualizado
      await refetchSubscription(true); // ← SubscriptionGuard desbloquea
      
      // ✅ REDIRECCIÓN AUTOMÁTICA: Forzar navegación a la ruta principal
      console.log('[Paywall] 🚀 Redirigiendo a la app principal...');
      setTimeout(() => {
        navigate("/admin", { replace: true });
      }, 300); // Delay reducido porque el polling ya esperó
      
      return true; // ← siempre desbloquear tras pago confirmado
    } catch (err: any) {
      console.error('[Paywall] ❌ Error en verifyAndUnlock:', err);
      // Si hay error, aplicar unlock optimista de todas formas (pago ya fue confirmado)
      try {
        await forceUnlockPremium(userId);
        await refreshProfile();
        await refetchSubscription(true);
        // Redirigir incluso si hay error (pago ya fue confirmado)
        setTimeout(() => {
          navigate("/admin", { replace: true });
        }, 500);
      } catch (_) {}
      return false;
    }
  };

  const handleActivateSubscription = async () => {
    console.log('[Paywall] 🚀 handleActivateSubscription llamado');
    
    // Verificar si estamos en Android (RevenueCat solo funciona en Android)
    if (Capacitor.getPlatform() !== "android") {
      navigate("/admin/subscription", { replace: true });
      return;
    }

    if (!profile?.id) {
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" 
          ? "No se pudo obtener la información del usuario" 
          : "Could not get user information",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    
    try {
      console.log('[Paywall] 💳 Iniciando compra con RevenueCat...');
      
      // ✅ PASO 1: Identificar al usuario en RevenueCat antes de comprar
      console.log('[Paywall] 🔐 Identificando usuario en RevenueCat antes de comprar...');
      try {
        await identifyUser(profile.id);
        console.log('[Paywall] ✅ Usuario identificado correctamente');
      } catch (identifyError: any) {
        console.error('[Paywall] ⚠️ Error identificando usuario, continuando con compra:', identifyError);
      }
      
      // ✅ PASO 2: Realizar la compra
      const result = await purchaseProduct();
      
      if (result.success) {
        // ✅ PASO 3: Verificar y desbloquear inmediatamente
        // ⚠️ Dar un breve margen para que el modal de Google Play se cierre completamente
        // Esto evita el overlay oscuro en pantalla
        await new Promise(resolve => setTimeout(resolve, 800));
        setProcessing(false); // Quitar spinner ANTES del toast para evitar overlay
        
        await verifyAndUnlock(profile.id);
        return; // setProcessing ya fue llamado
        
      } else {
        // Si el usuario canceló, no mostrar error (sin overlay)
        if (result.error?.includes("cancelada") || result.error?.includes("cancelled")) {
          console.log('[Paywall] ℹ️ Usuario canceló la compra');
          return;
        }
        
        // Mostrar error
        toast({
          title: language === "es" ? "Error en la compra" : "Purchase error",
          description: result.error || (language === "es" 
            ? "No se pudo completar la compra. Por favor, intenta de nuevo." 
            : "Could not complete purchase. Please try again."),
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('[Paywall] ❌ Error activando suscripción:', error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: error?.message || (language === "es" 
          ? "Ocurrió un error al procesar la compra. Por favor, intenta de nuevo." 
          : "An error occurred processing the purchase. Please try again."),
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
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
        <p className="mt-4 text-sm text-white/60">
          {language === "es"
            ? "Accede a todas las características premium con un solo clic"
            : "Access all premium features with one click"}
        </p>

      </div>
    </div>
  );
}

