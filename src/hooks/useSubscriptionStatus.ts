import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'inactive' | 'loading' | 'no_subscription' | 'grace_period';

interface UseSubscriptionStatusResult {
  status: SubscriptionStatus;
  isLoading: boolean;
  subscription: any | null;
  refetchSubscription: (skipCache?: boolean) => Promise<void>;
}

export function useSubscriptionStatus(): UseSubscriptionStatusResult {
  const { profile } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>('loading');
  const [subscription, setSubscription] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async (skipCache: boolean = false) => {
    if (!profile?.id) {
      setStatus('no_subscription');
      setIsLoading(false);
      setSubscription(null);
      return;
    }

    setIsLoading(true);
    try {
      // ✅ PRIORIDAD GOOGLE PLAY: Leer is_premium de profiles como fuente principal
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("is_premium, created_at")
        .eq("id", profile.id)
        .maybeSingle();

      if (profileError) {
        console.error("[useSubscriptionStatus] Error fetching profile:", profileError);
      }

      // ✅ Si is_premium es true, el usuario es Premium (Google Play/RevenueCat)
      if (profileData?.is_premium === true) {
        console.log("[useSubscriptionStatus] ✅ Usuario Premium detectado (Google Play/RevenueCat)");
        setSubscription({
          id: 'revenuecat_premium',
          status: 'active',
          source: 'revenuecat',
          is_premium: true,
        });
        setStatus('active');
        setIsLoading(false);
        return;
      }

      // Si no es premium, verificar período de gracia (solo si tiene business_id)
      if (profile?.business_id) {
        const { data: businessData } = await supabase
          .from("businesses")
          .select("created_at")
          .eq("id", profile.business_id)
          .maybeSingle();

        const createdDates = [
          profileData?.created_at,
          businessData?.created_at,
        ].filter(Boolean) as string[];

        if (createdDates.length > 0) {
          const oldestDate = new Date(Math.min(...createdDates.map(d => new Date(d).getTime())));
          const daysSinceCreation = (new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);
          
          // Si el usuario tiene menos de 10 días, dar período de gracia
          if (daysSinceCreation < 10) {
            const remainingDays = Math.ceil(10 - daysSinceCreation);
            console.log(`[useSubscriptionStatus] Usuario nuevo detectado. Días restantes de gracia: ${remainingDays}`);
            
            setSubscription({
              id: 'grace_period',
              status: 'grace_period',
              grace_period_days_remaining: remainingDays,
              created_at: oldestDate.toISOString(),
            });
            setStatus('grace_period');
            setIsLoading(false);
            return;
          }
        }

        // ✅ Fallback: Verificar business_subscriptions (Stripe/PayPal) solo si NO es premium
        // Esto es secundario, no bloquea el acceso si is_premium = true
        if (skipCache) {
          const { data: subscriptionData, error: subscriptionError } = await supabase
            .from("business_subscriptions" as any)
            .select("*")
            .eq("business_id", profile.business_id)
            .maybeSingle();

          if (subscriptionError && subscriptionError.code !== 'PGRST116') {
            console.error("[useSubscriptionStatus] Error fetching business_subscriptions:", subscriptionError);
          }

          if (subscriptionData) {
            // Si hay suscripción de Stripe/PayPal, usarla como información adicional
            setSubscription({
              ...subscriptionData,
              source: 'stripe_paypal',
            });
            setStatus((subscriptionData.status || 'inactive') as SubscriptionStatus);
            setIsLoading(false);
            return;
          }
        }
      }

      // Si no hay is_premium ni business_subscriptions, no hay suscripción
      setStatus('no_subscription');
      setSubscription(null);
    } catch (error) {
      console.error("Error in fetchSubscription:", error);
      setStatus('inactive');
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id, profile?.business_id]);

  useEffect(() => {
    fetchSubscription();

    if (!profile?.id) return;

    // ✅ LISTENER PRINCIPAL: Escuchar cambios en profiles.is_premium (Google Play/RevenueCat)
    const profileChannel = supabase
      .channel(`profile-premium-${profile.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          const oldIsPremium = (payload.old as any)?.is_premium;
          const newIsPremium = (payload.new as any)?.is_premium;
          
          // Solo reaccionar si is_premium cambió
          if (oldIsPremium !== newIsPremium) {
            console.log(`[useSubscriptionStatus] 🔔 is_premium cambió: ${oldIsPremium} → ${newIsPremium}`);
            // Refrescar estado inmediatamente
            fetchSubscription(true);
          }
        }
      )
      .subscribe();

    // ✅ LISTENER SECUNDARIO: Escuchar cambios en business_subscriptions (Stripe/PayPal)
    // Solo si el usuario tiene business_id
    let subscriptionChannel: any = null;
    if (profile?.business_id) {
      subscriptionChannel = supabase
        .channel(`subscription-${profile.business_id}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "business_subscriptions" as any,
            filter: `business_id=eq.${profile.business_id}`,
          },
          async (payload) => {
            // Solo actualizar si NO es premium (para no sobrescribir el estado premium)
            const { data: currentProfile } = await supabase
              .from("profiles")
              .select("is_premium")
              .eq("id", profile.id)
              .maybeSingle();
            
            if (currentProfile?.is_premium !== true) {
              if (payload.eventType === "DELETE") {
                setSubscription(null);
                setStatus('no_subscription');
              } else if (payload.new) {
                const newData = payload.new as any;
                setSubscription({
                  ...newData,
                  source: 'stripe_paypal',
                });
                setStatus((newData.status || 'inactive') as SubscriptionStatus);
                setIsLoading(false);
              }
            }
          }
        )
        .subscribe();
    }

    return () => {
      profileChannel.unsubscribe();
      if (subscriptionChannel) {
        subscriptionChannel.unsubscribe();
      }
    };
  }, [profile?.id, profile?.business_id, fetchSubscription]);

  return {
    status,
    isLoading,
    subscription,
    refetchSubscription: (skipCache: boolean = true) => fetchSubscription(skipCache),
  };
}

