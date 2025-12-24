import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteClientEarlyRequest {
  appointmentId: string;
  businessId: string;
  staffId: string;
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
    const body: InviteClientEarlyRequest = await req.json();
    const { appointmentId, businessId, staffId } = body;

    if (!appointmentId || !businessId || !staffId) {
      throw new Error('Missing required parameters: appointmentId, businessId, staffId');
    }

    console.log(`[invite-client-early] Processing appointment ${appointmentId} for business ${businessId}, staff ${staffId}`);

    // Call the PostgreSQL function to handle the logic
    const { data: functionResult, error: functionError } = await supabase.rpc('invite_client_early', {
      p_appointment_id: appointmentId,
      p_business_id: businessId,
      p_staff_id: staffId,
    });

    if (functionError) {
      console.error('[invite-client-early] Function error:', functionError);
      throw functionError;
    }

    if (!functionResult || !functionResult.success) {
      const errorMsg = functionResult?.error || 'Unknown error';
      console.error(`[invite-client-early] Function returned error: ${errorMsg}`);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch appointment details for notification
    const { data: appointment, error: appointmentError } = await supabase
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
        clients!appointments_client_id_fkey(
          id,
          user_id,
          full_name,
          email,
          phone
        )
      `)
      .eq('id', appointmentId)
      .eq('business_id', businessId)
      .single();

    if (appointmentError || !appointment) {
      console.error('[invite-client-early] Error fetching appointment:', appointmentError);
      // Still return success since the function already updated the database
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Early invitation marked but notification not sent',
          error: appointmentError?.message 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client info
    let clientUserId: string | null = null;
    let clientPhone: string | null = null;
    let clientName: string | null = null;
    let clientEmail: string | null = null;

    if (appointment.client_id && appointment.clients) {
      clientUserId = appointment.clients.user_id || null;
      clientPhone = appointment.clients.phone || appointment.client_phone || null;
      clientName = appointment.clients.full_name || appointment.client_name || null;
      clientEmail = appointment.clients.email || appointment.client_email || null;
    } else if (appointment.user_id) {
      clientUserId = appointment.user_id;
      clientPhone = appointment.client_phone || null;
      clientName = appointment.client_name || null;
      clientEmail = appointment.client_email || null;

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

    // Send push notification if client has push token
    let pushSent = false;
    if (clientUserId) {
      const { data: clientProfile } = await supabase
        .from('client_profiles')
        .select('push_token')
        .eq('id', clientUserId)
        .maybeSingle();

      if (clientProfile?.push_token) {
        // TODO: Implement push notification via FCM/APNS
        // For now, we'll send SMS as fallback
        console.log(`[invite-client-early] Push token found for user ${clientUserId}, but push notifications not yet implemented`);
      }
    }

    // Send SMS notification as primary/fallback method
    if (clientPhone) {
      const message = clientName
        ? `Hola ${clientName}! El establecimiento está disponible antes de lo previsto. ¿Puedes asistir ahora?`
        : `El establecimiento está disponible antes de lo previsto. ¿Puedes asistir ahora?`;

      console.log(`[invite-client-early] Sending SMS to ${clientPhone}: ${message.substring(0, 50)}...`);

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
          appointmentId: appointment.id,
          businessId: businessId,
        }),
      });

      if (smsResponse.ok) {
        const smsResult = await smsResponse.json();
        console.log(`[invite-client-early] SMS sent successfully: ${smsResult.messageSid}`);
      } else {
        const errorText = await smsResponse.text();
        console.error('[invite-client-early] SMS sending failed:', errorText);
      }
    }

    // Log notification in appointment_notifications
    await supabase
      .from('appointment_notifications')
      .insert({
        appointment_id: appointmentId,
        send_at: new Date().toISOString(),
        status: 'sent',
        meta: {
          type: 'early_invite',
          message: 'El establecimiento está disponible antes de lo previsto. ¿Puedes asistir ahora?',
          phone: clientPhone,
          client_name: clientName,
        },
      });

    // Create client notification for BookWise Client app (if user_id exists)
    if (clientUserId) {
      const notificationMessage = clientName
        ? `Hola ${clientName}! El establecimiento está disponible antes de lo previsto. ¿Puedes asistir ahora?`
        : `El establecimiento está disponible antes de lo previsto. ¿Puedes asistir ahora?`;

      await supabase
        .from('client_notifications')
        .insert({
          user_id: clientUserId,
          appointment_id: appointmentId,
          business_id: businessId,
          type: 'early_invite',
          title: 'Invitación anticipada',
          message: notificationMessage,
          read: false,
          meta: {
            appointment_date: appointment.appointment_date || appointment.date,
            start_time: appointment.start_time,
            business_id: businessId,
            can_confirm: true,
          },
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        appointmentId: appointmentId,
        early_invited_at: functionResult.early_invited_at,
        notified: !!clientPhone,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[invite-client-early] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

