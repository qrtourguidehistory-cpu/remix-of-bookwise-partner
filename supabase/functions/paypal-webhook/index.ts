import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// PayPal webhook verification
async function verifyPayPalWebhook(
  headers: Headers,
  body: string,
  webhookId: string,
  webhookSecret: string
): Promise<boolean> {
  // PayPal webhook verification requires specific headers
  const authAlgo = headers.get('PAYPAL-AUTH-ALGO');
  const certUrl = headers.get('PAYPAL-CERT-URL');
  const transmissionId = headers.get('PAYPAL-TRANSMISSION-ID');
  const transmissionSig = headers.get('PAYPAL-TRANSMISSION-SIG');
  const transmissionTime = headers.get('PAYPAL-TRANSMISSION-TIME');

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    return false;
  }

  // For production, implement full webhook verification
  // For now, we'll do basic validation
  // In production, verify the certificate chain and signature
  return true;
}

// Extract business_id and subscription_id from custom_id
function extractIdsFromCustomId(customId: string): { business_id: string; subscription_id: string } | null {
  if (!customId || !customId.includes(':')) {
    return null;
  }
  const [business_id, subscription_id] = customId.split(':');
  return { business_id, subscription_id };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener el webhook secret de PayPal desde los Secrets de Supabase
    const paypalWebhookSecret = Deno.env.get('PAYPAL_WEBHOOK_SECRET');
    const paypalWebhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');

    if (!paypalWebhookSecret || !paypalWebhookId) {
      console.error('PayPal webhook secret or ID missing');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'PayPal webhook secret not configured. Please set PAYPAL_WEBHOOK_SECRET and PAYPAL_WEBHOOK_ID in Supabase Secrets.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener el raw body para verificar la firma
    const body = await req.text();
    const event = JSON.parse(body);

    // Verificar webhook (simplificado - en producción verificar completamente)
    const isValid = await verifyPayPalWebhook(
      req.headers,
      body,
      paypalWebhookId,
      paypalWebhookSecret
    );

    if (!isValid) {
      console.error('PayPal webhook verification failed');
      return new Response(
        JSON.stringify({ success: false, error: 'Webhook verification failed' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Procesar diferentes tipos de eventos
    const eventType = event.event_type;

    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const resource = event.resource;
        const subscriptionId = resource.id;
        const customId = resource.custom_id;

        if (!customId) {
          console.error('No custom_id in PayPal subscription');
          return new Response(
            JSON.stringify({ success: false, error: 'Missing custom_id in subscription' }),
            { status: 400, headers: corsHeaders }
          );
        }

        const ids = extractIdsFromCustomId(customId);
        if (!ids) {
          console.error('Invalid custom_id format:', customId);
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid custom_id format' }),
            { status: 400, headers: corsHeaders }
          );
        }

        const { business_id, subscription_id } = ids;

        // Actualizar la suscripción en Supabase
        const updateData: any = {
          paypal_subscription_id: subscriptionId,
          status: 'active',
          payment_method: 'paypal',
          updated_at: new Date().toISOString(),
        };

        // Actualizar fechas de pago
        if (resource.billing_info?.next_billing_time) {
          updateData.next_payment_date = new Date(resource.billing_info.next_billing_time).toISOString();
          updateData.payment_due_date = new Date(resource.billing_info.next_billing_time).toISOString();
        }
        if (resource.start_time) {
          updateData.last_payment_date = new Date(resource.start_time).toISOString();
        }

        // Intentar actualizar la suscripción existente
        let updatedSubscription;
        const { data: existingSubscription, error: updateError } = await supabase
          .from('business_subscriptions')
          .update(updateData)
          .eq('id', subscription_id)
          .eq('business_id', business_id) // Verificación adicional de seguridad
          .select()
          .single();

        if (updateError) {
          // Si la suscripción no existe (PGRST116 = no rows returned), crearla
          if (updateError.code === 'PGRST116' || updateError.message?.includes('No rows')) {
            console.log('Subscription not found, creating new one...');
            
            // Obtener owner_id del negocio
            const { data: businessData, error: businessError } = await supabase
              .from('businesses')
              .select('owner_id')
              .eq('id', business_id)
              .single();

            if (businessError || !businessData?.owner_id) {
              console.error('Error fetching business or owner_id:', businessError);
              return new Response(
                JSON.stringify({ 
                  success: false, 
                  error: 'Failed to get business owner_id', 
                  details: businessError?.message
                }),
                { status: 500, headers: corsHeaders }
              );
            }

            // Crear nueva suscripción con todos los datos
            const { data: newSubscription, error: createError } = await supabase
              .from('business_subscriptions')
              .insert({
                id: subscription_id, // Usar el ID del custom_id
                business_id: business_id,
                owner_id: businessData.owner_id,
                ...updateData,
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
                  error: 'Failed to create subscription', 
                  details: createError.message,
                  code: createError.code
                }),
                { status: 500, headers: corsHeaders }
              );
            }

            updatedSubscription = newSubscription;
          } else {
            // Otro tipo de error
            console.error('Error updating subscription:', {
              error: updateError,
              message: updateError.message,
              details: updateError.details,
              hint: updateError.hint,
              code: updateError.code
            });
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Failed to update subscription', 
                details: updateError.message,
                code: updateError.code
              }),
              { status: 500, headers: corsHeaders }
            );
          }
        } else {
          updatedSubscription = existingSubscription;
        }

        // Asegurar que el negocio está público si la suscripción está activa
        if (business_id) {
          await supabase
            .from('businesses')
            .update({ is_public: true, updated_at: new Date().toISOString() })
            .eq('id', business_id);
        }

        // Crear notificación de billing para el partner
        try {
          const { data: subData } = await supabase
            .from('business_subscriptions')
            .select('owner_id')
            .eq('id', subscription_id)
            .single();

          if (subData?.owner_id) {
            await supabase
              .from('notifications')
              .insert({
                user_id: subData.owner_id,
                title: 'Suscripción activa',
                message: 'Tu pago fue procesado correctamente. Tu suscripción Premium ya está activa.',
                type: 'billing',
                read: false,
                meta: {
                  subscription_id: subscription_id,
                  business_id: business_id,
                  status: 'active',
                  payment_method: 'paypal',
                },
              });
          }
        } catch (notifError) {
          console.error('Error creating billing notification (non-critical):', notifError);
          // No fallar el webhook si la notificación falla
        }

        break;
      }

      case 'PAYMENT.SALE.COMPLETED': {
        const resource = event.resource;
        const billingAgreementId = resource.billing_agreement_id;

        if (billingAgreementId) {
          // Buscar suscripción por paypal_subscription_id
          const { data: subscriptionData } = await supabase
            .from('business_subscriptions')
            .select('id, owner_id, business_id')
            .eq('paypal_subscription_id', billingAgreementId)
            .single();

          if (subscriptionData) {
            // Crear notificación de pago recibido
            try {
              await supabase
                .from('notifications')
                .insert({
                  user_id: subscriptionData.owner_id,
                  title: 'Pago recibido',
                  message: `Tu pago de ${(resource.amount?.total || 0)} ${resource.amount?.currency || 'USD'} fue procesado correctamente.`,
                  type: 'billing',
                  read: false,
                  meta: {
                    subscription_id: subscriptionData.id,
                    business_id: subscriptionData.business_id,
                    payment_method: 'paypal',
                    transaction_id: resource.id,
                    amount: resource.amount?.total,
                    currency: resource.amount?.currency,
                  },
                });
            } catch (notifError) {
              console.error('Error creating payment notification (non-critical):', notifError);
            }
          }
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        const resource = event.resource;
        const subscriptionId = resource.id;

        // Buscar suscripción por paypal_subscription_id
        const { error: updateError } = await supabase
          .from('business_subscriptions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('paypal_subscription_id', subscriptionId);

        if (updateError) {
          console.error('Error canceling subscription:', updateError);
        }
        break;
      }

      default:
        // Ignorar otros eventos
        break;
    }

    return new Response(
      JSON.stringify({ success: true, received: true }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Error in paypal-webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

