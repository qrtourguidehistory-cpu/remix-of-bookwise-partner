/**
 * Hook para verificar automáticamente suscripciones pendientes
 * cuando la app se abre o vuelve del background
 * 
 * IMPORTANTE: Esto NO depende del deep link. Verifica directamente
 * en la base de datos si hay una suscripción pendiente.
 */

import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { getPendingSubscription, clearPendingSubscription } from '@/lib/subscriptionPersistence';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionStatus } from './useSubscriptionStatus';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export function useAppStateSubscriptionCheck() {
  const { profile } = useAuth();
  const { refetchSubscription } = useSubscriptionStatus();
  const { toast } = useToast();
  const { language } = useLanguage();
  const checkingRef = useRef(false);
  const lastCheckRef = useRef<number>(0);

  const checkPendingSubscription = async () => {
    // Evitar múltiples verificaciones simultáneas
    if (checkingRef.current) {
      return;
    }

    // Throttle: máximo una verificación cada 5 segundos
    const now = Date.now();
    if (now - lastCheckRef.current < 5000) {
      return;
    }

    checkingRef.current = true;
    lastCheckRef.current = now;

    try {
      const pending = await getPendingSubscription();
      
      if (!pending) {
        checkingRef.current = false;
        return;
      }

      // Verificar que el business_id coincida
      if (pending.business_id !== profile?.business_id) {
        await clearPendingSubscription();
        checkingRef.current = false;
        return;
      }


      // Verificar directamente en la base de datos (fuente de verdad)
      const { data: subscriptionData, error } = await supabase
        .from('business_subscriptions')
        .select('status, stripe_subscription_id, stripe_customer_id')
        .eq('business_id', pending.business_id)
        .maybeSingle();

      if (error) {
        console.error('[AppStateCheck] ❌ Error checking subscription:', error);
        checkingRef.current = false;
        return;
      }

      // Si la suscripción está activa o en trial, limpiar pendiente y actualizar
      if (subscriptionData && (subscriptionData.status === 'active' || subscriptionData.status === 'trialing')) {
        
        // Limpiar estado pendiente
        await clearPendingSubscription();
        
        // Refrescar suscripción (saltando caché)
        await refetchSubscription();
        
        // Mostrar notificación de éxito
        toast({
          title: language === "es" ? "¡Pago Confirmado!" : "Payment Confirmed!",
          description: language === "es"
            ? "Tu suscripción Premium ya está activa."
            : "Your Premium subscription is now active.",
          variant: "default",
        });
      } else {
        // No limpiar pendiente aún, seguir verificando
      }
    } catch (error) {
      console.error('[AppStateCheck] ❌ Error in checkPendingSubscription:', error);
    } finally {
      checkingRef.current = false;
    }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !profile?.business_id) {
      return;
    }

    // Verificar inmediatamente al montar
    checkPendingSubscription();

    // Escuchar cuando la app vuelve al foreground
    const appStateListener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        checkPendingSubscription();
      }
    });

    // También verificar periódicamente (cada 10 segundos) mientras hay pendiente
    const intervalId = setInterval(() => {
      checkPendingSubscription();
    }, 10000);

    return () => {
      appStateListener.then(listener => listener.remove());
      clearInterval(intervalId);
    };
  }, [profile?.business_id, refetchSubscription, toast, language]);

  // También verificar en web cuando la ventana vuelve a tener foco
  useEffect(() => {
    if (Capacitor.isNativePlatform() || !profile?.business_id) {
      return;
    }

    const handleFocus = () => {
      checkPendingSubscription();
    };

    window.addEventListener('focus', handleFocus);
    
    // Verificar inmediatamente
    checkPendingSubscription();

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [profile?.business_id, refetchSubscription, toast, language]);
}

