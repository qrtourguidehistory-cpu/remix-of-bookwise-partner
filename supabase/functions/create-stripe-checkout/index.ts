import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface CreateStripeCheckoutRequest {
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

    const body: CreateStripeCheckoutRequest = await req.json();
    const { business_id, subscription_id } = body;


    if (!business_id || !subscription_id) {
      console.error('Missing required parameters:', { business_id: !!business_id, subscription_id: !!subscription_id });
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters: business_id and subscription_id are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verificar que el negocio existe
    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', business_id)
      .maybeSingle();

    if (businessError) {
      console.error('Error fetching business:', businessError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Error al obtener información del negocio: ${businessError.message}` 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!businessData) {
      console.error('Business not found:', business_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Negocio no encontrado. Verifica que el business_id sea correcto.' 
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Verificar que la suscripción existe
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('business_subscriptions')
      .select('*')
      .eq('id', subscription_id)
      .eq('business_id', business_id)
      .maybeSingle();

    if (subscriptionError) {
      console.error('Error fetching subscription:', subscriptionError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Error al obtener información de la suscripción: ${subscriptionError.message}` 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!subscriptionData) {
      console.error('Subscription not found:', subscription_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Suscripción no encontrada. Verifica que el subscription_id sea correcto.' 
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Obtener la URL de Supabase para la Edge Function de redirección
    const redirectBaseUrl = `${supabaseUrl}/functions/v1/stripe-return`;
    
    const successUrl = `${redirectBaseUrl}?status=success&session_id={CHECKOUT_SESSION_ID}`;
    
    // Crear sesión de Checkout de Stripe
    // Plan mensual de $9.50 USD
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: subscriptionData.subscription_plan || 'Suscripción Mensual',
              description: 'Suscripción mensual de Bookwise Partner',
            },
            recurring: {
              interval: 'month',
            },
            unit_amount: 950, // $9.50 USD en centavos
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: `${redirectBaseUrl}?status=cancel`,
      metadata: {
        business_id: business_id,
        subscription_id: subscription_id,
      },
      subscription_data: {
        metadata: {
          business_id: business_id,
          subscription_id: subscription_id,
        },
      },
    });


    // Actualizar la suscripción con el session_id (opcional, para referencia)
    const { error: updateError } = await supabase
      .from('business_subscriptions')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription_id);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      // No fallamos aquí, solo registramos el error ya que la sesión ya fue creada
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: checkoutSession.url,
        session_id: checkoutSession.id,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Error in create-stripe-checkout:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

