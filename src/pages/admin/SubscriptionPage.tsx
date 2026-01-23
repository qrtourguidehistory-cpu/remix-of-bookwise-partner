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
import { Browser } from "@capacitor/browser";
import { usePayPalSubscription } from "@/hooks/usePayPalSubscription";
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
  Check
} from "lucide-react";

interface BusinessSubscription {
  id: string;
  business_id: string;
  owner_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'inactive';
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
  const [checkoutLoading, setCheckoutLoading] = useState(false); // Loading para pago único
  
  // Hook para manejar suscripciones de PayPal con Capacitor Browser
  const { createSubscription: createPayPalSubscription, loading: paypalLoading } = usePayPalSubscription();

  // Log cuando el componente se monta
  useEffect(() => {
    console.log('[SubscriptionPage] 🚀 Componente montado', {
      hasProfile: !!profile,
      business_id: profile?.business_id,
    });
  }, []);
  const paymentStatus = searchParams.get('status');

  // Función fetchSubscription memoizada para evitar dependencias circulares
  const fetchSubscription = useCallback(async () => {
    if (!profile?.business_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("business_subscriptions")
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
        status: data?.status,
        id: data?.id,
      });
      setSubscription(data);
      setError(null); // Limpiar error si la carga fue exitosa
    } catch (error: any) {
      console.error("[SubscriptionPage] ❌ Exception en fetchSubscription:", {
        error,
        message: error?.message,
        stack: error?.stack,
      });
      setError(error?.message || 'Error al cargar suscripción');
      setSubscription(null);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" 
          ? "No se pudo cargar la información de suscripción" 
          : "Could not load subscription information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.business_id, toast, language]);

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

  // Manejar el callback de PayPal después del pago
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

  // Handlers antiguos eliminados - ahora usamos usePayPalSubscription hook

  // Handler para pago único con PayPal Checkout
  const handleOneTimePayment = async () => {
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

    setCheckoutLoading(true);
    try {
      console.log('[SubscriptionPage] Creando pago único con PayPal...');

      // Llamar a la Edge Function para crear el checkout
      const { data, error } = await supabase.functions.invoke('create-paypal-checkout', {
        body: {
          user_id: profile.id,
          amount: 9.50, // Monto fijo de prueba
        }
      });

      if (error) {
        throw new Error(error.message || 'Error al crear checkout en PayPal');
      }

      if (!data?.approval_url) {
        throw new Error('No se recibió la URL de aprobación de PayPal');
      }

      console.log('[SubscriptionPage] Abriendo PayPal Checkout...');

      // Abrir PayPal en el navegador
      if (Capacitor.isNativePlatform()) {
        await Browser.open({
          url: data.approval_url,
          presentationStyle: 'fullscreen',
          windowName: '_self',
        });
      } else {
        // Web: redirigir directamente
        window.location.href = data.approval_url;
      }
    } catch (error: any) {
      console.error('[SubscriptionPage] Error en pago único:', error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: error?.message || (language === "es"
          ? "Error al procesar el pago"
          : "Error processing payment"),
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!profile?.business_id || !subscription) return;

    setProcessingPortal(true);
    try {
      const requestBody = {
        business_id: profile.business_id,
        subscription_id: subscription.id,
      };

      const { data, error } = await supabase.functions.invoke('create-portal-link', {
        body: requestBody
      });

      if (error) {
        throw new Error(error.message || 'Error al invocar la función');
      }

      if (data && data.success === false) {
        throw new Error(data.error || 'Error desconocido al crear el portal');
      }

      if (!data || !data.portal_url) {
        throw new Error('No se recibió respuesta del servidor');
      }

      window.location.href = data.portal_url;
    } catch (error: any) {
      console.error("Error al crear portal de gestión:", error);
      
      toast({
        title: language === "es" ? "Error" : "Error",
        description: error?.message || (language === "es" 
          ? "No se pudo abrir el portal de gestión. Por favor, intenta de nuevo." 
          : "Could not open management portal. Please try again."),
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
    hasPaypalId: !!subscription?.paypal_subscription_id,
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

  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            {language === "es" ? "Suscripción" : "Subscription"}
          </h1>
        </div>

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

        {/* Card principal de estado */}
        <Card className="shadow-md border-0 bg-gradient-to-br from-white to-gray-50/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-lg font-semibold">
                {language === "es" ? "Estado de Suscripción" : "Subscription Status"}
              </CardTitle>
              {getStatusBadge(subscription?.status || 'inactive')}
            </div>
            {subscription?.status === 'active' && (
              <div className="flex items-center gap-2 text-sm text-green-700 mt-2">
                <Shield className="h-4 w-4" />
                <span className="font-medium">
                  {language === "es" ? "Protección activa" : "Active protection"}
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-muted-foreground">
                {language === "es" ? "Plan" : "Plan"}
              </span>
              <span className="font-semibold text-base">
                {subscription?.subscription_plan || 'monthly'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {language === "es" ? "Tarifa Mensual" : "Monthly Fee"}
              </span>
              <span className="font-bold text-lg text-primary">
                ${(subscription?.monthly_fee || 9.50).toFixed(2)} USD
              </span>
            </div>
            {subscription?.next_payment_date && (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {language === "es" ? "Próxima Renovación" : "Next Renewal"}
                </span>
                <span className="font-semibold text-base">
                  {format(new Date(subscription.next_payment_date), "dd/MM/yyyy")}
                </span>
              </div>
            )}
            {!subscription && (
              <div className="text-center py-4 border-t border-gray-100 mt-2">
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
            {subscription?.status === 'active' && subscription?.paypal_subscription_id && !hasPendingPayment ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">PayPal</p>
                    <p className="text-xs text-muted-foreground">
                      {language === "es" ? "Método de pago configurado" : "Payment method configured"}
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
                        ? "Tu suscripción está cancelada. Haz clic en el botón para reactivarla con PayPal."
                        : "Your subscription is cancelled. Click the button to reactivate it with PayPal.")
                    : hasPendingPayment 
                    ? (language === "es" 
                        ? "Actualiza tu método de pago para reactivar tu suscripción."
                        : "Update your payment method to reactivate your subscription.")
                    : (language === "es" 
                        ? "Haz clic en el botón para activar tu suscripción con PayPal."
                        : "Click the button to activate your subscription with PayPal.")}
                </p>
                {/* Botón de PayPal usando Capacitor Browser */}
                <Button
                  onClick={async () => {
                    if (!profile?.business_id || !profile?.id) {
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
                    const result = await createPayPalSubscription(
                      profile.business_id,
                      profile.id,
                      subscription?.id
                    );

                    if (!result.success) {
                      setIsPaymentInProgress(false);
                    }
                    // Si es exitoso, el hook manejará el deep link y cerrará el browser
                  }}
                  disabled={paypalLoading || isPaymentInProgress}
                  className="w-full h-12 rounded-xl shadow-sm font-semibold text-base"
                  size="lg"
                >
                  {paypalLoading || isPaymentInProgress ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      {language === "es" ? "Procesando..." : "Processing..."}
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5 mr-2" />
                      {language === "es" ? "Suscribirse con PayPal" : "Subscribe with PayPal"}
                    </>
                  )}
                </Button>
                {/* Botón de Pago Único */}
                <div className="mt-3">
                  <Button
                    onClick={handleOneTimePayment}
                    disabled={checkoutLoading || isPaymentInProgress}
                    variant="outline"
                    className="w-full h-12 rounded-xl shadow-sm font-semibold text-base bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-200 transition-colors duration-200"
                    size="lg"
                  >
                    {checkoutLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        {language === "es" ? "Procesando..." : "Processing..."}
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5 mr-2" />
                        {language === "es" ? "Pagar con Tarjeta Crédito o Débito" : "Pay with Credit or Debit Card"}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    {language === "es" ? "Powered by PayPal" : "Powered by PayPal"}
                  </p>
                  {/* Información sobre cómo pagar */}
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-start gap-2 mb-3">
                      <Info className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                      <h4 className="text-sm font-semibold text-gray-800">
                        {language === "es" ? "¿Cómo pagar directo con tu tarjeta?" : "How to pay directly with your card?"}
                      </h4>
                    </div>
                    <ul className="space-y-2 text-xs text-gray-600">
                      <li className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{language === "es" ? "Haz clic en el botón 'Pagar con Tarjeta Crédito o Débito' de arriba." : "Click the 'Pay with Credit or Debit Card' button above."}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{language === "es" ? "Selecciona 'Abrir cuenta' o 'Pagar como invitado'." : "Select 'Open account' or 'Pay as guest'."}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{language === "es" ? "Ingresa los datos de tu tarjeta y sigue los pasos (no es obligatorio mantener la cuenta de PayPal al finalizar)." : "Enter your card details and follow the steps (you don't need to keep the PayPal account after completing)."}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <div className="space-y-3">
          {subscription?.status === 'active' && subscription.paypal_subscription_id && (
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
