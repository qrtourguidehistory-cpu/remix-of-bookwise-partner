import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Interfaz para el evento de RevenueCat
 */
interface RevenueCatEvent {
  event: {
    id: string;
    type: string;
    app_user_id: string;
    product_id?: string;
    period_type?: string;
    purchased_at_ms?: number;
    expiration_at_ms?: number;
    environment?: string;
    [key: string]: any;
  };
  api_version?: string;
}

/**
 * Tipos de eventos que activan is_premium = true
 */
const PREMIUM_ACTIVE_EVENTS = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'REACTIVATION',
  'UNCANCELLATION',
];

/**
 * Tipos de eventos que desactivan is_premium = false
 */
const PREMIUM_INACTIVE_EVENTS = [
  'CANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_PAUSED',
];

serve(async (req) => {
  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Solo aceptar POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Method not allowed. Only POST requests are accepted.' 
      }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // Obtener variables de entorno
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [RevenueCat Webhook] Variables de entorno no configuradas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Server configuration error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Crear cliente de Supabase con service role key (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parsear el body del webhook
    const body: RevenueCatEvent = await req.json();
    
    console.log('[RevenueCat Webhook] 📥 Evento recibido:', {
      eventId: body.event?.id,
      eventType: body.event?.type,
      appUserId: body.event?.app_user_id,
      productId: body.event?.product_id,
    });

    // Validar que el evento tenga la estructura esperada
    if (!body.event || !body.event.type || !body.event.app_user_id) {
      console.error('❌ [RevenueCat Webhook] Estructura de evento inválida:', body);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid event structure. Missing required fields: event.type, event.app_user_id' 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const eventType = body.event.type;
    const appUserId = body.event.app_user_id;

    // Validar que app_user_id sea un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(appUserId)) {
      console.error('❌ [RevenueCat Webhook] app_user_id no es un UUID válido:', appUserId);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid app_user_id format. Expected UUID.' 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Determinar el valor de is_premium basado en el tipo de evento
    let isPremium: boolean | null = null;
    let action: string = '';

    if (PREMIUM_ACTIVE_EVENTS.includes(eventType)) {
      isPremium = true;
      action = 'ACTIVAR';
    } else if (PREMIUM_INACTIVE_EVENTS.includes(eventType)) {
      isPremium = false;
      action = 'DESACTIVAR';
    } else {
      // Eventos que no afectan el estado premium (ej: TRIAL_STARTED, TRIAL_CANCELLED, etc.)
      console.log(`ℹ️ [RevenueCat Webhook] Evento ${eventType} no afecta is_premium, ignorando...`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Event ${eventType} does not affect premium status`,
          skipped: true 
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Actualizar el perfil del usuario
    console.log(`🔄 [RevenueCat Webhook] ${action} is_premium para usuario ${appUserId}...`);
    
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ 
        is_premium: isPremium,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appUserId)
      .select('id, is_premium')
      .single();

    if (updateError) {
      // Si el error es que no se encontró el perfil, intentar crear uno básico
      if (updateError.code === 'PGRST116' || updateError.message?.includes('No rows')) {
        console.warn(`⚠️ [RevenueCat Webhook] Perfil no encontrado para ${appUserId}, intentando crear...`);
        
        // Intentar crear el perfil básico
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: appUserId,
            is_premium: isPremium,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id, is_premium')
          .single();

        if (createError) {
          console.error('❌ [RevenueCat Webhook] Error creando perfil:', createError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Failed to create profile: ${createError.message}`,
              details: createError 
            }),
            { status: 500, headers: corsHeaders }
          );
        }

        console.log(`✅ [RevenueCat Webhook] Perfil creado y actualizado:`, {
          userId: newProfile.id,
          isPremium: newProfile.is_premium,
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Profile created and updated',
            userId: newProfile.id,
            isPremium: newProfile.is_premium,
            eventType: eventType,
          }),
          { status: 200, headers: corsHeaders }
        );
      }

      console.error('❌ [RevenueCat Webhook] Error actualizando perfil:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to update profile: ${updateError.message}`,
          details: updateError 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!updatedProfile) {
      console.error('❌ [RevenueCat Webhook] Perfil no encontrado después de actualizar');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Profile not found after update' 
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`✅ [RevenueCat Webhook] Perfil actualizado exitosamente:`, {
      userId: updatedProfile.id,
      isPremium: updatedProfile.is_premium,
      eventType: eventType,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Profile updated successfully',
        userId: updatedProfile.id,
        isPremium: updatedProfile.is_premium,
        eventType: eventType,
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('❌ [RevenueCat Webhook] Error inesperado:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error?.message || 'Internal server error',
        stack: error?.stack 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

