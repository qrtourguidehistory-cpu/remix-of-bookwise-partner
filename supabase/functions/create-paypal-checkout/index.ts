import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface CreatePayPalCheckoutRequest {
  user_id: string;
  amount: number;
}

// PayPal API configuration
const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET');
const PAYPAL_BASE_URL = Deno.env.get('PAYPAL_MODE') === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

// Get PayPal access token
async function getPayPalAccessToken(): Promise<string> {
  console.log('[create-paypal-checkout] 🔑 Iniciando obtención de access token de PayPal');
  console.log('[create-paypal-checkout] PayPal Base URL:', PAYPAL_BASE_URL);
  console.log('[create-paypal-checkout] PayPal Client ID configurado:', !!PAYPAL_CLIENT_ID);
  console.log('[create-paypal-checkout] PayPal Client Secret configurado:', !!PAYPAL_CLIENT_SECRET);

  if (!PAYPAL_CLIENT_ID) {
    const error = 'PAYPAL_CLIENT_ID no está configurado. Por favor, configura PAYPAL_CLIENT_ID en Supabase Secrets.';
    console.error('[create-paypal-checkout] ❌', error);
    throw new Error(error);
  }

  if (!PAYPAL_CLIENT_SECRET) {
    const error = 'PAYPAL_CLIENT_SECRET no está configurado. Por favor, configura PAYPAL_CLIENT_SECRET en Supabase Secrets.';
    console.error('[create-paypal-checkout] ❌', error);
    throw new Error(error);
  }

  try {
    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
    console.log('[create-paypal-checkout] 📡 Enviando petición a PayPal para obtener token...');
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    console.log('[create-paypal-checkout] 📥 Respuesta de PayPal - Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[create-paypal-checkout] ❌ Error de PayPal al obtener token:', errorText);
      throw new Error(`PayPal auth failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log('[create-paypal-checkout] ✅ Token obtenido exitosamente');
    return data.access_token;
  } catch (error: any) {
    console.error('[create-paypal-checkout] ❌ Excepción al obtener token:', error.message);
    throw error;
  }
}

// Create PayPal order for one-time payment
async function createPayPalOrder(
  accessToken: string,
  amountString: string,
  returnUrl: string,
  cancelUrl: string
): Promise<{ approval_url: string; order_id: string }> {
  console.log('[create-paypal-checkout] 🛒 Iniciando creación de orden en PayPal');
  console.log('[create-paypal-checkout] Monto:', amountString);
  console.log('[create-paypal-checkout] Return URL:', returnUrl);
  console.log('[create-paypal-checkout] Cancel URL:', cancelUrl);

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: amountString, // Ya viene como string con dos decimales
          },
        },
      ],
      payment_source: {
        card: {
          experience_context: {
            landing_page: 'GUEST_CHECKOUT',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    };

  console.log('[create-paypal-checkout] 📦 Payload de la orden:', JSON.stringify(orderPayload, null, 2));

  try {
    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(orderPayload),
    });

    console.log('[create-paypal-checkout] 📥 Respuesta de PayPal - Status:', response.status, response.statusText);
    console.log('[create-paypal-checkout] 📥 Headers de respuesta:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('[create-paypal-checkout] 📥 Cuerpo de respuesta (raw):', responseText);

    if (!response.ok) {
      let errorMessage = `PayPal order creation failed (${response.status}): ${responseText}`;
      try {
        const errorJson = JSON.parse(responseText);
        console.error('[create-paypal-checkout] ❌ Error detallado de PayPal:', JSON.stringify(errorJson, null, 2));
        errorMessage = `PayPal error (${response.status}): ${JSON.stringify(errorJson)}`;
      } catch {
        // Si no es JSON, usar el texto plano
        console.error('[create-paypal-checkout] ❌ Error de PayPal (texto):', responseText);
      }
      throw new Error(errorMessage);
    }

    const data = JSON.parse(responseText);
    console.log('[create-paypal-checkout] ✅ Orden creada exitosamente');
    console.log('[create-paypal-checkout] Order ID:', data.id);
    console.log('[create-paypal-checkout] Links disponibles:', data.links?.map((l: any) => `${l.rel}: ${l.href}`));
    
    // Find approval link - PayPal usa 'payer-action' o 'approve' para checkout
    const approvalUrl = data.links?.find((l: any) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
    
    if (!approvalUrl) {
      const errorMessage = `PayPal approval URL not found in response. Available links: ${JSON.stringify(data.links, null, 2)}`;
      console.error('[create-paypal-checkout] ❌ No se encontró link de aprobación en la respuesta');
      console.error('[create-paypal-checkout] Links completos:', JSON.stringify(data.links, null, 2));
      console.error('[create-paypal-checkout] Respuesta completa de PayPal:', JSON.stringify(data, null, 2));
      throw new Error(errorMessage);
    }

    console.log('[create-paypal-checkout] ✅ Approval URL encontrada:', approvalUrl);

    // Forzar deshabilitar PayPal en la URL (fallback si la API no lo respeta)
    // Añadir parámetro disable-funding=paypal al final de la URL
    const separator = approvalUrl.includes('?') ? '&' : '?';
    const forcedApprovalUrl = `${approvalUrl}${separator}disable-funding=paypal`;
    console.log('[create-paypal-checkout] 🔧 URL modificada para forzar tarjeta:', forcedApprovalUrl);

    return {
      approval_url: forcedApprovalUrl,
      order_id: data.id,
    };
  } catch (error: any) {
    console.error('[create-paypal-checkout] ❌ Excepción al crear orden:', error.message);
    throw error;
  }
}

serve(async (req) => {
  console.log('[create-paypal-checkout] 🚀 Función invocada');
  console.log('[create-paypal-checkout] Método:', req.method);
  console.log('[create-paypal-checkout] URL:', req.url);

  // Manejar preflight OPTIONS request - DEBE SER LO PRIMERO
  if (req.method === 'OPTIONS') {
    console.log('[create-paypal-checkout] ✅ Respondiendo a OPTIONS (CORS preflight)');
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      } 
    });
  }

  try {
    console.log('[create-paypal-checkout] 📝 Iniciando procesamiento de petición POST');

    // Validar credenciales de PayPal ANTES de procesar el body
    console.log('[create-paypal-checkout] 🔍 Validando credenciales de PayPal...');
    if (!PAYPAL_CLIENT_ID) {
      const error = 'PAYPAL_CLIENT_ID no está configurado en las variables de entorno de Supabase. Por favor, configura PAYPAL_CLIENT_ID en Supabase Secrets.';
      console.error('[create-paypal-checkout] ❌', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!PAYPAL_CLIENT_SECRET) {
      const error = 'PAYPAL_CLIENT_SECRET no está configurado en las variables de entorno de Supabase. Por favor, configura PAYPAL_CLIENT_SECRET en Supabase Secrets.';
      console.error('[create-paypal-checkout] ❌', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-paypal-checkout] ✅ Credenciales de PayPal validadas');

    // Parsear body
    console.log('[create-paypal-checkout] 📦 Parseando body de la petición...');
    let body: CreatePayPalCheckoutRequest;
    try {
      body = await req.json();
      console.log('[create-paypal-checkout] 📦 Body parseado:', JSON.stringify(body));
    } catch (parseError: any) {
      console.error('[create-paypal-checkout] ❌ Error al parsear body:', parseError.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Error al parsear el body de la petición: ${parseError.message}` 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { user_id, amount } = body;

    // Validar parámetros requeridos
    console.log('[create-paypal-checkout] 🔍 Validando parámetros...');
    console.log('[create-paypal-checkout] user_id:', user_id, 'tipo:', typeof user_id);
    console.log('[create-paypal-checkout] amount:', amount, 'tipo:', typeof amount);

    if (!user_id || typeof user_id !== 'string' || user_id.trim() === '') {
      const error = 'user_id es requerido y debe ser un string no vacío';
      console.error('[create-paypal-checkout] ❌', error);
      return new Response(
        JSON.stringify({ success: false, error }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (amount === undefined || amount === null) {
      const error = 'amount es requerido';
      console.error('[create-paypal-checkout] ❌', error);
      return new Response(
        JSON.stringify({ success: false, error }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Convertir amount a número y validar
    const amountNumber = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    console.log('[create-paypal-checkout] amountNumber:', amountNumber);

    if (isNaN(amountNumber)) {
      const error = `amount debe ser un número válido. Recibido: ${amount} (tipo: ${typeof amount})`;
      console.error('[create-paypal-checkout] ❌', error);
      return new Response(
        JSON.stringify({ success: false, error }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (amountNumber <= 0) {
      const error = `amount debe ser mayor que 0. Recibido: ${amountNumber}`;
      console.error('[create-paypal-checkout] ❌', error);
      return new Response(
        JSON.stringify({ success: false, error }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Formatear amount como string con exactamente 2 decimales
    const amountString = amountNumber.toFixed(2);
    console.log('[create-paypal-checkout] ✅ Monto formateado:', amountString);

    // Obtener access token de PayPal
    console.log('[create-paypal-checkout] 🔑 Obteniendo access token de PayPal...');
    let accessToken: string;
    try {
      accessToken = await getPayPalAccessToken();
      console.log('[create-paypal-checkout] ✅ Access token obtenido');
    } catch (tokenError: any) {
      console.error('[create-paypal-checkout] ❌ Error al obtener token:', tokenError.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Error al obtener token de PayPal: ${tokenError.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // URLs de retorno - usar HTTPS App Links directamente
    // PayPal redirige a www.miturnow.com, que luego abre la app via Android App Links
    const returnUrl = 'https://www.miturnow.com/paypal/success';
    const cancelUrl = 'https://www.miturnow.com/paypal/cancel';
    console.log('[create-paypal-checkout] 🔗 URLs de retorno configuradas');
    console.log('[create-paypal-checkout] Return URL:', returnUrl);
    console.log('[create-paypal-checkout] Cancel URL:', cancelUrl);

    // Crear orden en PayPal
    console.log('[create-paypal-checkout] 🛒 Creando orden en PayPal...');
    let paypalOrder: { approval_url: string; order_id: string };
    try {
      paypalOrder = await createPayPalOrder(
        accessToken,
        amountString,
        returnUrl,
        cancelUrl
      );
      console.log('[create-paypal-checkout] ✅ Orden creada exitosamente');
    } catch (orderError: any) {
      console.error('[create-paypal-checkout] ❌ Error al crear orden:', orderError.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Error al crear orden en PayPal: ${orderError.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-paypal-checkout] ✅ Proceso completado exitosamente');
    console.log('[create-paypal-checkout] Approval URL:', paypalOrder.approval_url);
    console.log('[create-paypal-checkout] Order ID:', paypalOrder.order_id);

    return new Response(
      JSON.stringify({
        success: true,
        approval_url: paypalOrder.approval_url,
        order_id: paypalOrder.order_id,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[create-paypal-checkout] ❌ Error general no capturado:', error);
    console.error('[create-paypal-checkout] Stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Error desconocido',
        details: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
