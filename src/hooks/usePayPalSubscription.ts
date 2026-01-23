import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Hook para manejar suscripciones de PayPal usando Capacitor Browser
 * NO usa PayPal JS SDK - usa REST API con deep links
 */
export function usePayPalSubscription() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const isNative = Capacitor.isNativePlatform();

  // Listener para deep links de PayPal (solo en mobile)
  useEffect(() => {
    if (!isNative) return;

    const handleAppUrlOpen = async ({ url }: { url: string }) => {
      console.log('[PayPalSubscription] Deep link recibido:', url);

      try {
        // Parsear la URL del deep link
        // Formato: com.miturnow.partner://paypal/success?subscription_id=xxx&token=xxx
        // O: com.miturnow.partner://paypal/success?type=checkout&user_id=xxx
        let urlObj: URL;
        try {
          // Intentar parsear como URL normal
          urlObj = new URL(url);
        } catch {
          // Si falla, es un deep link - convertir a formato URL válido
          // Usa exclusivamente: com.miturnow.partner://
          const normalizedUrl = url.replace('com.miturnow.partner://', 'https://');
          urlObj = new URL(normalizedUrl);
        }
        
        const path = urlObj.pathname;
        const params = new URLSearchParams(urlObj.search);
        const subscriptionId = params.get('subscription_id');
        const token = params.get('token'); // PayPal approval token (si viene en la URL)
        // PayPal también puede enviar el token como 'ba_token'
        const baToken = params.get('ba_token') || params.get('BA_TOKEN');

        console.log('[PayPalSubscription] Deep link parseado:', { 
          path, 
          subscriptionId, 
          hasToken: !!token, 
          hasBaToken: !!baToken,
          allParams: Object.fromEntries(params.entries())
        });

        // Cerrar el browser si está abierto
        try {
          await Browser.close();
        } catch (e) {
          // Browser ya estaba cerrado
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
              
              // Refrescar después de un delay
              setTimeout(() => {
                window.location.reload();
              }, 2000);
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

              // Refrescar después de un delay
              setTimeout(() => {
                window.location.reload();
              }, 2000);
            }
          } catch (error: any) {
            console.error('[PayPalSubscription] Error en procesamiento:', error);
            toast({
              title: language === "es" ? "Error" : "Error",
              description: language === "es"
                ? "Error al procesar. El webhook confirmará el estado."
                : "Error processing. Webhook will confirm the status.",
              variant: "destructive",
            });
          }
        } else if (path.includes('/paypal/cancel')) {
          const paymentType = params.get('type');
          console.log('[PayPalSubscription] ❌ Pago cancelado', { paymentType });
          
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
        }
      } catch (error) {
        console.error('[PayPalSubscription] Error procesando deep link:', error);
        toast({
          title: language === "es" ? "Error" : "Error",
          description: language === "es"
            ? "Error al procesar el resultado del pago"
            : "Error processing payment result",
          variant: "destructive",
        });
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
        throw new Error(error.message || 'Error al crear suscripción en PayPal');
      }

      if (!data?.approval_url) {
        throw new Error('No se recibió la URL de aprobación de PayPal');
      }

      console.log('[PayPalSubscription] Abriendo PayPal en navegador...');

      // Abrir PayPal en el navegador del sistema
      if (isNative) {
        await Browser.open({
          url: data.approval_url,
          presentationStyle: 'fullscreen', // Pantalla completa en iOS
          windowName: '_self',
        });
      } else {
        // Web: redirigir directamente
        window.location.href = data.approval_url;
      }

      return {
        success: true,
        paypal_subscription_id: data.paypal_subscription_id,
        subscription_id: data.subscription_id,
      };
    } catch (error: any) {
      console.error('[PayPalSubscription] Error:', error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: error?.message || (language === "es"
          ? "Error al crear suscripción en PayPal"
          : "Error creating PayPal subscription"),
        variant: "destructive",
      });
      return { success: false, error: error?.message };
    } finally {
      setLoading(false);
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

