import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    
    const { data: scheduledNotifications, error } = await supabase
      .from('appointment_notifications')
      .select('*')
      .eq('status', 'scheduled')
      .lte('send_at', now.toISOString());

    if (error) {
      console.error('Error fetching scheduled notifications:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!scheduledNotifications || scheduledNotifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No scheduled notifications to process', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processed = 0;
    let failed = 0;

    for (const notification of scheduledNotifications) {
      try {
        const { data: appointment, error: appointmentError } = await supabase
          .from('appointments')
          .select(`
            id,
            client_id,
            appointment_date,
            start_time,
            business_id,
            status,
            clients(full_name, email, phone)
          `)
          .eq('id', notification.appointment_id)
          .single();

        if (appointmentError || !appointment) {
          await supabase
            .from('appointment_notifications')
            .update({ status: 'cancelled' })
            .eq('id', notification.id);
          continue;
        }

        const apt = appointment as any;
        
        if (notification.meta?.type === 'reminder' && 
            (apt.status === 'cancelled' || apt.status === 'completed')) {
          await supabase
            .from('appointment_notifications')
            .update({ status: 'cancelled' })
            .eq('id', notification.id);
          continue;
        }

        const { data: settings } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('business_id', apt.business_id)
          .single();

        if (!settings) {
          await supabase
            .from('appointment_notifications')
            .update({ status: 'failed', meta: { ...notification.meta, error: 'No notification settings found' } })
            .eq('id', notification.id);
          failed++;
          continue;
        }

        const clientData = apt.clients as any;
        let clientEmail = clientData?.email;
        let clientPhone = clientData?.phone;
        let clientName = clientData?.full_name;

        if (apt.client_id && !clientEmail && !clientPhone) {
          const { data: client } = await supabase
            .from('clients')
            .select('email, phone, full_name')
            .eq('id', apt.client_id)
            .single();

          if (client) {
            clientEmail = client.email || undefined;
            clientPhone = client.phone || undefined;
            clientName = client.full_name || undefined;
          }
        }

        const appointmentDate = apt.appointment_date;
        const message = generateNotificationMessage(
          notification.meta?.type || 'reminder',
          {
            clientName: clientName || 'Cliente',
            appointmentDate: appointmentDate ? new Date(appointmentDate).toLocaleDateString('es-ES') : undefined,
            appointmentTime: apt.start_time,
          }
        );


        await supabase
          .from('appointment_notifications')
          .update({ 
            status: 'sent',
            updated_at: new Date().toISOString(),
            meta: {
              ...notification.meta,
              sent_at: new Date().toISOString(),
              client_email: clientEmail,
              client_phone: clientPhone,
              message,
            },
          })
          .eq('id', notification.id);

        processed++;

      } catch (err: any) {
        console.error(`Error processing notification ${notification.id}:`, err);
        await supabase
          .from('appointment_notifications')
          .update({ 
            status: 'failed',
            meta: { ...notification.meta, error: err?.message || 'Unknown error' }
          })
          .eq('id', notification.id);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Notifications processed',
        processed,
        failed,
        total: scheduledNotifications.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error processing notifications:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateNotificationMessage(
  type: string,
  context: {
    clientName: string;
    appointmentDate?: string;
    appointmentTime?: string;
  }
): string {
  const { clientName, appointmentDate, appointmentTime } = context;

  switch (type) {
    case 'confirmation':
      return `Hola ${clientName}, tu cita ha sido confirmada para el ${appointmentDate} a las ${appointmentTime}. ¡Te esperamos!`;
    case 'reminder':
      return `Hola ${clientName}, recordatorio: tienes una cita el ${appointmentDate} a las ${appointmentTime}. ¡Te esperamos!`;
    case 'completion':
      return `Hola ${clientName}, tu cita ha sido completada. ¡Gracias por visitarnos!`;
    case 'cancellation':
      return `Hola ${clientName}, lamentamos informarte que tu cita del ${appointmentDate} a las ${appointmentTime} ha sido cancelada. Por favor, contáctanos para reagendar.`;
    case 'next_in_queue':
      return `Hola ${clientName}, puedes venir ahora. Tu turno está listo. Tu cita es el ${appointmentDate} a las ${appointmentTime}.`;
    case 'review_request':
      return `Hola ${clientName}, nos encantaría conocer tu opinión sobre tu última visita. ¿Podrías dejarnos una reseña?`;
    default:
      return `Hola ${clientName}, tienes una actualización sobre tu cita.`;
  }
}
