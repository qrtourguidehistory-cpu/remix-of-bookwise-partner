import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { savePendingSubscription, clearPendingSubscription } from "@/lib/subscriptionPersistence";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { purchaseProduct, verifyPremiumEntitlement, identifyUser } from "@/lib/revenueCatService";
import { 
  CreditCard,
  Calendar, 
  DollarSign, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Shield,
  Settings,
  RefreshCw,
  Info,
  Check,
  X,
  ShoppingBag
} from "lucide-react";

interface BusinessSubscription {
  id: string;
  business_id: string;
  owner_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'inactive' | 'grace_period';
  subscription_plan: string;
  monthly_fee: number;
  payment_method: string | null;
  stripe_subscription_id: string | null;
  paypal_subscription_id: string | null;
  last_payment_date: string | null;
  next_payment_date: string | null;
  payment_due_date: string | null;
  amount_paid: number;
  amount_due: number;
  days_overdue: number;
  payment_history: any;
  created_at: string;
  updated_at: string;
}

const statusConfig = {
  trialing: {
    label: 'En Prueba',
    labelEn: 'Trialing',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Clock
  },
  active: {
    label: 'Activa',
    labelEn: 'Active',
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: CheckCircle2
  },
  past_due: {
    label: 'Vencida',
    labelEn: 'Past Due',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    icon: AlertCircle
  },
  suspended: {
    label: 'Suspendida',
    labelEn: 'Suspended',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: XCircle
  },
  cancelled: {
    label: 'Cancelada',
    labelEn: 'Cancelled',
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    icon: XCircle
  },
  inactive: {
    label: 'Inactiva',
    labelEn: 'Inactive',
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    icon: XCircle
  }
};

