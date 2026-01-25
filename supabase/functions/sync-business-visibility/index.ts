import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Content-Type': 'application/json',
};

/**
 * Edge Function que sincroniza is_public basado en el estado real de la suscripción
 * Usa service role para bypass RLS y garantizar actualización correcta
 * 
 * Lógica: visible ⇔ subscription.status IN ('active', 'trialing')
 */
serve(async (req) => {
  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Crear cliente con service role (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[sync-business-visibility] Iniciando sincronización de visibilidad...');

    // Obtener todas las suscripciones activas o en trial
    const { data: activeSubscriptions, error: subError } = await supabase
      .from('business_subscriptions')
      .select('business_id, status')
      .in('status', ['active', 'trialing']);

    if (subError) {
      console.error('[sync-business-visibility] Error obteniendo suscripciones:', subError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error obteniendo suscripciones',
          details: subError.message 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`[sync-business-visibility] Encontradas ${activeSubscriptions?.length || 0} suscripciones activas/trialing`);

    // Obtener todos los business_ids con suscripciones (activas o no)
    const { data: allSubscriptions, error: allSubError } = await supabase
      .from('business_subscriptions')
      .select('business_id, status');

    if (allSubError) {
      console.error('[sync-business-visibility] Error obteniendo todas las suscripciones:', allSubError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error obteniendo todas las suscripciones',
          details: allSubError.message 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Crear map de business_id -> debe ser visible
    const shouldBeVisible = new Set<string>();
    (activeSubscriptions || []).forEach((sub: any) => {
      if (sub.business_id) {
        shouldBeVisible.add(sub.business_id);
      }
    });

    // Crear set de todos los business_ids con suscripciones
    const allBusinessIdsWithSubscriptions = new Set<string>();
    (allSubscriptions || []).forEach((sub: any) => {
      if (sub.business_id) {
        allBusinessIdsWithSubscriptions.add(sub.business_id);
      }
    });

    console.log(`[sync-business-visibility] Business IDs que deben ser visibles: ${shouldBeVisible.size}`);
    console.log(`[sync-business-visibility] Total business IDs con suscripciones: ${allBusinessIdsWithSubscriptions.size}`);

    // Actualizar: hacer visibles los que tienen suscripción activa/trialing
    let visibleUpdated = 0;
    if (shouldBeVisible.size > 0) {
      const businessIdsArray = Array.from(shouldBeVisible);
      console.log(`[sync-business-visibility] Intentando actualizar ${businessIdsArray.length} establecimientos:`, businessIdsArray);
      
      const { data: updateData, error: visibleError } = await supabase
        .from('businesses')
        .update({ 
          is_public: true, 
          updated_at: new Date().toISOString() 
        })
        .in('id', businessIdsArray)
        .select('id, business_name, is_public');

      if (visibleError) {
        console.error('[sync-business-visibility] Error actualizando visibles:', visibleError);
        console.error('[sync-business-visibility] Detalles del error:', JSON.stringify(visibleError, null, 2));
      } else {
        visibleUpdated = updateData?.length || 0;
        console.log(`[sync-business-visibility] ✅ Actualizados ${visibleUpdated} establecimientos como visibles`);
        console.log(`[sync-business-visibility] Establecimientos actualizados:`, updateData);
      }
    }

    // Actualizar: hacer NO visibles los que tienen suscripción pero NO están activos/trialing
    let hiddenUpdated = 0;
    const shouldBeHidden = Array.from(allBusinessIdsWithSubscriptions).filter(
      id => !shouldBeVisible.has(id)
    );

    if (shouldBeHidden.length > 0) {
      const { error: hiddenError } = await supabase
        .from('businesses')
        .update({ 
          is_public: false, 
          updated_at: new Date().toISOString() 
        })
        .in('id', shouldBeHidden);

      if (hiddenError) {
        console.error('[sync-business-visibility] Error actualizando no visibles:', hiddenError);
      } else {
        hiddenUpdated = shouldBeHidden.length;
        console.log(`[sync-business-visibility] ✅ Actualizados ${hiddenUpdated} establecimientos como no visibles`);
      }
    }

    // Verificar resultado
    const { data: verification, error: verifyError } = await supabase
      .from('businesses')
      .select('id, business_name, is_public')
      .in('id', Array.from(allBusinessIdsWithSubscriptions))
      .limit(10);

    console.log('[sync-business-visibility] Verificación de muestra:', verification);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Visibilidad sincronizada correctamente',
        stats: {
          visibleUpdated,
          hiddenUpdated,
          totalProcessed: allBusinessIdsWithSubscriptions.size,
        },
        sample: verification,
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[sync-business-visibility] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Error interno del servidor' 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

