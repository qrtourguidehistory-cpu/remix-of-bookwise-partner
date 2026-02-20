import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * ✅ ID del entitlement premium — debe coincidir con el RevenueCat Dashboard.
 * Actualmente configurado como: 'partner_mensual_pro'
 */
const PREMIUM_ENTITLEMENT_ID = 'partner_mensual_pro';

interface RevenueCatEvent {
  event: {
    id: string;
    type: string;
    app_user_id: string;
    aliases?: string[];
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
 * Eventos que activan is_premium = true
 */
const PREMIUM_ACTIVE_EVENTS = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'REACTIVATION',
  'UNCANCELLATION',
  'SUBSCRIPTION_EXTENDED',
];

/**
 * Eventos que desactivan is_premium = false
 */
const PREMIUM_INACTIVE_EVENTS = [
  'CANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_PAUSED',
];

// Regex para validar UUID v4
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed. Only POST accepted.' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[RC Webhook] ❌ Variables de entorno no configuradas');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: RevenueCatEvent = await req.json();

    const eventType = body?.event?.type;
    const appUserId = body?.event?.app_user_id;
    const aliases = body?.event?.aliases ?? [];

    console.log('[RC Webhook] 📥 Evento recibido:', {
      eventType,
      appUserId,
      aliases,
      productId: body?.event?.product_id,
      environment: body?.event?.environment,
    });

    if (!eventType || !appUserId) {
      console.error('[RC Webhook] ❌ Estructura de evento inválida:', body);
      return new Response(
        JSON.stringify({ success: false, error: 'Missing event.type or event.app_user_id' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ── Determinar isPremium ────────────────────────────────────────────────────
    let isPremium: boolean | null = null;
    if (PREMIUM_ACTIVE_EVENTS.includes(eventType)) {
      isPremium = true;
    } else if (PREMIUM_INACTIVE_EVENTS.includes(eventType)) {
      isPremium = false;
    } else {
      console.log(`[RC Webhook] ℹ️ Evento '${eventType}' ignorado (no afecta premium).`);
      return new Response(
        JSON.stringify({ success: true, message: `Event ${eventType} ignored.`, skipped: true }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ── Buscar el UUID de Supabase ──────────────────────────────────────────────
    // RevenueCat envía app_user_id que puede ser el UUID de Supabase o un $RCAnonymousID.
    // También incluimos aliases para cubrir el caso de compra anónima migrada a UUID.
    const candidateIds = [appUserId, ...aliases].filter(
      (id) => typeof id === 'string' && uuidRegex.test(id)
    );

    console.log('[RC Webhook] 🔍 UUID candidatos:', candidateIds);

    if (candidateIds.length === 0) {
      console.error(`[RC Webhook] ❌ Ningún UUID válido encontrado. app_user_id: ${appUserId}, aliases: ${aliases}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No valid UUID found in app_user_id or aliases. Did the user log in before purchasing?',
          appUserId,
          aliases,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ── Actualizar todos los perfiles candidatos ────────────────────────────────
    let updatedCount = 0;
    const errors: string[] = [];

    for (const uuid of candidateIds) {
      // Verificar que el perfil existe antes de actualizar
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, is_premium')
        .eq('id', uuid)
        .maybeSingle();

      if (!existingProfile) {
        console.warn(`[RC Webhook] ⚠️ Perfil no encontrado para UUID: ${uuid}`);
        continue;
      }

      console.log(`[RC Webhook] 🔄 Actualizando perfil ${uuid}: is_premium = ${isPremium} (antes: ${existingProfile.is_premium})`);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          is_premium: isPremium,
          updated_at: new Date().toISOString(),
        })
        .eq('id', uuid);

      if (updateError) {
        console.error(`[RC Webhook] ❌ Error actualizando ${uuid}:`, updateError);
        errors.push(`${uuid}: ${updateError.message}`);
      } else {
        console.log(`[RC Webhook] ✅ Perfil ${uuid} → is_premium = ${isPremium}`);
        updatedCount++;
      }
    }

    if (updatedCount === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No profiles were updated.',
          candidateIds,
          errors,
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        eventType,
        isPremium,
        updatedProfiles: updatedCount,
        candidateIds,
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[RC Webhook] ❌ Error inesperado:', error?.message);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
