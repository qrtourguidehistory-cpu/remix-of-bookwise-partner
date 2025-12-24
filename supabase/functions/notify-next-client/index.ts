import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base de datos central compartida con BookWise Client
const CENTRAL_SUPABASE_URL = Deno.env.get('CENTRAL_SUPABASE_URL') || "https://rdznelijpliklisnflfm.supabase.co";

interface NotifyNextClientRequest {
  appointmentId: string;
  businessId: string;
  staffId: string;
  currentAppointmentEndTime: string; // HH:MM format
  currentAppointmentDate: string; // YYYY-MM-DD format
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: NotifyNextClientRequest = await req.json();
    const { appointmentId, businessId, staffId, currentAppointmentEndTime, currentAppointmentDate } = body;

    if (!appointmentId || !businessId || !staffId || !currentAppointmentEndTime || !currentAppointmentDate) {
      throw new Error('Missing required parameters: appointmentId, businessId, staffId, currentAppointmentEndTime, currentAppointmentDate');
    }

    console.log(`[notify-next-client] Processing appointment ${appointmentId} for business ${businessId}, staff ${staffId}`);

    // Find the next appointment in queue for the same staff, same day, starting after current appointment end time
    // Security: Filter by business_id, staff_id, and date to prevent data leakage
    // Only include valid statuses: pending, confirmed, arrived (exclude cancelled, no_show, completed, started)
    const { data: nextAppointment, error: queryError } = await supabase
      .from('appointments')
      .select(`
        id,
        client_id,
        client_name,
        client_email,
        client_phone,
        start_time,
        appointment_date,
        date,
        user_id,
        status,
        clients!appointments_client_id_fkey(
          id,
          user_id,
          full_name,
          email,
          phone
        )
      `)
      .eq('business_id', businessId) // Security: Same business
      .eq('staff_id', staffId) // Security: Same staff
      .in('status', ['pending', 'confirmed']) // Only valid statuses (exclude cancelled, no_show, completed, started)
      .neq('id', appointmentId) // Exclude current appointment
      .gte('start_time', currentAppointmentEndTime) // Start after current appointment ends
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Additional security check: Verify the appointment is on the same day
    // This is done in code to handle both appointment_date (timestamptz) and date (date) fields
    if (nextAppointment) {
      const nextApptDate = nextAppointment.appointment_date 
        ? new Date(nextAppointment.appointment_date).toISOString().split('T')[0]
        : nextAppointment.date;
      
      if (nextApptDate !== currentAppointmentDate) {
        console.log(`[notify-next-client] Next appointment ${nextAppointment.id} is on different day (${nextApptDate} vs ${currentAppointmentDate}), skipping`);
        return new Response(
          JSON.stringify({ success: true, message: 'Next appointment is on different day', notified: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (queryError) {
      console.error('[notify-next-client] Error querying next appointment:', queryError);
      throw queryError;
    }

    if (!nextAppointment) {
      console.log(`[notify-next-client] No next appointment found for appointment ${appointmentId}`);
      return new Response(
        JSON.stringify({ success: true, message: 'No next appointment in queue', notified: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[notify-next-client] Found next appointment: ${nextAppointment.id} for client ${nextAppointment.client_id || nextAppointment.user_id}`);

    // Get client info - prefer client_id record, fallback to user_id
    let clientUserId: string | null = null;
    let clientPhone: string | null = null;
    let clientName: string | null = null;
    let clientEmail: string | null = null;

    if (nextAppointment.client_id && nextAppointment.clients) {
      // Business client record exists
      clientUserId = nextAppointment.clients.user_id || null;
      clientPhone = nextAppointment.clients.phone || nextAppointment.client_phone || null;
      clientName = nextAppointment.clients.full_name || nextAppointment.client_name || null;
      clientEmail = nextAppointment.clients.email || nextAppointment.client_email || null;
    } else if (nextAppointment.user_id) {
      // No business client record, use user_id to get profile
      clientUserId = nextAppointment.user_id;
      clientPhone = nextAppointment.client_phone || null;
      clientName = nextAppointment.client_name || null;
      clientEmail = nextAppointment.client_email || null;

      // Try to get phone from client_profiles or profiles
      if (!clientPhone || !clientName) {
        const { data: profileData } = await supabase
          .from('client_profiles')
          .select('phone, full_name, email')
          .eq('id', clientUserId)
          .maybeSingle();

        if (profileData) {
          clientPhone = clientPhone || profileData.phone || null;
          clientName = clientName || profileData.full_name || null;
          clientEmail = clientEmail || profileData.email || null;
        } else {
          // Fallback to profiles table
          const { data: profileData2 } = await supabase
            .from('profiles')
            .select('phone, full_name')
            .eq('id', clientUserId)
            .maybeSingle();

          if (profileData2) {
            clientPhone = clientPhone || profileData2.phone || null;
            clientName = clientName || profileData2.full_name || null;
          }
        }
      }
    }

    if (!clientPhone) {
      console.warn(`[notify-next-client] No phone number found for next appointment ${nextAppointment.id}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Next appointment found but no phone number available', notified: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format appointment date and time
    const appointmentDate = nextAppointment.appointment_date 
      ? new Date(nextAppointment.appointment_date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
      : nextAppointment.date 
        ? new Date(nextAppointment.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
        : 'próximamente';

    const appointmentTime = nextAppointment.start_time || '';

    // Create notification message according to requirements
    // "Tu cita es la siguiente. Por favor acércate al establecimiento."
    const message = clientName 
      ? `Hola ${clientName}! Tu cita es la siguiente. Por favor acércate al establecimiento para mantener la puntualidad.${appointmentTime ? ` Tu cita es a las ${appointmentTime}` : ''}${appointmentDate ? ` el ${appointmentDate}` : ''}.`
      : `Tu cita es la siguiente. Por favor acércate al establecimiento para mantener la puntualidad.${appointmentTime ? ` Tu cita es a las ${appointmentTime}` : ''}${appointmentDate ? ` el ${appointmentDate}` : ''}.`;

    console.log(`[notify-next-client] Sending notification to ${clientPhone}: ${message.substring(0, 50)}...`);

    // Send SMS via send-sms-reminder Edge Function
    const smsFunctionUrl = `${supabaseUrl}/functions/v1/send-sms-reminder`;
    const smsResponse = await fetch(smsFunctionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: clientPhone,
        message: message,
        appointmentId: nextAppointment.id,
        businessId: businessId,
      }),
    });

    if (!smsResponse.ok) {
      const errorText = await smsResponse.text();
      console.error('[notify-next-client] SMS sending failed:', errorText);
      throw new Error(`SMS sending failed: ${errorText}`);
    }

    const smsResult = await smsResponse.json();
    console.log(`[notify-next-client] SMS sent successfully: ${smsResult.messageSid}`);

    // Log notification in appointment_notifications table
    await supabase
      .from('appointment_notifications')
      .insert({
        appointment_id: nextAppointment.id,
        send_at: new Date().toISOString(),
        status: 'sent',
        meta: {
          type: 'next_in_queue',
          triggered_by_appointment_id: appointmentId,
          message: message,
          phone: clientPhone,
          client_name: clientName,
        },
      });

    // Create client notification for BookWise Client app (if user_id exists)
    if (clientUserId) {
      await supabase
        .from('client_notifications')
        .insert({
          user_id: clientUserId,
          appointment_id: nextAppointment.id,
          business_id: businessId,
          type: 'next_in_queue',
          title: 'Eres el siguiente',
          message: message,
          read: false,
          meta: {
            appointment_date: nextAppointment.appointment_date || nextAppointment.date,
            start_time: nextAppointment.start_time,
            business_id: businessId,
            triggered_by_appointment_id: appointmentId,
          },
        });
    }

    // If client has push token, send push notification (future enhancement)
    if (clientUserId) {
      const { data: clientProfile } = await supabase
        .from('client_profiles')
        .select('push_token')
        .eq('id', clientUserId)
        .maybeSingle();

      if (clientProfile?.push_token) {
        // TODO: Implement push notification via FCM/APNS
        console.log(`[notify-next-client] Push token found for user ${clientUserId}, but push notifications not yet implemented`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified: true,
        nextAppointmentId: nextAppointment.id,
        clientPhone: clientPhone,
        messageSid: smsResult.messageSid,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[notify-next-client] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

