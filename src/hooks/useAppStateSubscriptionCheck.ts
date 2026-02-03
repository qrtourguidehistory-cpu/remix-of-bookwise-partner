/**
 * Hook para verificar automáticamente suscripciones pendientes
 * cuando la app se abre o vuelve del background
 * 
 * NOTA: Actualmente deshabilitado ya que la tabla business_subscriptions no existe.
 * Se re-habilitará cuando se implemente el sistema de suscripciones.
 */

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';

export function useAppStateSubscriptionCheck() {
  const { profile } = useAuth();
  const checkingRef = useRef(false);

  // Subscription check is currently disabled
  // The business_subscriptions table doesn't exist yet
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !profile?.business_id) {
      return;
    }

    // No-op: subscription system not implemented
  }, [profile?.business_id]);
}
