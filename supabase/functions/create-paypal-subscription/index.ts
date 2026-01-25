import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface CreatePayPalSubscriptionRequest {
  business_id: string;
  owner_id: string;
  subscription_id?: string; // Opcional: si no se proporciona, se crea una nueva
  paypal_subscription_id?: string; // Opcional: si se proporciona, solo sincroniza con nuestra BD
  is_native?: boolean; // Si es true, usa deep links para mobile
}

// PayPal API configuration
const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID') || 'AVQv1quFb4J_F3k4jcCIDd_ZtCvvOm0ofl8eSVRu3gWRIp0Yod2VDnuhKVGGmzVF5BSN0Est6H_y5n_A';
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET');
// CRÍTICO: PLAN_ID ahora viene de variables de entorno para facilitar cambio entre sandbox/live y planes
const PAYPAL_PLAN_ID = Deno.env.get('PAYPAL_PLAN_ID');
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

// Create PayPal subscription
async function createPayPalSubscription(
  accessToken: string,
  businessId: string,
  subscriptionId: string,
  returnUrl: string,
  cancelUrl: string
): Promise<{ approval_url: string; subscription_id: string }> {
  // Construir payload según documentación de PayPal Subscriptions API
  // IMPORTANTE: PayPal requiere que subscriber.email_address esté presente o se omita completamente
  // Si está vacío, puede causar INVALID_REQUEST
  const payload: any = {
    plan_id: PAYPAL_PLAN_ID,
    start_time: new Date(Date.now() + 60000).toISOString(), // Start in 1 minute
    application_context: {
      brand_name: 'Bookwise Partner',
      locale: 'es-US',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  // Solo incluir subscriber si hay email (PayPal lo llenará durante approval si no está)
  // PayPal puede rechazar email_address vacío, así que lo omitimos
  // subscriber se llenará automáticamente cuando el usuario apruebe

  // custom_id para mapeo en webhook (máximo 127 caracteres según PayPal)
  const customId = `${businessId}:${subscriptionId}`;
  if (customId.length <= 127) {
    payload.custom_id = customId;
  } else {
    // Si es muy largo, usar solo subscriptionId
    payload.custom_id = subscriptionId;
  }
  
  // Log del payload completo antes de enviar
  console.log('[createPayPalSubscription] 📤 Payload completo a enviar:', JSON.stringify(payload, null, 2));
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `PayPal subscription creation failed: ${errorText}`;
    let errorDetails: any = {};
    
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = `PayPal subscription creation failed: ${errorJson.message || errorJson.name || JSON.stringify(errorJson)}`;
      errorDetails = errorJson;
      
      console.error('[createPayPalSubscription] ❌ PayPal API Error (JSON):', {
        status: response.status,
        statusText: response.statusText,
        error: errorJson,
        plan_id: PAYPAL_PLAN_ID,
        payload_sent: JSON.stringify(payload, null, 2),
      });
    } catch {
      console.error('[createPayPalSubscription] ❌ PayPal API Error (raw):', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        plan_id: PAYPAL_PLAN_ID,
        payload_sent: JSON.stringify(payload, null, 2),
      });
    }
    
    // Log del payload completo para debugging
    console.error('[createPayPalSubscription] 📤 Payload que causó el error:', JSON.stringify(payload, null, 2));
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log('[createPayPalSubscription] PayPal response:', {
    subscription_id: data.id,
    status: data.status,
    links_count: data.links?.length || 0,
  });
  
  // Find approval link - PayPal puede usar 'approve' o 'payer-action'
  const approvalLink = data.links?.find((link: any) => 
    link.rel === 'approve' || link.rel === 'payer-action'
  );
  
  if (!approvalLink) {
    console.error('[createPayPalSubscription] No approval link found. Available links:', data.links);
    throw new Error(`PayPal approval URL not found in response. Available links: ${JSON.stringify(data.links)}`);
  }

  console.log('[createPayPalSubscription] Approval URL found:', approvalLink.href);

  return {
    approval_url: approvalLink.href,
    subscription_id: data.id,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[create-paypal-subscription] 📥 Request recibido');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[create-paypal-subscription] ❌ Variables de entorno faltantes');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Supabase configuration missing' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[create-paypal-subscription] 🔑 Verificando credenciales PayPal...', {
      hasClientId: !!PAYPAL_CLIENT_ID,
      hasClientSecret: !!PAYPAL_CLIENT_SECRET,
      planId: PAYPAL_PLAN_ID,
      baseUrl: PAYPAL_BASE_URL,
      clientIdLength: PAYPAL_CLIENT_ID?.length || 0,
    });

    if (!PAYPAL_CLIENT_ID) {
      console.error('[create-paypal-subscription] ❌ PayPal client ID missing');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'PayPal client ID not configured. Please set PAYPAL_CLIENT_ID in Supabase Secrets.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!PAYPAL_CLIENT_SECRET) {
      console.error('[create-paypal-subscription] ❌ PayPal client secret missing');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'PayPal client secret not configured. Please set PAYPAL_CLIENT_SECRET in Supabase Secrets.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRÍTICO: Validar que PAYPAL_PLAN_ID esté configurado en variables de entorno
    if (!PAYPAL_PLAN_ID || PAYPAL_PLAN_ID.length < 10) {
      console.error('[create-paypal-subscription] ❌ PayPal plan ID no configurado o inválido:', PAYPAL_PLAN_ID);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `PayPal plan ID no configurado. Por favor, configura PAYPAL_PLAN_ID en las variables de entorno de Supabase.` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: CreatePayPalSubscriptionRequest;
    try {
      body = await req.json();
      console.log('[create-paypal-subscription] 📋 Body parseado:', {
        hasBusinessId: !!body.business_id,
        hasOwnerId: !!body.owner_id,
        hasSubscriptionId: !!body.subscription_id,
        hasPaypalSubscriptionId: !!body.paypal_subscription_id,
      });
    } catch (error: any) {
      console.error('[create-paypal-subscription] ❌ Error parseando JSON:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid JSON in request body: ${error.message}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { business_id, owner_id, subscription_id, paypal_subscription_id } = body;

    if (!business_id || !owner_id) {
      console.error('Missing required parameters:', { business_id: !!business_id, owner_id: !!owner_id });
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters: business_id and owner_id are required' }),
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

    // Buscar o crear suscripción
    let subscriptionData;
    let finalSubscriptionId: string;

    if (subscription_id) {
      // Si se proporciona subscription_id, verificar que existe
      const { data: existingSubscription, error: subscriptionError } = await supabase
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

      if (!existingSubscription) {
        console.error('Subscription not found:', subscription_id);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Suscripción no encontrada. Verifica que el subscription_id sea correcto.' 
          }),
          { status: 404, headers: corsHeaders }
        );
      }

      subscriptionData = existingSubscription;
      finalSubscriptionId = subscription_id;
    } else {
      // Si no se proporciona subscription_id, buscar una existente o crear una nueva
      const { data: existingSubscription, error: subscriptionError } = await supabase
        .from('business_subscriptions')
        .select('*')
        .eq('business_id', business_id)
        .maybeSingle();

      if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        console.error('Error fetching subscription:', subscriptionError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Error al obtener información de la suscripción: ${subscriptionError.message}` 
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      if (existingSubscription) {
        subscriptionData = existingSubscription;
        finalSubscriptionId = existingSubscription.id;
      } else {
        // Crear nueva suscripción con service role (bypass RLS)
        const { data: newSubscription, error: createError } = await supabase
          .from('business_subscriptions')
          .insert({
            business_id: business_id,
            owner_id: owner_id,
            status: 'inactive',
            subscription_plan: 'monthly',
            monthly_fee: 9.50,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating subscription:', createError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Error al crear la suscripción: ${createError.message}` 
            }),
            { status: 500, headers: corsHeaders }
          );
        }

        subscriptionData = newSubscription;
        finalSubscriptionId = newSubscription.id;
      }
    }

    // Si ya tenemos el paypal_subscription_id, solo sincronizar con nuestra BD
    if (paypal_subscription_id) {
      console.log('Sincronizando suscripción existente de PayPal:', paypal_subscription_id);
      
      const { error: updateError } = await supabase
        .from('business_subscriptions')
        .update({
          paypal_subscription_id: paypal_subscription_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', finalSubscriptionId);

      if (updateError) {
        console.error('Error updating subscription with PayPal ID:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Error al sincronizar suscripción: ${updateError.message}` 
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          paypal_subscription_id: paypal_subscription_id,
          subscription_id: finalSubscriptionId,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Si no tenemos paypal_subscription_id, crear uno nuevo en PayPal
    console.log('[create-paypal-subscription] Creando nueva suscripción en PayPal...', {
      business_id,
      subscription_id: finalSubscriptionId,
      plan_id: PAYPAL_PLAN_ID,
    });

    // Obtener access token de PayPal
    let accessToken: string;
    try {
      accessToken = await getPayPalAccessToken();
      console.log('[create-paypal-subscription] ✅ Access token obtenido');
    } catch (error: any) {
      console.error('[create-paypal-subscription] ❌ Error obteniendo access token:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Error obteniendo token de PayPal: ${error.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // URLs de retorno - usar HTTPS App Links directamente
    // PayPal redirige a www.miturnow.com, que luego abre la app via Android App Links
    // IMPORTANTE: PayPal puede tener URLs hardcodeadas en el plan, pero forzamos estas URLs
    // en application_context para que las use en lugar de las del plan
    const returnUrl = 'https://www.miturnow.com/paypal/success';
    const cancelUrl = 'https://www.miturnow.com/paypal/cancel';
    console.log('[create-paypal-subscription] 🔗 URLs de retorno forzadas:', { returnUrl, cancelUrl });

    // Crear suscripción en PayPal
    let paypalSubscription: { approval_url: string; subscription_id: string };
    try {
      paypalSubscription = await createPayPalSubscription(
        accessToken,
        business_id,
        finalSubscriptionId,
        returnUrl,
        cancelUrl
      );
      console.log('[create-paypal-subscription] ✅ Suscripción creada en PayPal:', {
        paypal_subscription_id: paypalSubscription.subscription_id,
        approval_url: paypalSubscription.approval_url,
      });
    } catch (error: any) {
      console.error('[create-paypal-subscription] ❌ Error creando suscripción en PayPal:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Error creando suscripción en PayPal: ${error.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NO activar suscripción aquí - solo guardar el ID de PayPal para referencia
    // La activación SOLO ocurre cuando el webhook confirma el pago
    const { error: updateError } = await supabase
      .from('business_subscriptions')
      .update({
        paypal_subscription_id: paypalSubscription.subscription_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', finalSubscriptionId);

    if (updateError) {
      console.error('Error updating subscription with PayPal ID:', updateError);
      // No fallamos aquí, solo registramos el error
    }

    return new Response(
      JSON.stringify({
        success: true,
        approval_url: paypalSubscription.approval_url,
        paypal_subscription_id: paypalSubscription.subscription_id,
        subscription_id: finalSubscriptionId, // Retornar el ID interno para referencia
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    // Log detallado del error
    const errorDetails = {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Error',
      stack: error?.stack,
      toString: error?.toString?.(),
    };
    
    console.error('[create-paypal-subscription] ❌ ERROR NO MANEJADO:', errorDetails);
    console.error('[create-paypal-subscription] ❌ Error completo:', JSON.stringify(errorDetails, null, 2));
    
    // Asegurar que siempre retornamos JSON válido con mensaje claro
    let errorMessage = 'Internal server error';
    if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.toString) {
      errorMessage = error.toString();
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        error_type: error?.name || 'UnknownError',
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

