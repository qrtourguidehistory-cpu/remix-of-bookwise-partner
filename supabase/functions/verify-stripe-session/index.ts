import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface VerifySessionRequest {
  session_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener la clave secreta de Stripe desde los Secrets de Supabase
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      console.error('Stripe secret key missing');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Stripe secret key not configured. Please set STRIPE_SECRET_KEY in Supabase Secrets.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inicializar Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
    });

    const body: VerifySessionRequest = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameter: session_id is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('Verifying Stripe session:', session_id);

    // Verificar la sesión con Stripe
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id);
    } catch (error: any) {
      console.error('Error retrieving session from Stripe:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid session ID. The payment session does not exist or is invalid.',
          verified: false
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verificar que la sesión es válida y está completada
    if (session.payment_status !== 'paid' && session.payment_status !== 'complete') {
      console.log('Session payment status:', session.payment_status);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Payment not completed. The session has not been paid yet.',
          verified: false,
          payment_status: session.payment_status
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verificar que la sesión es de tipo subscription
    if (session.mode !== 'subscription') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid session type. Expected subscription session.',
          verified: false
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Extraer metadata
    const businessId = session.metadata?.business_id;
    const subscriptionId = session.metadata?.subscription_id || 
                          session.subscription_data?.metadata?.subscription_id;

    if (!businessId || !subscriptionId) {
      console.error('Missing metadata in session:', { businessId, subscriptionId });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Session metadata is incomplete. Cannot verify subscription.',
          verified: false
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verificar que la suscripción existe en Supabase
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('business_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (subscriptionError || !subscriptionData) {
      console.error('Subscription not found in database:', subscriptionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Subscription not found in database.',
          verified: false
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Si la suscripción ya está activa, no hacer nada más
    if (subscriptionData.status === 'active' || subscriptionData.status === 'trialing') {
      console.log('Subscription already active:', subscriptionData.status);
      return new Response(
        JSON.stringify({ 
          success: true, 
          verified: true,
          message: 'Payment verified and subscription is already active.',
          subscription_status: subscriptionData.status
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Obtener información de la suscripción de Stripe
    let stripeSubscription;
    if (session.subscription) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string);
      } catch (error: any) {
        console.error('Error retrieving subscription from Stripe:', error);
      }
    }

    // Actualizar la suscripción en Supabase basándose en los datos de Stripe
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (stripeSubscription) {
      updateData.status = stripeSubscription.status === 'active' ? 'active' : 
                         stripeSubscription.status === 'trialing' ? 'trialing' : 
                         stripeSubscription.status;
      updateData.stripe_subscription_id = stripeSubscription.id;
      updateData.stripe_customer_id = stripeSubscription.customer as string;
      updateData.payment_method = 'stripe';
      
      if (stripeSubscription.current_period_end) {
        updateData.next_payment_date = new Date(stripeSubscription.current_period_end * 1000).toISOString();
        updateData.payment_due_date = updateData.next_payment_date;
      }
      if (stripeSubscription.current_period_start) {
        updateData.last_payment_date = new Date(stripeSubscription.current_period_start * 1000).toISOString();
      }
    } else {
      // Si no podemos obtener la suscripción de Stripe, marcarlo como activo basándonos en el session
      updateData.status = 'active';
      updateData.stripe_subscription_id = session.subscription as string;
      updateData.stripe_customer_id = session.customer as string;
      updateData.payment_method = 'stripe';
    }

    // Actualizar en Supabase
    const { error: updateError } = await supabase
      .from('business_subscriptions')
      .update(updateData)
      .eq('id', subscriptionId)
      .eq('business_id', businessId);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to update subscription in database.',
          verified: true,
          update_error: updateError.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Asegurar que el negocio está público si la suscripción está activa
    if (updateData.status === 'active' && businessId) {
      await supabase
        .from('businesses')
        .update({ is_public: true, updated_at: new Date().toISOString() })
        .eq('id', businessId);
    }

    console.log('Payment verified and subscription updated successfully:', {
      subscriptionId,
      businessId,
      status: updateData.status
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        verified: true,
        message: 'Payment verified and subscription activated successfully.',
        subscription_status: updateData.status,
        subscription_id: subscriptionId,
        business_id: businessId
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Error in verify-stripe-session:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

