import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener el webhook secret de Stripe desde los Secrets de Supabase
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!stripeWebhookSecret) {
      console.error('Stripe webhook secret missing');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Stripe webhook secret not configured. Please set STRIPE_WEBHOOK_SECRET in Supabase Secrets.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener el raw body para verificar la firma
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('No stripe-signature header found');
      return new Response(
        JSON.stringify({ success: false, error: 'No signature found' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verificar el webhook event
    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(
        body,
        signature,
        stripeWebhookSecret
      ) as Stripe.Event;
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(
        JSON.stringify({ success: false, error: `Webhook Error: ${err.message}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('🔔 Stripe webhook event received:', event.type, event.id);
    console.log('📦 Full event data:', JSON.stringify(event, null, 2));

    // Procesar diferentes tipos de eventos
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        console.log('💳 Checkout session details:', {
          id: session.id,
          mode: session.mode,
          subscription: session.subscription,
          metadata: session.metadata,
          customer: session.customer,
        });
        
        if (session.mode === 'subscription' && session.subscription) {
          const subscriptionId = session.subscription as string;
          const metadata = session.metadata || {};

          console.log('✅ Checkout session completed - Metadata:', JSON.stringify(metadata, null, 2));
          console.log('📋 Subscription ID from Stripe:', subscriptionId);
          console.log('🔍 Checking metadata:', {
            has_business_id: !!metadata?.business_id,
            has_subscription_id: !!metadata?.subscription_id,
            business_id: metadata?.business_id,
            subscription_id: metadata?.subscription_id,
          });

          // Intentar obtener metadata de session o subscription
          let finalMetadata = metadata;
          let businessId = metadata?.business_id;
          let subscriptionIdFromMeta = metadata?.subscription_id;

          // Si no hay metadata en session, intentar obtenerlo de la subscription
          if (!businessId || !subscriptionIdFromMeta) {
            console.log('⚠️ Metadata no encontrado en session, buscando en subscription...');
            const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
              apiVersion: '2024-06-20',
            });
            
            try {
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              console.log('📦 Subscription metadata from Stripe:', JSON.stringify(subscription.metadata, null, 2));
              
              if (subscription.metadata?.business_id && subscription.metadata?.subscription_id) {
                finalMetadata = subscription.metadata;
                businessId = subscription.metadata.business_id;
                subscriptionIdFromMeta = subscription.metadata.subscription_id;
                console.log('✅ Metadata encontrado en subscription object');
              }
            } catch (err) {
              console.error('❌ Error retrieving subscription:', err);
            }
          }

          if (businessId && subscriptionIdFromMeta) {
            // Obtener la suscripción de Stripe para obtener más detalles
            const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
              apiVersion: '2024-06-20',
            });

            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            console.log('📊 Stripe subscription status:', subscription.status);
            console.log('🔄 Updating subscription in database:', subscriptionIdFromMeta);

            // Mapear el estado de Stripe al estado de nuestra base de datos
            let dbStatus = 'inactive';
            if (subscription.status === 'active') {
              dbStatus = 'active';
            } else if (subscription.status === 'trialing') {
              dbStatus = 'trialing';
            } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
              dbStatus = 'past_due';
            } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
              dbStatus = 'cancelled';
            }

            // Actualizar la suscripción en Supabase usando subscription_id del metadata
            const updateData: any = {
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: subscription.customer as string,
              status: dbStatus,
              payment_method: 'stripe',
              updated_at: new Date().toISOString(),
            };

            // Actualizar fechas de pago
            if (subscription.current_period_end) {
              updateData.next_payment_date = new Date(subscription.current_period_end * 1000).toISOString();
              updateData.payment_due_date = new Date(subscription.current_period_end * 1000).toISOString();
            }
            if (subscription.current_period_start) {
              updateData.last_payment_date = new Date(subscription.current_period_start * 1000).toISOString();
            }

            // Actualizar usando subscription_id del metadata (que es el ID de nuestra tabla)
            console.log('💾 Ejecutando UPDATE en business_subscriptions:', {
              id: subscriptionIdFromMeta,
              business_id: businessId,
              updateData: JSON.stringify(updateData, null, 2)
            });

            const { data: updatedSubscription, error: updateError } = await supabase
              .from('business_subscriptions')
              .update(updateData)
              .eq('id', subscriptionIdFromMeta)
              .eq('business_id', businessId) // Verificación adicional de seguridad
              .select()
              .single();

            if (updateError) {
              console.error('❌ Error updating subscription:', {
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

            console.log('✅ Subscription activated successfully:', {
              subscription_id: subscriptionIdFromMeta,
              business_id: businessId,
              status: dbStatus,
              updated_data: JSON.stringify(updatedSubscription, null, 2)
            });
          } else {
            console.error('❌ Missing required metadata after all attempts:', { 
              has_business_id: !!businessId, 
              has_subscription_id: !!subscriptionIdFromMeta,
              session_metadata: JSON.stringify(session.metadata, null, 2),
              session_id: session.id,
            });
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.metadata?.subscription_id;

        if (subscriptionId) {
          // Determinar el estado en base al estado de Stripe
          let status = subscription.status;
          if (status === 'active') {
            status = 'active';
          } else if (status === 'past_due' || status === 'unpaid') {
            status = 'past_due';
          } else if (status === 'canceled' || status === 'incomplete_expired') {
            status = 'cancelled';
          } else if (status === 'trialing') {
            status = 'trialing';
          } else {
            status = 'inactive';
          }

          const updateData: any = {
            status: status,
            updated_at: new Date().toISOString(),
          };

          // Actualizar fechas
          if (subscription.current_period_end) {
            updateData.next_payment_date = new Date(subscription.current_period_end * 1000).toISOString();
            updateData.payment_due_date = new Date(subscription.current_period_end * 1000).toISOString();
          }

          // Si no está activo, eliminar cualquier periodo de gracia
          if (status !== 'active') {
            // Actualizar inmediatamente sin periodo de gracia
            updateData.status = status;
          }

          const { error: updateError } = await supabase
            .from('business_subscriptions')
            .update(updateData)
            .eq('stripe_subscription_id', subscription.id);

          if (updateError) {
            console.error('Error updating subscription:', updateError);
          } else {
            console.log('Subscription updated:', subscriptionId, 'Status:', status);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.metadata?.subscription_id;

        if (subscriptionId) {
          // Actualizar inmediatamente a cancelado, sin periodo de gracia
          const { error: updateError } = await supabase
            .from('business_subscriptions')
            .update({
              status: 'cancelled',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subscription.id);

          if (updateError) {
            console.error('Error canceling subscription:', updateError);
          } else {
            console.log('Subscription cancelled:', subscriptionId);
          }
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(
      JSON.stringify({ success: true, received: true }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Error in stripe-webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

