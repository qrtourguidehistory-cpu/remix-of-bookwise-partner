import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook para manejar suscripciones de PayPal usando Capacitor Browser
 * NO usa PayPal JS SDK - usa REST API con deep links
 * 
 * BUG FIX: El problema del "procesando infinito" ocurría porque:
 * 1. El listener de deep links no detenía el estado de loading
 * 2. El componente SubscriptionPage mantenía isPaymentInProgress=true indefinidamente
 * 3. No había comunicación entre el listener y el estado del componente
 * 
 * SOLUCIÓN:
 * - El listener ahora detiene el loading inmediatamente al detectar el deep link
 * - Se usa un flag para evitar procesamiento múltiple del mismo deep link
 * - Se emite un evento personalizado para notificar al componente
 */
export function usePayPalSubscription() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const isNative = Capacitor.isNativePlatform();
  
  // Flag para evitar procesar el mismo deep link múltiples veces
  const processedUrlsRef = useRef<Set<string>>(new Set());
  
  // Ref para rastrear si hay un pago en progreso (para appStateChange)
  const paymentInProgressRef = useRef(false);

  // Listener para deep links de PayPal (solo en mobile)
  useEffect(() => {
    if (!isNative) return;

    const handleAppUrlOpen = async ({ url }: { url: string }) => {
      console.log('[PayPalSubscription] 🔗 Deep link recibido:', url);

      // CRÍTICO: Detener loading inmediatamente al detectar cualquier deep link de PayPal
      // Esto resuelve el bug del "procesando infinito"
      setLoading(false);
      paymentInProgressRef.current = false; // Marcar que el pago ya no está en progreso
      
      // Emitir evento para notificar al componente que el deep link fue recibido
      // Esto permite que SubscriptionPage resetee isPaymentInProgress
      // IMPORTANTE: Emitir ANTES de procesar para que el componente resetee el estado inmediatamente
      window.dispatchEvent(new CustomEvent('paypal-deep-link-received', { detail: { url } }));

      // Evitar procesar el mismo URL múltiples veces (puede ocurrir si el listener se dispara varias veces)
      if (processedUrlsRef.current.has(url)) {
        console.log('[PayPalSubscription] ⚠️ URL ya procesada, ignorando:', url);
        return;
      }
      processedUrlsRef.current.add(url);
      
      // Limpiar URLs antiguas después de 5 minutos para evitar memory leak
      setTimeout(() => {
        processedUrlsRef.current.delete(url);
      }, 5 * 60 * 1000);

      try {
        // Parsear la URL - ahora usa HTTPS App Links
        // Formato: https://www.miturnow.com/paypal/success?subscription_id=xxx&token=xxx
        // O: https://www.miturnow.com/paypal/success?type=checkout&user_id=xxx
        // También soporta legacy custom schemes por compatibilidad
        let urlObj: URL;
        try {
          // Intentar parsear como URL normal (HTTPS App Link)
          urlObj = new URL(url);
        } catch {
          // Si falla, puede ser un custom scheme legacy - convertir a formato URL válido
          // Mantener compatibilidad con: com.miturnow.partner://
          const normalizedUrl = url.replace('com.miturnow.partner://', 'https://');
          urlObj = new URL(normalizedUrl);
        }
        
        const path = urlObj.pathname;
        const host = urlObj.hostname;
        const params = new URLSearchParams(urlObj.search);
        const subscriptionId = params.get('subscription_id');
        const token = params.get('token'); // PayPal approval token (si viene en la URL)
        // PayPal también puede enviar el token como 'ba_token'
        const baToken = params.get('ba_token') || params.get('BA_TOKEN');

        console.log('[PayPalSubscription] 📋 Deep link parseado:', { 
          host,
          path, 
          subscriptionId, 
          hasToken: !!token, 
          hasBaToken: !!baToken,
          allParams: Object.fromEntries(params.entries())
        });

        // Verificar que sea una URL de PayPal (www.miturnow.com o custom scheme)
        const isPayPalUrl = host === 'www.miturnow.com' || url.startsWith('com.miturnow.partner://paypal');
        if (!isPayPalUrl) {
          console.log('[PayPalSubscription] ⚠️ URL no es de PayPal, ignorando');
          return;
        }

        // Cerrar el browser si está abierto
        try {
          await Browser.close();
          console.log('[PayPalSubscription] ✅ Browser cerrado');
        } catch (e) {
          // Browser ya estaba cerrado o no estaba abierto
          console.log('[PayPalSubscription] ℹ️ Browser ya estaba cerrado');
        }

        const paymentType = params.get('type'); // 'checkout' para pago único, 'subscription' para suscripción
        const orderId = params.get('order_id');
        const payerId = params.get('PayerID') || params.get('payer_id');
        
        if (path.includes('/paypal/success')) {
          console.log('[PayPalSubscription] ✅ Pago aprobado', { paymentType, subscriptionId, orderId });
          
          // Llamar a la Edge Function process-paypal-return con autenticación
          try {
            if (paymentType === 'checkout') {
              // Procesar pago único
              console.log('[PayPalSubscription] Procesando pago único con Edge Function...');
              
              if (!orderId) {
                console.warn('[PayPalSubscription] No order_id encontrado, intentando extraer de parámetros');
                // PayPal puede enviar el order_id en diferentes formatos
                const allParams = Object.fromEntries(params.entries());
                console.log('[PayPalSubscription] Todos los parámetros:', allParams);
              }
              
              const { data: processData, error: processError } = await supabase.functions.invoke('process-paypal-return', {
                body: {
                  type: 'checkout',
                  order_id: orderId || params.get('token'), // PayPal a veces envía order_id como token
                  payer_id: payerId,
                  user_id: params.get('user_id'),
                }
              });

              if (processError) {
                console.error('[PayPalSubscription] Error procesando checkout:', processError);
                toast({
                  title: language === "es" ? "Error" : "Error",
                  description: language === "es"
                    ? "Error al procesar el pago. El webhook confirmará el estado."
                    : "Error processing payment. Webhook will confirm the status.",
                  variant: "destructive",
                });
              } else {
                console.log('[PayPalSubscription] ✅ Checkout procesado:', processData);
                toast({
                  title: language === "es" ? "Pago procesado" : "Payment processed",
                  description: language === "es"
                    ? "Tu pago ha sido procesado correctamente. Actualizando..."
                    : "Your payment has been processed successfully. Updating...",
                  variant: "default",
                });
              }
              
              // CRÍTICO: NO usar window.location.reload() - el componente manejará el refresh
              // El componente escuchará el cambio de estado y actualizará la UI
              return;
            } else {
              // Procesar suscripción
              if (!subscriptionId) {
                console.error('[PayPalSubscription] ❌ No se encontró subscription_id en el deep link');
                toast({
                  title: language === "es" ? "Error" : "Error",
                  description: language === "es"
                    ? "No se pudo identificar la suscripción"
                    : "Could not identify subscription",
                  variant: "destructive",
                });
                return;
              }

              console.log('[PayPalSubscription] Procesando suscripción con Edge Function...');
              
              // Llamar a process-paypal-return para suscripciones
              const approvalToken = token || baToken;
              const { data: processData, error: processError } = await supabase.functions.invoke('process-paypal-return', {
                body: {
                  type: 'subscription',
                  subscription_id: subscriptionId,
                  token: approvalToken,
                  ba_token: baToken,
                  user_id: params.get('user_id'),
                }
              });

              if (processError) {
                console.error('[PayPalSubscription] Error procesando suscripción:', processError);
                // Fallback al método anterior
                if (approvalToken) {
                  await confirmPayPalSubscription(subscriptionId, approvalToken);
                } else {
                  await syncPayPalSubscription(subscriptionId);
                }
              } else {
                console.log('[PayPalSubscription] ✅ Suscripción procesada:', processData);
              }

              toast({
                title: language === "es" ? "Pago procesado" : "Payment processed",
                description: language === "es"
                  ? "Tu suscripción está siendo activada. El webhook confirmará el estado final."
                  : "Your subscription is being activated. Webhook will confirm the final status.",
                variant: "default",
              });

              // Emitir evento de éxito para que el componente actualice su estado
              // CRÍTICO: NO usar window.location.reload() - el componente manejará el refresh
              window.dispatchEvent(new CustomEvent('paypal-subscription-success', { 
                detail: { subscriptionId, paymentType } 
              }));
            }
          } catch (error: any) {
            console.error('[PayPalSubscription] ❌ Error en procesamiento:', error);
            toast({
              title: language === "es" ? "Error" : "Error",
              description: language === "es"
                ? "Error al procesar. El webhook confirmará el estado."
                : "Error processing. Webhook will confirm the status.",
              variant: "destructive",
            });
            
            // Emitir evento de error
            window.dispatchEvent(new CustomEvent('paypal-subscription-error', { 
              detail: { error: error.message } 
            }));
          }
        } else if (path.includes('/paypal/cancel')) {
          const paymentType = params.get('type');
          console.log('[PayPalSubscription] ❌ Pago cancelado', { paymentType });
          
          // CRÍTICO: Detener loading también en cancelación
          setLoading(false);
          
          toast({
            title: language === "es" ? "Pago cancelado" : "Payment canceled",
            description: language === "es"
              ? paymentType === 'checkout' 
                ? "El pago fue cancelado. Puedes intentar nuevamente cuando lo desees."
                : "El proceso de pago fue cancelado"
              : paymentType === 'checkout'
                ? "The payment was canceled. You can try again whenever you want."
                : "Payment process was canceled",
            variant: "default",
          });
          
          // Emitir evento de cancelación
          window.dispatchEvent(new CustomEvent('paypal-subscription-cancel', { 
            detail: { paymentType } 
          }));
        } else {
          console.log('[PayPalSubscription] ⚠️ URL de PayPal pero path no reconocido:', path);
        }
      } catch (error) {
        console.error('[PayPalSubscription] ❌ Error procesando deep link:', error);
        // Asegurar que el loading se detenga incluso si hay error
        setLoading(false);
        
        toast({
          title: language === "es" ? "Error" : "Error",
          description: language === "es"
            ? "Error al procesar el resultado del pago"
            : "Error processing payment result",
          variant: "destructive",
        });
        
        // Emitir evento de error
        window.dispatchEvent(new CustomEvent('paypal-subscription-error', { 
          detail: { error: 'Error parsing deep link' } 
        }));
      }
    };

    const listener = App.addListener('appUrlOpen', handleAppUrlOpen);

    return () => {
      listener.then(l => l.remove());
    };
  }, [isNative, language, toast]);

  /**
   * Crea una suscripción de PayPal y abre el navegador para aprobación
   */
  const createSubscription = useCallback(async (
    businessId: string,
    ownerId: string,
    existingSubscriptionId?: string
  ) => {
    if (loading) return;

    setLoading(true);
    
    // CRÍTICO: Timeout de seguridad para detener loading si no se recibe deep link
    // Esto evita que el botón quede en "procesando" indefinidamente
    const loadingTimeout = setTimeout(() => {
      console.log('[PayPalSubscription] ⏰ Timeout: No se recibió deep link, deteniendo loading');
      setLoading(false);
      window.dispatchEvent(new CustomEvent('paypal-timeout', { 
        detail: { message: 'Timeout esperando respuesta de PayPal' } 
      }));
    }, 5 * 60 * 1000); // 5 minutos máximo

    // CRÍTICO: Marcar que hay un pago en progreso
    paymentInProgressRef.current = true;
    
    // Listener para detectar cuando la app vuelve al foreground
    // Si el usuario cierra PayPal manualmente, esto detectará el regreso
    let appStateListener: any = null;
    if (isNative) {
      appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && paymentInProgressRef.current) {
          // La app volvió al foreground y hay un pago en progreso
          // Esperar un momento para ver si llega el deep link
          console.log('[PayPalSubscription] 🔄 App volvió al foreground, esperando deep link...');
          setTimeout(() => {
            // Si después de 3 segundos aún está en progreso, asumir que no llegó el deep link
            if (paymentInProgressRef.current) {
              console.log('[PayPalSubscription] ⚠️ No se detectó deep link después de 3 segundos, deteniendo loading');
              clearTimeout(loadingTimeout);
              setLoading(false);
              paymentInProgressRef.current = false;
              window.dispatchEvent(new CustomEvent('paypal-app-returned', { 
                detail: { message: 'App regresó sin deep link' } 
              }));
            }
          }, 3000);
        }
      });
    }

    try {
      console.log('[PayPalSubscription] Creando suscripción...');

      // Llamar a la Edge Function para crear la suscripción
      const { data, error } = await supabase.functions.invoke('create-paypal-subscription', {
        body: {
          business_id: businessId,
          owner_id: ownerId,
          subscription_id: existingSubscriptionId,
          is_native: isNative, // Indicar que es mobile para usar deep links
        }
      });

      if (error) {
        clearTimeout(loadingTimeout);
        paymentInProgressRef.current = false;
        if (appStateListener) appStateListener.remove();
        throw new Error(error.message || 'Error al crear suscripción en PayPal');
      }

      if (!data?.approval_url) {
        clearTimeout(loadingTimeout);
        paymentInProgressRef.current = false;
        if (appStateListener) appStateListener.remove();
        throw new Error('No se recibió la URL de aprobación de PayPal');
      }

      console.log('[PayPalSubscription] 🌐 Abriendo PayPal en navegador...');

      // Abrir PayPal en el navegador del sistema
      if (isNative) {
        await Browser.open({
          url: data.approval_url,
          presentationStyle: 'fullscreen', // Pantalla completa en iOS
          windowName: '_self',
        });
        // NOTA: NO detenemos el loading aquí porque el usuario aún no ha completado el pago
        // El loading se detendrá cuando:
        // 1. Se reciba el deep link (en handleAppUrlOpen)
        // 2. Se alcance el timeout (5 minutos)
        // 3. La app vuelva al foreground sin deep link (appStateChange)
        console.log('[PayPalSubscription] ✅ Browser abierto, esperando deep link...');
        
        // Limpiar listener cuando se reciba el deep link o se detenga el loading
        const cleanup = () => {
          clearTimeout(loadingTimeout);
          paymentInProgressRef.current = false;
          if (appStateListener) {
            appStateListener.remove();
            appStateListener = null;
          }
        };
        
        // Escuchar cuando se reciba el deep link para limpiar
        const deepLinkHandler = () => {
          cleanup();
          window.removeEventListener('paypal-deep-link-received', deepLinkHandler);
        };
        window.addEventListener('paypal-deep-link-received', deepLinkHandler);
        
        // También limpiar si se detiene el loading por cualquier razón
        const loadingCheckInterval = setInterval(() => {
          if (!loading) {
            cleanup();
            clearInterval(loadingCheckInterval);
          }
        }, 1000);
      } else {
        // Web: redirigir directamente
        clearTimeout(loadingTimeout);
        if (appStateListener) appStateListener.remove();
        window.location.href = data.approval_url;
        // En web, el loading se detiene porque la página se recarga
        setLoading(false);
      }

      return {
        success: true,
        paypal_subscription_id: data.paypal_subscription_id,
        subscription_id: data.subscription_id,
      };
    } catch (error: any) {
      console.error('[PayPalSubscription] ❌ Error:', error);
      // CRÍTICO: Detener loading en caso de error
      clearTimeout(loadingTimeout);
      paymentInProgressRef.current = false;
      if (appStateListener) appStateListener.remove();
      setLoading(false);
      
      toast({
        title: language === "es" ? "Error" : "Error",
        description: error?.message || (language === "es"
          ? "Error al crear suscripción en PayPal"
          : "Error creating PayPal subscription"),
        variant: "destructive",
      });
      return { success: false, error: error?.message };
    }
  }, [loading, isNative, language, toast]);

  /**
   * Confirma una suscripción de PayPal después de la aprobación
   */
  const confirmPayPalSubscription = async (subscriptionId: string, token: string) => {
    try {
      console.log('[PayPalSubscription] Confirmando suscripción...');
      
      // Llamar a una Edge Function para confirmar la suscripción
      const { error } = await supabase.functions.invoke('confirm-paypal-subscription', {
        body: {
          subscription_id: subscriptionId,
          token: token,
        }
      });

      if (error) {
        throw new Error(error.message || 'Error al confirmar suscripción');
      }

      console.log('[PayPalSubscription] ✅ Suscripción confirmada');
    } catch (error: any) {
      console.error('[PayPalSubscription] Error confirmando:', error);
      throw error;
    }
  };

  /**
   * Sincroniza una suscripción de PayPal con nuestra BD
   */
  const syncPayPalSubscription = async (subscriptionId: string) => {
    try {
      console.log('[PayPalSubscription] Sincronizando suscripción...');
      
      // La Edge Function puede obtener el estado desde PayPal
      const { error } = await supabase.functions.invoke('sync-paypal-subscription', {
        body: {
          subscription_id: subscriptionId,
        }
      });

      if (error) {
        throw new Error(error.message || 'Error al sincronizar suscripción');
      }

      console.log('[PayPalSubscription] ✅ Suscripción sincronizada');
    } catch (error: any) {
      console.error('[PayPalSubscription] Error sincronizando:', error);
      throw error;
    }
  };

  return {
    createSubscription,
    loading,
  };
}

