import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'inactive' | 'loading' | 'no_subscription';

interface UseSubscriptionStatusResult {
  status: SubscriptionStatus;
  isLoading: boolean;
  subscription: any | null;
  refetchSubscription: () => Promise<void>;
}

export function useSubscriptionStatus(): UseSubscriptionStatusResult {
  const { profile } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>('loading');
  const [subscription, setSubscription] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!profile?.business_id) {
      setStatus('no_subscription');
      setIsLoading(false);
      setSubscription(null);
      return;
    }

    setIsLoading(true);
    try {
      let { data, error } = await supabase
        .from("business_subscriptions")
        .select("*")
        .eq("business_id", profile.business_id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching subscription:", error);
        setStatus('inactive');
        setSubscription(null);
      } else if (!data) {
        // Si no existe suscripción, crear una automáticamente con estado 'inactive'
        console.log("No subscription found, creating default subscription...");
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

        if (createError) {
          console.error("Error creating default subscription:", createError);
          setStatus('inactive');
          setSubscription(null);
        } else {
          setSubscription(newSubscription);
          setStatus(newSubscription.status || 'inactive');
        }
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
          console.log('🔄 Subscription status changed via realtime:', payload);
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
        console.log('📡 Subscription realtime channel status:', status);
      });

    return () => {
      subscriptionChannel.unsubscribe();
    };
  }, [profile?.business_id, fetchSubscription]);

  return {
    status,
    isLoading,
    subscription,
    refetchSubscription: fetchSubscription,
  };
}

