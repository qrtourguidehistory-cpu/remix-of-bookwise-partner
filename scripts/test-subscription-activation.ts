/**
 * Script de prueba para activar manualmente una suscripción
 * 
 * Uso:
 * 1. Obtén el business_id y subscription_id de tu base de datos
 * 2. Ejecuta: npx tsx scripts/test-subscription-activation.ts <business_id> <subscription_id>
 * 
 * Este script actualiza manualmente el estado de una suscripción a 'active'
 * para probar que el SubscriptionGuard funciona correctamente.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rdznelijpliklisnflfm.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_ANON_KEY no está configurado');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function activateSubscription(businessId: string, subscriptionId: string) {
  console.log('🔧 Activando suscripción manualmente...');
  console.log('📋 Business ID:', businessId);
  console.log('📋 Subscription ID:', subscriptionId);

  try {
    // Verificar que la suscripción existe
    const { data: existing, error: fetchError } = await supabase
      .from('business_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Error al buscar suscripción:', fetchError);
      return;
    }

    if (!existing) {
      console.error('❌ Suscripción no encontrada');
      return;
    }

    console.log('📊 Estado actual:', existing.status);

    // Actualizar a 'active'
    const { data: updated, error: updateError } = await supabase
      .from('business_subscriptions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error al actualizar:', updateError);
      return;
    }

    console.log('✅ Suscripción activada exitosamente!');
    console.log('📊 Nuevo estado:', updated.status);
    console.log('🎉 El SubscriptionGuard debería quitar el bloqueo morado ahora');
  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

// Obtener argumentos de la línea de comandos
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('❌ Uso: npx tsx scripts/test-subscription-activation.ts <business_id> <subscription_id>');
  process.exit(1);
}

const [businessId, subscriptionId] = args;
activateSubscription(businessId, subscriptionId);

