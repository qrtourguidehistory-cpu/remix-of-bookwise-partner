import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface ConfirmPayPalSubscriptionRequest {
  subscription_id: string;
  token: string; // PayPal approval token
}

// PayPal API configuration
const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID') || 'AVQv1quFb4J_F3k4jcCIDd_ZtCvvOm0ofl8eSVRu3gWRIp0Yod2VDnuhKVGGmzVF5BSN0Est6H_y5n_A';
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET');
const PAYPAL_BASE_URL = Deno.env.get('PAYPAL_MODE') === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

// Get PayPal access token
async function getPayPalAccessToken(): Promise<string> {
  if (!PAYPAL_CLIENT_SECRET) {
    throw new Error('PAYPAL_CLIENT_SECRET not configured');
  }

  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal auth failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Get PayPal subscription details
async function getPayPalSubscription(accessToken: string, subscriptionId: string): Promise<any> {
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal subscription fetch failed: ${error}`);
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!PAYPAL_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'PayPal client secret not configured' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ConfirmPayPalSubscriptionRequest = await req.json();
    const { subscription_id, token } = body;

    if (!subscription_id || !token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters: subscription_id and token are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Obtener la suscripción de nuestra BD
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('business_subscriptions')
      .select('*')
      .eq('id', subscription_id)
      .maybeSingle();

    if (subscriptionError || !subscriptionData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Subscription not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Obtener access token de PayPal
    const accessToken = await getPayPalAccessToken();

    // Obtener detalles de la suscripción de PayPal
    const paypalSubscription = await getPayPalSubscription(accessToken, subscriptionData.paypal_subscription_id || '');

    // Actualizar estado en nuestra BD basado en el estado de PayPal
    const paypalStatus = paypalSubscription.status?.toLowerCase();
    let dbStatus = subscriptionData.status;

    if (paypalStatus === 'active' || paypalStatus === 'trialing') {
      dbStatus = paypalStatus === 'active' ? 'active' : 'trialing';
    }

    const { error: updateError } = await supabase
      .from('business_subscriptions')
      .update({
        status: dbStatus,
        paypal_subscription_id: paypalSubscription.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription_id);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error updating subscription' }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: subscription_id,
        paypal_status: paypalStatus,
        db_status: dbStatus,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Error in confirm-paypal-subscription:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

