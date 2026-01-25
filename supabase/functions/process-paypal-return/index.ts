import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface ProcessPayPalReturnRequest {
  // Para suscripciones
  subscription_id?: string;
  token?: string;
  ba_token?: string;
  
  // Para checkout (pago único)
  order_id?: string;
  payer_id?: string;
  
  // Identificadores
  type: 'subscription' | 'checkout';
  user_id?: string;
  business_id?: string;
}

// PayPal API configuration
const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
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

// Get PayPal order details (para checkout)
async function getPayPalOrder(accessToken: string, orderId: string): Promise<any> {
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal order fetch failed: ${error}`);
  }

  return await response.json();
}

serve(async (req) => {
  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Obtener el token de autorización del header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Authorization header required. This endpoint must be called from the app with user authentication.' 
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Crear cliente de Supabase con el token del usuario
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verificar que el usuario esté autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized. Valid user session required.' 
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log('[process-paypal-return] Usuario autenticado:', user.id);

    if (!PAYPAL_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'PayPal client secret not configured' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const body: ProcessPayPalReturnRequest = await req.json();
    const { subscription_id, token, ba_token, order_id, type, user_id, business_id } = body;

    console.log('[process-paypal-return] Procesando retorno de PayPal:', {
      type,
      hasSubscriptionId: !!subscription_id,
      hasOrderId: !!order_id,
      hasToken: !!(token || ba_token),
    });

    // Obtener access token de PayPal
    const accessToken = await getPayPalAccessToken();

    if (type === 'subscription') {
      // Procesar suscripción
      if (!subscription_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'subscription_id is required for subscription type' }),
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

      // Verificar que el usuario tenga acceso a esta suscripción
      if (subscriptionData.owner_id !== user.id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized access to subscription' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // Obtener detalles de la suscripción de PayPal
      const paypalSubscription = await getPayPalSubscription(
        accessToken, 
        subscriptionData.paypal_subscription_id || ''
      );

      // Actualizar estado en nuestra BD basado en el estado de PayPal
      const paypalStatus = paypalSubscription.status?.toLowerCase();
      let dbStatus = subscriptionData.status;

      if (paypalStatus === 'active' || paypalStatus === 'trialing') {
        dbStatus = paypalStatus === 'active' ? 'active' : 'trialing';
      }

      // Usar service role para actualizar (bypass RLS)
      const supabaseService = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { error: updateError } = await supabaseService
        .from('business_subscriptions')
        .update({
          status: dbStatus,
          paypal_subscription_id: paypalSubscription.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription_id);

      if (updateError) {
        console.error('[process-paypal-return] Error updating subscription:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error updating subscription' }),
          { status: 500, headers: corsHeaders }
        );
      }

      // CRÍTICO: Sincronizar visibilidad usando Edge Function (fuente de verdad)
      // Esto garantiza que la visibilidad se actualice correctamente sin depender de RLS
      try {
        const syncUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-business-visibility`;
        const syncResponse = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!syncResponse.ok) {
          console.error('[process-paypal-return] Error sincronizando visibilidad:', await syncResponse.text());
        } else {
          const syncData = await syncResponse.json();
          console.log('[process-paypal-return] ✅ Visibilidad sincronizada:', syncData);
        }
      } catch (syncError: any) {
        console.error('[process-paypal-return] Error llamando sync-business-visibility:', syncError);
        // No fallar la respuesta principal, solo loguear
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: 'subscription',
          subscription_id: subscription_id,
          paypal_status: paypalStatus,
          db_status: dbStatus,
          message: 'Subscription status synchronized. Webhook will be the source of truth for final confirmation.',
        }),
        { status: 200, headers: corsHeaders }
      );

    } else if (type === 'checkout') {
      // Procesar pago único (checkout)
      if (!order_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'order_id is required for checkout type' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Obtener detalles de la orden de PayPal
      const paypalOrder = await getPayPalOrder(accessToken, order_id);

      console.log('[process-paypal-return] Order status:', paypalOrder.status);

      // Verificar que la orden esté completada
      if (paypalOrder.status !== 'COMPLETED') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Order status is ${paypalOrder.status}, expected COMPLETED`,
            order_status: paypalOrder.status
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Aquí puedes procesar el pago único según tu lógica de negocio
      // Por ejemplo, activar una suscripción, créditos, etc.
      
      return new Response(
        JSON.stringify({
          success: true,
          type: 'checkout',
          order_id: order_id,
          order_status: paypalOrder.status,
          amount: paypalOrder.purchase_units?.[0]?.amount,
          message: 'Payment processed successfully. Webhook will confirm the final status.',
        }),
        { status: 200, headers: corsHeaders }
      );

    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid type. Must be "subscription" or "checkout"' }),
        { status: 400, headers: corsHeaders }
      );
    }

  } catch (error: any) {
    console.error('[process-paypal-return] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

