import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'inactive' | 'loading' | 'no_subscription';

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
    if (!profile?.business_id) {
      setStatus('no_subscription');
      setIsLoading(false);
      setSubscription(null);
      return;
    }

    setIsLoading(true);
    try {
      // Si skipCache es true, agregar timestamp para forzar refetch
      let query = supabase
        .from("business_subscriptions")
        .select("*")
        .eq("business_id", profile.business_id);
      
      if (skipCache) {
        // Agregar parámetro único para saltar caché
        query = query.single();
      } else {
        query = query.maybeSingle();
      }
      
      let { data, error } = await query;

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching subscription:", error);
        setStatus('inactive');
        setSubscription(null);
      } else if (!data) {
        // NO crear suscripción automáticamente - se creará cuando el usuario se suscriba vía PayPal o Stripe
        // La creación debe hacerse desde Edge Functions con service role (bypass RLS)
        setStatus('no_subscription');
        setSubscription(null);
      } else {
        setSubscription(data);
        setStatus(data.status || 'inactive');
      }
    } catch (error) {
      console.error("Error in fetchSubscription:", error);
      setStatus('inactive');
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.business_id, profile?.id]);

  useEffect(() => {
    fetchSubscription();

    if (!profile?.business_id) return;

    // Suscribirse a cambios en tiempo real
    const subscriptionChannel = supabase
      .channel(`subscription-${profile.business_id}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "business_subscriptions",
          filter: `business_id=eq.${profile.business_id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setSubscription(null);
            setStatus('no_subscription');
          } else if (payload.new) {
            const newData = payload.new as any;
            setSubscription(newData);
            setStatus(newData.status || 'inactive');
            setIsLoading(false);
          }
        }
      )
      .subscribe((status) => {
      });

    return () => {
      subscriptionChannel.unsubscribe();
    };
  }, [profile?.business_id, fetchSubscription]);

  return {
    status,
    isLoading,
    subscription,
    refetchSubscription: (skipCache: boolean = true) => fetchSubscription(skipCache),
  };
}