// Componente eliminado - ahora usamos usePayPalSubscription hook

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { subscription: realtimeSubscription } = useSubscriptionStatus(); // Para garantizar realtime
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<BusinessSubscription | null>(null);
  const [processingPortal, setProcessingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaymentInProgress, setIsPaymentInProgress] = useState(false); // Flag para deshabilitar useEffect durante pago
  const [showSuccessBanner, setShowSuccessBanner] = useState(false); // Banner de éxito cuando se activa suscripción
  const [previousSubscriptionStatus, setPreviousSubscriptionStatus] = useState<string | null>(null); // Para detectar cambio de estado

  // Log cuando el componente se monta
  useEffect(() => {
    console.log('[SubscriptionPage] 🚀 Componente montado', {
      hasProfile: !!profile,
      business_id: profile?.business_id,
    });
    
    // Manejo de errores global para evitar pantalla en blanco
    const handleError = (event: ErrorEvent) => {
      console.error('[SubscriptionPage] ❌ Error global capturado:', event.error);
      setError(event.error?.message || 'Error inesperado');
      setLoading(false);
    };
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[SubscriptionPage] ❌ Promise rechazada:', event.reason);
      setError(event.reason?.message || 'Error inesperado');
      setLoading(false);
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Función fetchSubscription memoizada para evitar dependencias circulares
  const fetchSubscription = useCallback(async () => {
    if (!profile?.business_id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("business_subscriptions" as any)
        .select("*")
        .eq("business_id", profile.business_id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("[SubscriptionPage] ❌ Error fetching subscription:", {
          error,
          code: error.code,
          message: error.message,
        });
        throw error;
      }

      console.log('[SubscriptionPage] ✅ Subscription data:', {
        hasData: !!data,
        status: (data as any)?.status,
        id: (data as any)?.id,
      });
      
      // CRÍTICO: Detectar cambio de estado a 'active' para mostrar banner
      // SOLO mostrar banner si realmente cambió de estado inactivo a activo
      // NO mostrar si el usuario canceló el proceso de compra
      const newStatus = (data as any)?.status;
      const wasInactive = previousSubscriptionStatus && 
                         (previousSubscriptionStatus !== 'active' && previousSubscriptionStatus !== 'trialing');
      const isNowActive = newStatus === 'active' || newStatus === 'trialing';
      
      // CRÍTICO: Solo mostrar banner si:
      // 1. Había un estado previo (no es la primera carga)
      // 2. El estado previo era inactivo
      // 3. El nuevo estado es activo
      // 4. NO hay un pago en progreso (para evitar mostrar banner si el usuario canceló)
      if (wasInactive && isNowActive && data && !isPaymentInProgress) {
        console.log('[SubscriptionPage] 🎉 Suscripción activada, mostrando banner de éxito');
        setShowSuccessBanner(true);
        // Ocultar banner después de 10 segundos
        setTimeout(() => {
          setShowSuccessBanner(false);
        }, 10000);
        
        // Mostrar toast de éxito
        toast({
          title: language === "es" ? "¡Suscripción Activada!" : "Subscription Activated!",
          description: language === "es"
            ? "Tu suscripción Premium está ahora activa. Disfruta de todas las características."
            : "Your Premium subscription is now active. Enjoy all features.",
          variant: "default",
        });
      }
      
      // Actualizar estado previo
      setPreviousSubscriptionStatus(newStatus || null);
      
      // Cast seguro: primero a unknown, luego al tipo esperado
      setSubscription((data as unknown) as BusinessSubscription | null);
      setError(null); // Limpiar error si la carga fue exitosa
    } catch (error: any) {
      console.error("[SubscriptionPage] ❌ Exception en fetchSubscription:", {
        error,
        message: error?.message,
        stack: error?.stack,
      });
      setError(error?.message || 'Error al cargar suscripción');
      toast({
        title: language === "es" ? "Error" : "Error",
        description: error?.message || (language === "es"
          ? "Error al cargar información de suscripción"
          : "Error loading subscription information"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.business_id, language, toast]);

  // CRÍTICO: Ref para rastrear isPaymentInProgress sin depender de closures
  // Debe estar fuera del useEffect para persistir entre renders
  const paymentInProgressRef = useRef(false);
  
  useEffect(() => {
    paymentInProgressRef.current = isPaymentInProgress;
  }, [isPaymentInProgress]);

  // CRÍTICO: Timeout de seguridad adicional en el componente
  // Si isPaymentInProgress está activo por más de 6 minutos, resetearlo
  useEffect(() => {
    if (!isPaymentInProgress) return;

    const timeout = setTimeout(() => {
      console.log('[SubscriptionPage] ⏰ Timeout de seguridad: isPaymentInProgress activo por más de 6 minutos, reseteando');
      setIsPaymentInProgress(false);
      paymentInProgressRef.current = false;
      fetchSubscription();
    }, 6 * 60 * 1000); // 6 minutos

    return () => clearTimeout(timeout);
  }, [isPaymentInProgress, fetchSubscription]);

  // CRÍTICO: Manejo centralizado de isPaymentInProgress
  // Combina: listener de deep link, appStateChange, timeout y polling
  // Esto resuelve el bug del "procesando infinito" de forma robusta
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Handlers para eventos de deep links
    const handleDeepLinkReceived = () => {
      console.log('[SubscriptionPage] 🔗 Deep link recibido, reseteando estado de pago');
      setIsPaymentInProgress(false);
      paymentInProgressRef.current = false;
    };

    const handleSubscriptionSuccess = () => {
      console.log('[SubscriptionPage] ✅ Suscripción exitosa, reseteando estado');
      setIsPaymentInProgress(false);
      paymentInProgressRef.current = false;
      // CRÍTICO: NO usar window.location.reload() - solo refrescar datos
      // Refrescar la suscripción inmediatamente y después de un delay para asegurar sincronización
      fetchSubscription();
      setTimeout(() => {
        fetchSubscription();
      }, 1500);
      setTimeout(() => {
        fetchSubscription(); // Tercera verificación para asegurar que los datos estén sincronizados
      }, 3000);
    };

    const handleSubscriptionCancel = () => {
      console.log('[SubscriptionPage] ❌ Suscripción cancelada, reseteando estado');
      setIsPaymentInProgress(false);
      paymentInProgressRef.current = false;
    };

    const handleSubscriptionError = () => {
      console.log('[SubscriptionPage] ❌ Error en suscripción, reseteando estado');
      setIsPaymentInProgress(false);
      paymentInProgressRef.current = false;
    };

    // CRÍTICO: Manejar timeout y app regresando sin deep link
    const handleTimeout = () => {
      console.log('[SubscriptionPage] ⏰ Timeout: Compra no completada, reseteando estado');
      setIsPaymentInProgress(false);
      paymentInProgressRef.current = false;
      // Verificar si la suscripción se activó de todas formas (polling)
      fetchSubscription();
      setTimeout(() => {
        fetchSubscription();
      }, 2000);
      setTimeout(() => {
        fetchSubscription(); // Tercera verificación
      }, 4000);
    };

    const handleAppReturned = () => {
      console.log('[SubscriptionPage] 🔄 App regresó, reseteando estado');
      setIsPaymentInProgress(false);
      paymentInProgressRef.current = false;
      // Verificar si la suscripción se activó de todas formas (polling)
      fetchSubscription();
      setTimeout(() => {
        fetchSubscription();
      }, 2000);
      setTimeout(() => {
        fetchSubscription(); // Tercera verificación
      }, 4000);
    };

    // Listener para detectar cuando la app vuelve al foreground
    let appStateListener: any = null;
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && paymentInProgressRef.current) {
        // La app volvió al foreground y hay un pago en progreso
        // Esperar un momento para ver si llega el deep link
        console.log('[SubscriptionPage] 🔄 App activa, esperando deep link...');
        setTimeout(() => {
          // Si después de 3 segundos aún está en progreso, resetear
          if (paymentInProgressRef.current) {
            console.log('[SubscriptionPage] ⚠️ No se detectó deep link después de 3 segundos, reseteando');
            setIsPaymentInProgress(false);
            paymentInProgressRef.current = false;
            // Verificar estado de suscripción inmediatamente
            fetchSubscription();
            // Refrescar después de un delay para actualizar UI
            // CRÍTICO: NO usar window.location.reload() - solo refrescar datos
            setTimeout(() => {
              fetchSubscription();
            }, 2000);
            setTimeout(() => {
              fetchSubscription(); // Tercera verificación
            }, 4000);
          }
        }, 3000);
      }
    }).then(listener => {
      appStateListener = listener;
    });

    // Registrar listeners para eventos personalizados (mantenidos por compatibilidad)
    // Estos listeners pueden ser útiles si hay usuarios con suscripciones antiguas
    window.addEventListener('paypal-deep-link-received', handleDeepLinkReceived);
    window.addEventListener('paypal-subscription-success', handleSubscriptionSuccess);
    window.addEventListener('paypal-subscription-cancel', handleSubscriptionCancel);
    window.addEventListener('paypal-subscription-error', handleSubscriptionError);
    window.addEventListener('paypal-timeout', handleTimeout);
    window.addEventListener('paypal-app-returned', handleAppReturned);

    return () => {
      // Limpiar listeners al desmontar
      window.removeEventListener('paypal-deep-link-received', handleDeepLinkReceived);
      window.removeEventListener('paypal-subscription-success', handleSubscriptionSuccess);
      window.removeEventListener('paypal-subscription-cancel', handleSubscriptionCancel);
      window.removeEventListener('paypal-subscription-error', handleSubscriptionError);
      window.removeEventListener('paypal-timeout', handleTimeout);
      window.removeEventListener('paypal-app-returned', handleAppReturned);
      if (appStateListener) {
        appStateListener.remove();
      }
    };
  }, [fetchSubscription]);

  const paymentStatus = searchParams.get('status');

  useEffect(() => {
    if (profile?.business_id) {
      fetchSubscription();
    }
  }, [profile?.business_id, fetchSubscription]);

  // Escuchar cambios de estado de suscripción y refrescar automáticamente
  // DESHABILITADO durante el proceso de pago para evitar re-renderizado
  useEffect(() => {
    if (!profile?.business_id || isPaymentInProgress) return; // NO ejecutar si hay pago en progreso

    console.log('[SubscriptionPage] 📡 Configurando realtime subscription');

    try {
      const channel = supabase
        .channel(`subscription-page-${profile.business_id}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'business_subscriptions',
            filter: `business_id=eq.${profile.business_id}`,
          },
          async (payload) => {
            // NO procesar si hay pago en progreso
            if (isPaymentInProgress) {
              console.log('[SubscriptionPage] ⏸️ Realtime update ignorado - pago en progreso');
              return;
            }
            console.log('[SubscriptionPage] 🔔 Realtime update:', payload.eventType);
            try {
              await fetchSubscription();
              // Si la suscripción se activó, limpiar estado pendiente
              if (payload.new && ((payload.new as any).status === 'active' || (payload.new as any).status === 'trialing')) {
                await clearPendingSubscription();
              }
            } catch (err) {
              console.error('[SubscriptionPage] ❌ Error en realtime callback:', err);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err: any) {
      console.error('[SubscriptionPage] ❌ Error configurando realtime:', err);
    }
  }, [profile?.business_id, fetchSubscription, isPaymentInProgress]);

  // Escuchar cuando la app vuelve al foreground (solo mobile)
  // DESHABILITADO durante el proceso de pago
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !profile?.business_id || isPaymentInProgress) return;

    const appStateListener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && !isPaymentInProgress) {
        // Refrescar cuando la app vuelve al foreground (solo si no hay pago en progreso)
        fetchSubscription();
      }
    });

    return () => {
      appStateListener.then(listener => listener.remove());
    };
  }, [profile?.business_id, fetchSubscription, isPaymentInProgress]);

  // También refrescar cuando la ventana vuelve a tener foco (web)
  // DESHABILITADO durante el proceso de pago
  useEffect(() => {
    if (Capacitor.isNativePlatform() || !profile?.business_id || isPaymentInProgress) return;

    const handleFocus = () => {
      if (!isPaymentInProgress) {
        fetchSubscription();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [profile?.business_id, fetchSubscription, isPaymentInProgress]);

  // Manejar callbacks de pago (mantenido por compatibilidad con suscripciones antiguas)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const status = urlParams.get('status');
      const canceled = urlParams.get('canceled');
      
      // Manejar cancelación
      if (canceled === 'true' || status === 'cancel') {
        toast({
          title: language === "es" ? "Cancelado" : "Canceled",
          description: language === "es" 
            ? "El proceso de pago fue cancelado" 
            : "Payment process was canceled",
          variant: "default",
        });
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }
      
      // Manejar éxito
      if (status === 'success') {
        toast({
          title: language === "es" ? "¡Pago procesado!" : "Payment processed!",
          description: language === "es" 
            ? "Tu suscripción está siendo activada. Por favor espera unos segundos..." 
            : "Your subscription is being activated. Please wait a few seconds...",
          variant: "default",
        });
        
        window.history.replaceState({}, '', window.location.pathname);
        
        setTimeout(() => {
          fetchSubscription();
        }, 2000);
      }
    } catch (error) {
      console.error('[SubscriptionPage] ❌ Error in payment callback handler:', error);
    }
  }, [profile?.business_id, language, toast, fetchSubscription]);

  // Handlers antiguos eliminados - ahora usamos RevenueCat para Android


  const handleManageSubscription = async () => {
    if (!profile?.id) return;

    setProcessingPortal(true);
    try {
      // Abrir Google Play Store para gestionar la suscripción
      // En Android, podemos abrir directamente la página de suscripciones de Google Play
      if (Capacitor.getPlatform() === "android") {
        try {
          // URL para abrir Google Play Store - página de suscripciones
          // Esta URL abre directamente la sección de suscripciones en Google Play
          const playStoreUrl = "https://play.google.com/store/account/subscriptions";
          
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({
            url: playStoreUrl,
            presentationStyle: 'fullscreen',
          });
          
          toast({
            title: language === "es" ? "Abriendo Google Play Store" : "Opening Google Play Store",
            description: language === "es"
              ? "Serás redirigido a Google Play Store para gestionar tu suscripción, cancelar o descargar recibos."
              : "You will be redirected to Google Play Store to manage your subscription, cancel, or download receipts.",
            variant: "default",
          });
        } catch (error: any) {
          console.error('[SubscriptionPage] Error opening Google Play Store:', error);
          toast({
            title: language === "es" ? "Error" : "Error",
            description: language === "es"
              ? "No se pudo abrir Google Play Store. Por favor, abre Google Play Store manualmente y ve a Suscripciones."
              : "Could not open Google Play Store. Please open Google Play Store manually and go to Subscriptions.",
            variant: "destructive",
          });
        }
      } else {
        // Si no es Android, mostrar mensaje
        toast({
          title: language === "es" ? "No disponible" : "Not available",
          description: language === "es"
            ? "La gestión de suscripciones solo está disponible en dispositivos Android."
            : "Subscription management is only available on Android devices.",
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error("Error al abrir gestión de suscripción:", error);
      
      toast({
        title: language === "es" ? "Error" : "Error",
        description: error?.message || (language === "es" 
          ? "No se pudo abrir la gestión de suscripción. Por favor, intenta de nuevo." 
          : "Could not open subscription management. Please try again."),
        variant: "destructive",
      });
    } finally {
      setProcessingPortal(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} border font-medium px-3 py-1`}>
        <Icon className="h-3.5 w-3.5 mr-1.5" />
        {language === "es" ? config.label : config.labelEn}
      </Badge>
    );
  };

  const hasPendingPayment = subscription && 
    (subscription.status === 'past_due' || 
     subscription.status === 'suspended' || 
     (subscription.status === 'trialing' && subscription.payment_due_date && new Date(subscription.payment_due_date) < new Date()));

  // Mostrar botones si no hay suscripción activa
  // El botón debe aparecer para todos los usuarios que no tengan suscripción activa
  const needsSetup = !subscription || subscription.status !== 'active';
  
  // Determinar si debemos mostrar el formulario de pago
  // Mostrar formulario si: no hay suscripción activa, hay pago pendiente, o está cancelada
  const shouldShowPaymentForm = needsSetup || hasPendingPayment || subscription?.status === 'cancelled';
  
  console.log('[SubscriptionPage] 🔍 Estado de renderizado:', {
    hasSubscription: !!subscription,
    status: subscription?.status,
    hasPendingPayment,
    needsSetup,
    shouldShowPaymentForm
  });

  // Pantalla de éxito si status=success
  if (paymentStatus === 'success') {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--bottom-nav-height))] p-6 text-center bg-gradient-to-br from-background to-muted/50">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl opacity-50 animate-pulse" />
            <div className="relative bg-green-500/10 rounded-full p-6">
              <CheckCircle2 className="h-20 w-20 text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">
            {language === "es" ? "Pago Aprobado con Éxito" : "Payment Approved Successfully"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            {language === "es"
              ? "Tu suscripción Premium ya está activa. Por favor, cierra esta pestaña del navegador y vuelve a la aplicación Mi Turnow para continuar."
              : "Your Premium subscription is now active. Please close this browser tab and return to the Mi Turnow app to continue."}
          </p>
        </div>
      </MobileLayout>
    );
  }

  // Mostrar error si hay uno crítico
  if (error && !loading) {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--bottom-nav-height))] p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {language === "es" ? "Error" : "Error"}
          </h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => {
            setError(null);
            fetchSubscription();
          }}>
            {language === "es" ? "Reintentar" : "Retry"}
          </Button>
        </div>
      </MobileLayout>
    );
  }

  // CRÍTICO: Render seguro - siempre mostrar algo, nunca pantalla blanca
  if (loading) {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--bottom-nav-height))] p-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">
            {language === "es" ? "Cargando información de suscripción..." : "Loading subscription information..."}
          </p>
        </div>
      </MobileLayout>
    );
  }

  // CRÍTICO: Render seguro - si hay error pero no loading, mostrar error con opción de reintentar
  if (error && !loading) {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--bottom-nav-height))] p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {language === "es" ? "Error" : "Error"}
          </h2>
          <p className="text-muted-foreground mb-4 max-w-md">{error}</p>
          <Button onClick={() => {
            setError(null);
            fetchSubscription();
          }}>
            {language === "es" ? "Reintentar" : "Retry"}
          </Button>
        </div>
      </MobileLayout>
    );
  }

  // CRÍTICO: Render principal - siempre renderizar algo, incluso si subscription es null
  const isGracePeriod = (subscription?.status as any) === 'grace_period';
  const gracePeriodDays = (subscription as any)?.grace_period_days_remaining || 0;

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto space-y-6">
        {/* Banner de modo prueba para usuarios nuevos */}
        {isGracePeriod && (
          <Alert className="border-blue-500 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
            <Clock className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-800 dark:text-blue-300">
              {language === "es" ? "Estás en modo prueba" : "You're in trial mode"}
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-400">
              {language === "es" 
                ? `Tienes ${gracePeriodDays} ${gracePeriodDays === 1 ? 'día' : 'días'} restantes de prueba gratuita. Activa tu suscripción para continuar disfrutando de todas las características después del período de prueba.`
                : `You have ${gracePeriodDays} ${gracePeriodDays === 1 ? 'day' : 'days'} remaining in your free trial. Activate your subscription to continue enjoying all features after the trial period.`}
            </AlertDescription>
          </Alert>
        )}
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            {language === "es" ? "Suscripción" : "Subscription"}
          </h1>
        </div>

        {/* CRÍTICO: Banner de éxito cuando la suscripción se activa */}
        {showSuccessBanner && subscription && (subscription.status === 'active' || subscription.status === 'trialing') && (
          <Alert className="border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 shadow-lg relative">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <AlertTitle className="text-green-800 font-bold">
              {language === "es" ? "¡Suscripción Activada!" : "Subscription Activated!"}
            </AlertTitle>
            <AlertDescription className="text-green-700">
              {language === "es"
                ? "Tu suscripción Premium está ahora activa. Disfruta de todas las características premium."
                : "Your Premium subscription is now active. Enjoy all premium features."}
            </AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSuccessBanner(false)}
              className="absolute top-2 right-2 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        )}

        {/* Alert para pagos pendientes */}
        {hasPendingPayment && (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">
              {language === "es" ? "Pago Pendiente" : "Pending Payment"}
            </AlertTitle>
            <AlertDescription className="text-red-700">
              {language === "es" 
                ? "Tu suscripción requiere atención. Por favor, actualiza tu método de pago para continuar usando el servicio."
                : "Your subscription requires attention. Please update your payment method to continue using the service."}
            </AlertDescription>
          </Alert>
        )}

        {/* Card principal de estado - RENDER SEGURO */}
        <Card className="shadow-md border-0 bg-gradient-to-br from-white to-gray-50/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-lg font-semibold">
                {language === "es" ? "Estado de Suscripción" : "Subscription Status"}
              </CardTitle>
              {getStatusBadge(subscription?.status || 'inactive')}
            </div>
            {/* CRÍTICO: Solo mostrar "Protección activa" si subscription existe y está activa */}
            {subscription && subscription.status === 'active' && (
              <div className="flex items-center gap-2 text-sm text-green-700 mt-2">
                <Shield className="h-4 w-4" />
                <span className="font-medium">
                  {language === "es" ? "Protección activa" : "Active protection"}
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* CRÍTICO: Render seguro - usar valores por defecto si subscription es null */}
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">
                {language === "es" ? "Plan" : "Plan"}
              </span>
              <span className="font-semibold text-base">
                {subscription?.subscription_plan || 'monthly'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {language === "es" ? "Tarifa Mensual" : "Monthly Fee"}
              </span>
              <span className="font-bold text-lg text-primary">
                ${(subscription?.monthly_fee ?? 9.99).toFixed(2)} USD
              </span>
            </div>
            {/* CRÍTICO: Solo mostrar próxima renovación si subscription existe y tiene fecha */}
            {subscription?.next_payment_date ? (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {language === "es" ? "Próxima Renovación" : "Next Renewal"}
                </span>
                <span className="font-semibold text-base">
                  {format(new Date(subscription.next_payment_date), "dd/MM/yyyy")}
                </span>
              </div>
            ) : null}
            {/* CRÍTICO: Mensaje cuando no hay suscripción */}
            {!subscription && (
              <div className="text-center py-4 border-t border-border mt-2">
                <p className="text-sm text-muted-foreground">
                  {language === "es" 
                    ? "No hay suscripción activa. Activa tu suscripción para comenzar." 
                    : "No active subscription. Activate your subscription to get started."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card de método de pago */}
        <Card className="shadow-md border-0">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              {language === "es" ? "Método de Pago" : "Payment Method"}
            </CardTitle>
            <CardDescription className="text-sm">
              {language === "es" 
                ? "Gestiona tu método de pago y suscripción"
                : "Manage your payment method and subscription"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscription?.status === 'active' && !hasPendingPayment ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="p-2 bg-card rounded-lg shadow-sm">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {language === "es" ? "Google Play Store" : "Google Play Store"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "es" ? "Pago procesado de forma segura" : "Payment processed securely"}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {language === "es" ? "Activo" : "Active"}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {subscription?.status === 'cancelled'
                    ? (language === "es" 
                        ? "Tu suscripción está cancelada. Haz clic en el botón para reactivarla a través de Google Play Store."
                        : "Your subscription is cancelled. Click the button to reactivate it through Google Play Store.")
                    : hasPendingPayment 
                    ? (language === "es" 
                        ? "Actualiza tu método de pago para reactivar tu suscripción."
                        : "Update your payment method to reactivate your subscription.")
                    : (language === "es" 
                        ? "Haz clic en el botón para activar tu suscripción a través de Google Play Store."
                        : "Click the button to activate your subscription through Google Play Store.")}
                </p>
                {/* Botón de suscripción con RevenueCat/Google Play */}
                {Capacitor.getPlatform() === "android" ? (
                  <Button
                    onClick={async () => {
                      if (!profile?.id) {
                        toast({
                          title: language === "es" ? "Error" : "Error",
                          description: language === "es"
                            ? "Información de usuario no disponible"
                            : "User information not available",
                          variant: "destructive",
                        });
                        return;
                      }

                      setIsPaymentInProgress(true);
                      
                      try {
                        console.log('[SubscriptionPage] 💳 Iniciando compra con RevenueCat...');
                        
                        // CRÍTICO: Identificar al usuario en RevenueCat antes de comprar
                        console.log('[SubscriptionPage] 🔐 Identificando usuario en RevenueCat antes de comprar...');
                        try {
                          await identifyUser(profile.id);
                          console.log('[SubscriptionPage] ✅ Usuario identificado correctamente');
                        } catch (identifyError: any) {
                          console.error('[SubscriptionPage] ⚠️ Error identificando usuario, continuando con compra:', identifyError);
                          // Continuar con la compra aunque falle la identificación (puede que ya esté identificado)
                        }
                        
                        // Realizar la compra del paquete mensual (usa offering default)
                        const result = await purchaseProduct();
                        
                        if (result.success) {
                          console.log('[SubscriptionPage] ✅ Compra exitosa, verificando entitlement...');
                          
                          // Verificar y actualizar el entitlement en Supabase
                          const hasProAccess = await verifyPremiumEntitlement(profile.id);
                          
                          if (hasProAccess) {
                            toast({
                              title: language === "es" ? "¡Suscripción activada!" : "Subscription activated!",
                              description: language === "es"
                                ? "Tu suscripción premium ha sido activada correctamente"
                                : "Your premium subscription has been activated successfully",
                            });
                            
                            // Refrescar la suscripción
                            await fetchSubscription();
                            
                            // Recargar después de un delay para actualizar UI
                            setTimeout(() => {
                              window.location.reload();
                            }, 1000);
                          } else {
                            console.warn('[SubscriptionPage] ⚠️ Compra exitosa pero entitlement no verificado');
                            toast({
                              title: language === "es" ? "Compra completada" : "Purchase completed",
                              description: language === "es"
                                ? "Tu compra se completó. La suscripción se activará en breve."
                                : "Your purchase was completed. The subscription will activate shortly.",
                            });
                            
                            // Refrescar después de un delay
                            setTimeout(() => {
                              fetchSubscription();
                              setTimeout(() => {
                                window.location.reload();
                              }, 2000);
                            }, 1000);
                          }
                        } else {
                          // Si el usuario canceló, no mostrar error
                          if (result.error?.includes("cancelada") || result.error?.includes("cancelled")) {
                            console.log('[SubscriptionPage] ℹ️ Usuario canceló la compra');
                            setIsPaymentInProgress(false);
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
                          setIsPaymentInProgress(false);
                        }
                      } catch (error: any) {
                        console.error('[SubscriptionPage] ❌ Error activando suscripción:', error);
                        toast({
                          title: language === "es" ? "Error" : "Error",
                          description: error.message || (language === "es" 
                            ? "Ocurrió un error al procesar la compra. Por favor, intenta de nuevo." 
                            : "An error occurred processing the purchase. Please try again."),
                          variant: "destructive",
                        });
                        setIsPaymentInProgress(false);
                      }
                    }}
                    disabled={isPaymentInProgress}
                    className="w-full h-12 rounded-xl shadow-sm font-semibold text-base bg-black text-white hover:bg-gray-900"
                    size="lg"
                  >
                    {isPaymentInProgress ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        {language === "es" ? "Procesando..." : "Processing..."}
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="h-5 w-5 mr-2" />
                        {language === "es" ? "Suscribirse con Google Play" : "Subscribe with Google Play"}
                      </>
                    )}
                  </Button>
                ) : (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>
                      {language === "es" ? "Suscripción disponible en Android" : "Subscription available on Android"}
                    </AlertTitle>
                    <AlertDescription>
                      {language === "es"
                        ? "Las suscripciones a través de Google Play Store solo están disponibles en dispositivos Android. Por favor, usa la app en Android para activar tu suscripción."
                        : "Subscriptions through Google Play Store are only available on Android devices. Please use the Android app to activate your subscription."}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {language === "es" 
                    ? "Pago procesado de forma segura a través de Google Play Store" 
                    : "Payment processed securely through Google Play Store"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botones de acción - RENDER SEGURO */}
        <div className="space-y-3">
          {/* CRÍTICO: Mostrar botón de gestión solo si subscription existe y está activa */}
          {subscription && 
           subscription.status === 'active' && (
            <Button 
              onClick={handleManageSubscription}
              disabled={processingPortal}
              variant="outline"
              className="w-full h-12 rounded-xl shadow-sm font-semibold text-base border-2"
              size="lg"
            >
              {processingPortal ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {language === "es" ? "Cargando..." : "Loading..."}
                </>
              ) : (
                <>
                  <Settings className="h-5 w-5 mr-2" />
                  {language === "es" ? "Gestionar Suscripción" : "Manage Subscription"}
                </>
              )}
            </Button>
          )}
        </div>

        {/* Información adicional para período de prueba */}
        {subscription?.status === 'trialing' && (
          <Card className="shadow-sm border-blue-100 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-blue-900">
                {language === "es" ? "Período de Prueba" : "Trial Period"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-800 mb-3">
                {language === "es" 
                  ? "Estás en un período de prueba. Configura tu método de pago antes de que termine para continuar usando el servicio sin interrupciones."
                  : "You are in a trial period. Set up your payment method before it ends to continue using the service without interruptions."}
              </p>
              {subscription.payment_due_date && (
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {language === "es" ? "El período de prueba termina el" : "Trial period ends on"}{" "}
                    <span className="font-semibold">
                      {format(new Date(subscription.payment_due_date), "dd/MM/yyyy")}
                    </span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}
