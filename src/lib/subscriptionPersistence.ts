/**
 * Servicio de persistencia para suscripciones pendientes
 * 
 * IMPORTANTE: El deep link miturnow:// solo se usa para feedback visual (toast / banner).
 * La activación de suscripción NUNCA debe depender del deep link.
 * La fuente de verdad es el webhook de Stripe que actualiza la base de datos.
 * El frontend solo sincroniza y refleja ese estado.
 */

import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const PENDING_SUBSCRIPTION_KEY = 'pending_subscription';
const PENDING_BUSINESS_ID_KEY = 'pending_business_id';
const PENDING_PLAN_KEY = 'pending_plan';
const PENDING_TIMESTAMP_KEY = 'pending_timestamp';

export interface PendingSubscription {
  pending: boolean;
  business_id: string;
  plan: string;
  timestamp: number;
}

/**
 * Guardar estado de suscripción pendiente ANTES de abrir Stripe Checkout
 */
export async function savePendingSubscription(businessId: string, plan: string = 'monthly'): Promise<void> {
  const timestamp = Date.now();
  
  try {
    if (Capacitor.isNativePlatform()) {
      // Intentar usar Capacitor Preferences en mobile con fallback
      try {
        await Preferences.set({
          key: PENDING_SUBSCRIPTION_KEY,
          value: 'true',
        });
        await Preferences.set({
          key: PENDING_BUSINESS_ID_KEY,
          value: businessId,
        });
        await Preferences.set({
          key: PENDING_PLAN_KEY,
          value: plan,
        });
        await Preferences.set({
          key: PENDING_TIMESTAMP_KEY,
          value: timestamp.toString(),
        });
        console.log('[SubscriptionPersistence] 💾 Saved via Preferences plugin');
      } catch (prefError) {
        // Fallback a localStorage si Preferences falla
        console.warn('[SubscriptionPersistence] ⚠️ Preferences plugin failed, using localStorage fallback:', prefError);
        localStorage.setItem(PENDING_SUBSCRIPTION_KEY, 'true');
        localStorage.setItem(PENDING_BUSINESS_ID_KEY, businessId);
        localStorage.setItem(PENDING_PLAN_KEY, plan);
        localStorage.setItem(PENDING_TIMESTAMP_KEY, timestamp.toString());
      }
    } else {
      // Usar localStorage en web
      localStorage.setItem(PENDING_SUBSCRIPTION_KEY, 'true');
      localStorage.setItem(PENDING_BUSINESS_ID_KEY, businessId);
      localStorage.setItem(PENDING_PLAN_KEY, plan);
      localStorage.setItem(PENDING_TIMESTAMP_KEY, timestamp.toString());
    }
    
    console.log('[SubscriptionPersistence] 💾 Saved pending subscription:', { businessId, plan, timestamp });
  } catch (error) {
    // Fallback final: siempre usar localStorage si todo falla
    console.error('[SubscriptionPersistence] ❌ Error saving, using localStorage fallback:', error);
    localStorage.setItem(PENDING_SUBSCRIPTION_KEY, 'true');
    localStorage.setItem(PENDING_BUSINESS_ID_KEY, businessId);
    localStorage.setItem(PENDING_PLAN_KEY, plan);
    localStorage.setItem(PENDING_TIMESTAMP_KEY, timestamp.toString());
  }
}

/**
 * Obtener estado de suscripción pendiente
 */
export async function getPendingSubscription(): Promise<PendingSubscription | null> {
  try {
    let pending: string | null;
    let businessId: string | null;
    let plan: string | null;
    let timestamp: string | null;

    if (Capacitor.isNativePlatform()) {
      try {
        const pendingResult = await Preferences.get({ key: PENDING_SUBSCRIPTION_KEY });
        const businessIdResult = await Preferences.get({ key: PENDING_BUSINESS_ID_KEY });
        const planResult = await Preferences.get({ key: PENDING_PLAN_KEY });
        const timestampResult = await Preferences.get({ key: PENDING_TIMESTAMP_KEY });
        
        pending = pendingResult.value;
        businessId = businessIdResult.value;
        plan = planResult.value;
        timestamp = timestampResult.value;
      } catch (prefError) {
        // Fallback a localStorage si Preferences falla
        console.warn('[SubscriptionPersistence] ⚠️ Preferences plugin failed, using localStorage fallback:', prefError);
        pending = localStorage.getItem(PENDING_SUBSCRIPTION_KEY);
        businessId = localStorage.getItem(PENDING_BUSINESS_ID_KEY);
        plan = localStorage.getItem(PENDING_PLAN_KEY);
        timestamp = localStorage.getItem(PENDING_TIMESTAMP_KEY);
      }
    } else {
      pending = localStorage.getItem(PENDING_SUBSCRIPTION_KEY);
      businessId = localStorage.getItem(PENDING_BUSINESS_ID_KEY);
      plan = localStorage.getItem(PENDING_PLAN_KEY);
      timestamp = localStorage.getItem(PENDING_TIMESTAMP_KEY);
    }

    if (pending === 'true' && businessId && timestamp) {
      // Verificar que no sea muy antiguo (más de 1 hora)
      const timestampNum = parseInt(timestamp, 10);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      if (timestampNum < oneHourAgo) {
        console.log('[SubscriptionPersistence] ⏰ Pending subscription expired, clearing');
        await clearPendingSubscription();
        return null;
      }

      return {
        pending: true,
        business_id: businessId,
        plan: plan || 'monthly',
        timestamp: timestampNum,
      };
    }

    return null;
  } catch (error) {
    console.error('[SubscriptionPersistence] ❌ Error getting pending subscription:', error);
    return null;
  }
}

/**
 * Limpiar estado de suscripción pendiente (cuando se confirma o cancela)
 */
export async function clearPendingSubscription(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      try {
        await Preferences.remove({ key: PENDING_SUBSCRIPTION_KEY });
        await Preferences.remove({ key: PENDING_BUSINESS_ID_KEY });
        await Preferences.remove({ key: PENDING_PLAN_KEY });
        await Preferences.remove({ key: PENDING_TIMESTAMP_KEY });
        console.log('[SubscriptionPersistence] 🗑️ Cleared via Preferences plugin');
      } catch (prefError) {
        // Fallback a localStorage si Preferences falla
        console.warn('[SubscriptionPersistence] ⚠️ Preferences plugin failed, using localStorage fallback:', prefError);
        localStorage.removeItem(PENDING_SUBSCRIPTION_KEY);
        localStorage.removeItem(PENDING_BUSINESS_ID_KEY);
        localStorage.removeItem(PENDING_PLAN_KEY);
        localStorage.removeItem(PENDING_TIMESTAMP_KEY);
      }
    } else {
      localStorage.removeItem(PENDING_SUBSCRIPTION_KEY);
      localStorage.removeItem(PENDING_BUSINESS_ID_KEY);
      localStorage.removeItem(PENDING_PLAN_KEY);
      localStorage.removeItem(PENDING_TIMESTAMP_KEY);
    }
    
    console.log('[SubscriptionPersistence] 🗑️ Cleared pending subscription');
  } catch (error) {
    // Fallback final: siempre usar localStorage si todo falla
    console.error('[SubscriptionPersistence] ❌ Error clearing, using localStorage fallback:', error);
    localStorage.removeItem(PENDING_SUBSCRIPTION_KEY);
    localStorage.removeItem(PENDING_BUSINESS_ID_KEY);
    localStorage.removeItem(PENDING_PLAN_KEY);
    localStorage.removeItem(PENDING_TIMESTAMP_KEY);
  }
}

