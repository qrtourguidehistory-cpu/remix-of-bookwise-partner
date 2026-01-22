import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useSubscriptionStatus } from './useSubscriptionStatus';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook para manejar deep links de retorno de pago de Stripe
 * Escucha URLs con formato: miturnow://admin?status=success o miturnow://admin?status=cancel
 */
export function usePaymentDeepLink() {
  const isNative = Capacitor.isNativePlatform();
  const { refetchSubscription, status: currentStatus } = useSubscriptionStatus();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingAttemptsRef = useRef(0);
  const toastIdRef = useRef<string | number | null>(null);

  // Función de polling inteligente
  const pollSubscriptionStatus = useCallback(async (maxAttempts: number = 3) => {
    if (pollingAttemptsRef.current >= maxAttempts) {
      console.log('[PaymentDeepLink] Max polling attempts reached');
      if (toastIdRef.current) {
        toast({
          id: toastIdRef.current,
          title: language === "es" ? "Pago Procesado" : "Payment Processed",
          description: language === "es"
            ? "El pago se está procesando, esto puede tardar un minuto. Tu cuenta se activará pronto."
            : "Payment is being processed, this may take a minute. Your account will be activated soon.",
          variant: "default",
        });
      }
      return;
    }

    pollingAttemptsRef.current++;
    console.log(`[PaymentDeepLink] Polling attempt ${pollingAttemptsRef.current}/${maxAttempts}`);

    try {
      // Invalidar todas las queries relacionadas con suscripción
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['business_subscriptions'] });
      
      // Refrescar la suscripción
      await refetchSubscription();

      // Obtener el estado directamente de la base de datos usando business_id
      if (profile?.business_id) {
        const { data: subscriptionData } = await supabase
          .from('business_subscriptions')
          .select('status')
          .eq('business_id', profile.business_id)
          .maybeSingle();

        const newStatus = subscriptionData?.status;

        // Si el estado es 'active' o 'trialing', detener el polling y limpiar caché
        if (newStatus === 'active' || newStatus === 'trialing') {
          console.log('[PaymentDeepLink] Subscription is now active!', newStatus);
          
          // Limpiar caché al final: invalidar queries y refetch forzado
          queryClient.invalidateQueries({ queryKey: ['subscription'] });
          queryClient.invalidateQueries({ queryKey: ['business_subscriptions'] });
          // Refetch para forzar actualización y que el cohete morado desaparezca
          await refetchSubscription();
          
          if (toastIdRef.current) {
            toast({
              id: toastIdRef.current,
              title: language === "es" ? "¡Pago Confirmado!" : "Payment Confirmed!",
              description: language === "es"
                ? "Tu suscripción Premium ya está activa."
                : "Your Premium subscription is now active.",
              variant: "default",
            });
          }
          pollingAttemptsRef.current = 0;
          return;
        }
      }

      // Si aún no está activo y no hemos alcanzado el máximo, continuar polling
      if (pollingAttemptsRef.current < maxAttempts) {
        // Actualizar el toast con el progreso
        if (toastIdRef.current) {
          toast({
            id: toastIdRef.current,
            title: language === "es" ? "Actualizando tu cuenta..." : "Updating your account...",
            description: language === "es"
              ? `Verificando suscripción (${pollingAttemptsRef.current}/${maxAttempts})...`
              : `Verifying subscription (${pollingAttemptsRef.current}/${maxAttempts})...`,
            variant: "default",
          });
        }

        // Programar el siguiente intento
        pollingIntervalRef.current = setTimeout(() => {
          pollSubscriptionStatus(maxAttempts);
        }, 2000); // 2 segundos entre intentos
      }
    } catch (error) {
      console.error('[PaymentDeepLink] Error during polling:', error);
      // Continuar intentando a pesar del error
      if (pollingAttemptsRef.current < maxAttempts) {
        pollingIntervalRef.current = setTimeout(() => {
          pollSubscriptionStatus(maxAttempts);
        }, 2000);
      }
    }
  }, [refetchSubscription, toast, language, queryClient, profile?.business_id]);

  // Función helper para manejar pago exitoso
  const handlePaymentSuccess = useCallback(async (status: string, sessionId: string | null) => {
    try {
      // Limpiar cualquier polling anterior
      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      pollingAttemptsRef.current = 0;

      console.log('[PaymentDeepLink] Payment status detected:', status, 'session_id:', sessionId);

      // Pago exitoso: verificar activamente primero, luego hacer polling
      console.log('[PaymentDeepLink] Payment successful, verifying session...');
      
      // Mostrar toast inicial
      const initialToast = toast({
        title: language === "es" ? "Actualizando tu cuenta..." : "Updating your account...",
        description: language === "es"
          ? "Verificando tu suscripción Premium..."
          : "Verifying your Premium subscription...",
        variant: "default",
      });
      toastIdRef.current = initialToast.id || Date.now();

      // Invalidar caché inmediatamente
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['business_subscriptions'] });

      // Si tenemos session_id, llamar a verify-stripe-session para verificación activa
      if (sessionId) {
        try {
          console.log('[PaymentDeepLink] 🚀 Calling verify-stripe-session with session_id:', sessionId);
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-stripe-session', {
            body: { session_id: sessionId }
          });

          console.log('[PaymentDeepLink] 📦 verify-stripe-session response:', { verifyData, verifyError });

          if (verifyError) {
            console.error('[PaymentDeepLink] ❌ Error verifying session:', verifyError);
            // Continuar con polling como fallback
          } else if (verifyData?.success) {
            console.log('[PaymentDeepLink] ✅ Session verified successfully:', verifyData);
            
            // Esperar un momento para que la BD se actualice
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Invalidar caché y refrescar suscripción
            queryClient.invalidateQueries({ queryKey: ['subscription'] });
            queryClient.invalidateQueries({ queryKey: ['business_subscriptions'] });
            await refetchSubscription();
            
            // Verificar si ya está activa
            if (profile?.business_id) {
              const { data: subscriptionData, error: subError } = await supabase
                .from('business_subscriptions')
                .select('status, stripe_subscription_id, stripe_customer_id')
                .eq('business_id', profile.business_id)
                .maybeSingle();

              console.log('[PaymentDeepLink] 📊 Subscription data after verification:', { subscriptionData, subError });

              if (subscriptionData?.status === 'active' || subscriptionData?.status === 'trialing') {
                console.log('[PaymentDeepLink] 🎉 Subscription activated via verify-stripe-session! Status:', subscriptionData.status);
                if (toastIdRef.current) {
                  toast({
                    id: toastIdRef.current,
                    title: language === "es" ? "¡Pago Confirmado!" : "Payment Confirmed!",
                    description: language === "es"
                      ? "Tu suscripción Premium ya está activa."
                      : "Your Premium subscription is now active.",
                    variant: "default",
                  });
                }
                return; // Éxito, no hacer polling
              } else {
                console.log('[PaymentDeepLink] ⚠️ Subscription not active yet. Status:', subscriptionData?.status);
              }
            }
          } else {
            console.log('[PaymentDeepLink] ⚠️ verify-stripe-session returned success=false:', verifyData);
          }
        } catch (error) {
          console.error('[PaymentDeepLink] ❌ Exception calling verify-stripe-session:', error);
          // Continuar con polling como fallback
        }
      } else {
        console.log('[PaymentDeepLink] ⚠️ No session_id available, skipping active verification');
      }

      // Si no tenemos session_id o la verificación falló, hacer polling como fallback
      console.log('[PaymentDeepLink] Starting polling as fallback...');
      await pollSubscriptionStatus(3);
    } catch (error) {
      console.error('[PaymentDeepLink] Error handling payment success:', error);
    }
  }, [refetchSubscription, toast, language, queryClient, profile?.business_id, pollSubscriptionStatus]);

  // NOTA: El manejo de parámetros de URL web se hace en SubscriptionPage.tsx
  // para evitar dependencias circulares y problemas de renderizado

  // Manejar deep links nativos (solo en apps nativas)
  useEffect(() => {
    if (!isNative) return;

    const handleAppUrlOpen = async ({ url }: { url: string }) => {
      console.log('[PaymentDeepLink] 📱 Native app opened with URL:', url);

      try {
        // Limpiar cualquier polling anterior
        if (pollingIntervalRef.current) {
          clearTimeout(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        pollingAttemptsRef.current = 0;

        // Parsear la URL para extraer parámetros
        let status: string | null = null;
        let sessionId: string | null = null;
        
        if (url.includes('?')) {
          const queryString = url.split('?')[1];
          const params = new URLSearchParams(queryString);
          status = params.get('status');
          sessionId = params.get('session_id');
        }

        // Solo procesar si hay un parámetro status
        if (!status) return;

        // Usar la función helper para manejar el pago exitoso
        if (status === 'success') {
          await handlePaymentSuccess(status, sessionId);
        } else if (status === 'cancel') {
          // Pago cancelado: solo mostrar notificación
          console.log('[PaymentDeepLink] Payment canceled');
          
          toast({
            title: language === "es" ? "Pago Cancelado" : "Payment Canceled",
            description: language === "es"
              ? "El pago fue cancelado. Puedes intentar nuevamente cuando lo desees."
              : "The payment was canceled. You can try again whenever you want.",
            variant: "default",
          });
        }
      } catch (error) {
        console.error('[PaymentDeepLink] Error handling payment deep link:', error);
      }
    };

    // Escuchar eventos de deep links
    const listener = App.addListener('appUrlOpen', handleAppUrlOpen);

    return () => {
      listener.then(l => l.remove());
      // Limpiar polling al desmontar
      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current);
      }
    };
  }, [isNative, handlePaymentSuccess, toast, language]);
}

