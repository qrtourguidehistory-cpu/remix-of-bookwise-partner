import { useState, useEffect, useCallback } from "react";
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
  RefreshCw
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

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { subscription: realtimeSubscription } = useSubscriptionStatus(); // Para garantizar realtime
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<BusinessSubscription | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [processingPortal, setProcessingPortal] = useState(false);
  const paymentStatus = searchParams.get('status');

  // Función fetchSubscription memoizada para evitar dependencias circulares
  const fetchSubscription = useCallback(async () => {
    if (!profile?.business_id) return;
    
    console.log('[SubscriptionPage] 🔄 Fetching subscription for business_id:', profile.business_id);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("business_subscriptions")
        .select("*")
        .eq("business_id", profile.business_id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      console.log('[SubscriptionPage] 📦 Subscription data received:', data);
      setSubscription(data);
    } catch (error: any) {
      console.error("[SubscriptionPage] ❌ Error fetching subscription:", error);
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

  // Manejar el callback de Stripe Checkout después del pago
  useEffect(() => {
    // Validar que window existe (protección SSR)
    if (typeof window === 'undefined') return;
    
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const status = urlParams.get('status'); // Deep link usa 'status', no 'success'
      const success = urlParams.get('success'); // Web redirect usa 'success'
      const canceled = urlParams.get('canceled');
      const sessionId = urlParams.get('session_id');
      
      console.log('[SubscriptionPage] 🔍 Checking URL params:', { status, success, canceled, sessionId });
      
      // Manejar cancelación
      if (canceled === 'true' || status === 'cancel') {
        console.log('[SubscriptionPage] ❌ Payment canceled');
        toast({
          title: language === "es" ? "Cancelado" : "Canceled",
          description: language === "es" 
            ? "El proceso de pago fue cancelado" 
            : "Payment process was canceled",
          variant: "default",
        });
        // Limpiar los parámetros de la URL
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }
      
      // Manejar éxito (tanto desde deep link como desde web)
      const isSuccess = status === 'success' || success === 'true';
      
      if (isSuccess && sessionId) {
        console.log('[SubscriptionPage] 🎯 Payment success detected with session_id:', sessionId);
        
        // Mostrar toast inicial
        const initialToast = toast({
          title: language === "es" ? "Actualizando tu cuenta..." : "Updating your account...",
          description: language === "es" 
            ? "Verificando tu suscripción Premium..."
            : "Verifying your Premium subscription...",
          variant: "default",
        });
        
        // Limpiar los parámetros de la URL
        window.history.replaceState({}, '', window.location.pathname);
        
        // Llamar a verify-stripe-session activamente
        const verifyPayment = async () => {
          try {
            console.log('[SubscriptionPage] 🚀 Calling verify-stripe-session with session_id:', sessionId);
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-stripe-session', {
              body: { session_id: sessionId }
            });

            console.log('[SubscriptionPage] 📦 verify-stripe-session response:', { verifyData, verifyError });

            if (verifyError) {
              console.error('[SubscriptionPage] ❌ Error verifying session:', verifyError);
              toast({
                title: language === "es" ? "Error" : "Error",
                description: language === "es"
                  ? "Error al verificar el pago. Por favor intenta de nuevo."
                  : "Error verifying payment. Please try again.",
                variant: "destructive",
              });
              // Hacer polling como fallback
              setTimeout(() => {
                fetchSubscription();
              }, 2000);
              return;
            }

            if (verifyData?.success && verifyData?.verified) {
              console.log('[SubscriptionPage] ✅ Session verified successfully');
              
              // Esperar un momento para que la BD se actualice
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Refrescar suscripción
              await fetchSubscription();
              
              // Verificar estado final
              const { data: subscriptionData } = await supabase
                .from('business_subscriptions')
                .select('status, stripe_subscription_id, stripe_customer_id')
                .eq('business_id', profile?.business_id)
                .maybeSingle();

              console.log('[SubscriptionPage] 📊 Final subscription status:', subscriptionData?.status);

              if (subscriptionData?.status === 'active' || subscriptionData?.status === 'trialing') {
                toast({
                  title: language === "es" ? "¡Pago Confirmado!" : "Payment Confirmed!",
                  description: language === "es"
                    ? "Tu suscripción Premium ya está activa."
                    : "Your Premium subscription is now active.",
                  variant: "default",
                });
              } else {
                // Si aún no está activa, hacer polling
                console.log('[SubscriptionPage] ⚠️ Subscription not active yet, starting polling...');
                setTimeout(() => {
                  fetchSubscription();
                }, 2000);
              }
            } else {
              console.log('[SubscriptionPage] ⚠️ Verification returned success=false');
              // Hacer polling como fallback
              setTimeout(() => {
                fetchSubscription();
              }, 2000);
            }
          } catch (error) {
            console.error('[SubscriptionPage] ❌ Exception verifying session:', error);
            // Hacer polling como fallback
            setTimeout(() => {
              fetchSubscription();
            }, 2000);
          }
        };

        verifyPayment();
      } else if (isSuccess) {
        // Éxito pero sin session_id - solo hacer polling
        console.log('[SubscriptionPage] ⚠️ Success detected but no session_id, doing polling only');
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

  const handleStripeCheckout = async () => {
    console.log('[SubscriptionPage] 🚀 Iniciando proceso de suscripción...');
    
    if (!profile?.business_id) {
      console.error('[SubscriptionPage] ❌ No business_id available');
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" 
          ? "No se encontró el ID del negocio. Por favor, inicia sesión nuevamente." 
          : "Business ID not found. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    console.log('[SubscriptionPage] ✅ business_id validado:', profile.business_id);
    setProcessingPayment(true);
    
    try {
      // Si no hay suscripción, crear una primero
      let subscriptionId = subscription?.id;
      if (!subscriptionId) {
        const { data: newSubscription, error: createError } = await supabase
          .from("business_subscriptions")
          .insert({
            business_id: profile.business_id,
            owner_id: profile.id,
            status: 'inactive',
            subscription_plan: 'monthly',
            monthly_fee: 9.50,
          })
          .select()
          .single();

        if (createError) throw createError;
        if (!newSubscription) throw new Error("No se pudo crear la suscripción");
        
        subscriptionId = newSubscription.id;
        setSubscription(newSubscription);
      }

      const requestBody = {
        business_id: profile.business_id,
        subscription_id: subscriptionId,
      };

      console.log('[SubscriptionPage] 📤 Calling create-stripe-checkout with:', requestBody);
      
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: requestBody
      });

      console.log('[SubscriptionPage] 📥 Response from create-stripe-checkout:', { data, error });

      if (error) {
        console.error('[SubscriptionPage] ❌ Error from function:', error);
        throw new Error(error.message || 'Error al invocar la función');
      }

      if (data && data.success === false) {
        console.error('[SubscriptionPage] ❌ Function returned success=false:', data);
        throw new Error(data.error || 'Error desconocido al crear la sesión de pago');
      }

      if (!data || !data.checkout_url) {
        console.error('[SubscriptionPage] ❌ No checkout_url in response:', data);
        throw new Error('No se recibió respuesta del servidor');
      }

      console.log('[SubscriptionPage] ✅ Redirecting to checkout URL:', data.checkout_url);
      window.location.href = data.checkout_url;
    } catch (error: any) {
      console.error("Error al crear sesión Stripe Checkout:", error);
      
      let errorMessage = language === "es" 
        ? "No se pudo procesar el pago. Por favor, intenta de nuevo." 
        : "Could not process payment. Please try again.";

      if (error?.message) {
        if (error.message.includes('Stripe secret key not configured')) {
          errorMessage = language === "es" 
            ? "Las credenciales de Stripe no están configuradas. Por favor, contacta al soporte." 
            : "Stripe credentials are not configured. Please contact support.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: language === "es" ? "Error" : "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
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
      console.error("Error al crear portal de Stripe:", error);
      
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

  const needsSetup = !subscription || !subscription.stripe_subscription_id;

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
            {subscription?.stripe_subscription_id ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Stripe</p>
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
              <p className="text-sm text-muted-foreground">
                {language === "es" 
                  ? "Configura tu método de pago para activar tu suscripción."
                  : "Set up your payment method to activate your subscription."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <div className="space-y-3">
          {(needsSetup || !subscription) && (
            <Button 
              onClick={handleStripeCheckout}
              disabled={processingPayment}
              className="w-full h-12 rounded-xl shadow-md font-semibold text-base"
              size="lg"
            >
              {processingPayment ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {language === "es" ? "Procesando..." : "Processing..."}
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 mr-2" />
                  {language === "es" ? "Activar Suscripción" : "Activate Subscription"}
                </>
              )}
            </Button>
          )}

          {hasPendingPayment && !needsSetup && (
            <Button 
              onClick={handleStripeCheckout}
              disabled={processingPayment}
              variant="destructive"
              className="w-full h-12 rounded-xl shadow-md font-semibold text-base"
              size="lg"
            >
              {processingPayment ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {language === "es" ? "Procesando..." : "Processing..."}
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 mr-2" />
                  {language === "es" ? "Reintentar Pago" : "Retry Payment"}
                </>
              )}
            </Button>
          )}

          {subscription?.status === 'active' && subscription.stripe_subscription_id && (
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
