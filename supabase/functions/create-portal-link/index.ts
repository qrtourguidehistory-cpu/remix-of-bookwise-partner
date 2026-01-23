import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface CreatePortalLinkRequest {
  business_id: string;
  subscription_id: string;
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

    const body: CreatePortalLinkRequest = await req.json();
    const { business_id, subscription_id } = body;

    if (!business_id || !subscription_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters: business_id and subscription_id are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verificar que la suscripción existe y obtener el stripe_customer_id
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('business_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', subscription_id)
      .eq('business_id', business_id)
      .maybeSingle();

    if (subscriptionError || !subscriptionData) {
      console.error('Error fetching subscription:', subscriptionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Suscripción no encontrada. Verifica que el subscription_id sea correcto.' 
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (!subscriptionData.stripe_customer_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No hay un cliente de Stripe asociado a esta suscripción.' 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Obtener la URL del sitio desde variables de entorno o usar la URL oficial por defecto
    const siteUrl = Deno.env.get('SITE_URL') || 'https://www.miturnow.com';
    
    // Crear sesión del Customer Portal
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscriptionData.stripe_customer_id as string,
      return_url: `${siteUrl}/admin/subscription`,
    });


    return new Response(
      JSON.stringify({
        success: true,
        portal_url: portalSession.url,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Error in create-portal-link:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

