import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    
    // Find all scheduled notifications that are due
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

    // Process each scheduled notification
    for (const notification of scheduledNotifications) {
      try {
        // Get appointment details
        const { data: appointment, error: appointmentError } = await supabase
          .from('appointments')
          .select(`
            id,
            client_id,
            client_email,
            client_phone,
            client_name,
            appointment_date,
            date,
            start_time,
            business_id,
            status,
            clients(full_name, email, phone)
          `)
          .eq('id', notification.appointment_id)
          .single();

        if (appointmentError || !appointment) {
          // Mark notification as cancelled if appointment doesn't exist
          await supabase
            .from('appointment_notifications')
            .update({ status: 'cancelled' })
            .eq('id', notification.id);
          continue;
        }

        // Skip if appointment is cancelled or completed (for reminders)
        if (notification.meta?.type === 'reminder' && 
            (appointment.status === 'cancelled' || appointment.status === 'completed')) {
          await supabase
            .from('appointment_notifications')
            .update({ status: 'cancelled' })
            .eq('id', notification.id);
          continue;
        }

        // Get notification settings
        const { data: settings } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('business_id', appointment.business_id)
          .single();

        if (!settings) {
          await supabase
            .from('appointment_notifications')
            .update({ status: 'failed', meta: { ...notification.meta, error: 'No notification settings found' } })
            .eq('id', notification.id);
          failed++;
          continue;
        }

        // Get client info
        let clientEmail = appointment.client_email || appointment.clients?.email;
        let clientPhone = appointment.client_phone || appointment.clients?.phone;
        let clientName = appointment.client_name || appointment.clients?.full_name;

        if (appointment.client_id && !clientEmail && !clientPhone) {
          const { data: client } = await supabase
            .from('clients')
            .select('email, phone, full_name')
            .eq('id', appointment.client_id)
            .single();

          if (client) {
            clientEmail = client.email || undefined;
            clientPhone = client.phone || undefined;
            clientName = client.full_name || undefined;
          }
        }

        // Generate message
        const appointmentDate = appointment.appointment_date || appointment.date;
        const message = generateNotificationMessage(
          notification.meta?.type || 'reminder',
          {
            clientName: clientName || 'Cliente',
            appointmentDate: appointmentDate ? new Date(appointmentDate).toLocaleDateString('es-ES') : undefined,
            appointmentTime: appointment.start_time,
          }
        );

        // TODO: Integrate with actual email/SMS/push notification services
        // For now, we just log to the database
        console.log('Sending notification:', {
          type: notification.meta?.type,
          clientEmail,
          clientPhone,
          message,
        });

        // Update notification status to sent
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

      } catch (err) {
        console.error(`Error processing notification ${notification.id}:`, err);
        // Mark as failed
        await supabase
          .from('appointment_notifications')
          .update({ 
            status: 'failed',
            meta: { ...notification.meta, error: err.message }
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

  } catch (error) {
    console.error('Error processing notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
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

