import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendEarlyArrivalRequestParams {
  requestId: string;
  appointmentId: string;
  businessId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SendEarlyArrivalRequestParams = await req.json();
    const { requestId, appointmentId, businessId } = body;

    if (!requestId || !appointmentId || !businessId) {
      throw new Error('Missing required parameters: requestId, appointmentId, businessId');
    }

    console.log(`[send-early-arrival-request] Processing request ${requestId} for appointment ${appointmentId}`);

    // Fetch request details
    const { data: request, error: requestError } = await supabase
      .from('appointment_requests')
      .select(`
        id,
        appointment_id,
        user_id,
        client_id,
        status,
        expires_at,
        appointments!appointment_requests_appointment_id_fkey(
          id,
          start_time,
          appointment_date,
          date,
          clients!appointments_client_id_fkey(
            id,
            user_id,
            full_name,
            phone
          )
        )
      `)
      .eq('id', requestId)
      .eq('business_id', businessId)
      .single();

    if (requestError || !request) {
      console.error('[send-early-arrival-request] Error fetching request:', requestError);
      throw new Error('Request not found');
    }

    if (request.status !== 'pending') {
      console.warn(`[send-early-arrival-request] Request ${requestId} is not pending (status: ${request.status})`);
      return new Response(
        JSON.stringify({ success: false, error: 'Request is not pending' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client info - prioritize request.user_id from appointment_requests
    // ✅ FIX: request.user_id ahora existe en appointment_requests y es la fuente más confiable
    let clientUserId: string | null = request.user_id || null;
    let clientId: string | null = request.client_id || null;
    let clientPhone: string | null = null;
    let clientName: string | null = null;

    console.log(`[send-early-arrival-request] ✅ Using user_id from appointment_requests: ${clientUserId}`);
    console.log(`[send-early-arrival-request] ✅ Using client_id from appointment_requests: ${clientId}`);

    // Try to get phone and name from appointment's client relationship (for SMS)
    if (request.appointments?.clients) {
      clientPhone = request.appointments.clients.phone || null;
      clientName = request.appointments.clients.full_name || null;
      // Only use appointments.clients.user_id as fallback if request.user_id is null
      if (!clientUserId) {
        clientUserId = request.appointments.clients.user_id || null;
        console.log(`[send-early-arrival-request] Fallback: Using user_id from appointments.clients: ${clientUserId}`);
      }
      // Only use appointments.clients.id as fallback if request.client_id is null
      if (!clientId) {
        clientId = request.appointments.clients.id || null;
        console.log(`[send-early-arrival-request] Fallback: Using client_id from appointments.clients: ${clientId}`);
      }
    }
    
    // If client_id is still null, try to get it from the appointment directly (fallback only)
    if (!clientId && request.appointment_id) {
      const { data: appointmentData, error: aptError } = await supabase
        .from('appointments')
        .select('client_id, user_id')
        .eq('id', request.appointment_id)
        .maybeSingle();
      
      if (aptError) {
        console.error('[send-early-arrival-request] Error fetching appointment:', aptError);
      } else if (appointmentData) {
        clientId = clientId || appointmentData.client_id || null;
        // Only use appointment.user_id as fallback if request.user_id is null
        if (!clientUserId) {
          clientUserId = appointmentData.user_id || null;
          console.log(`[send-early-arrival-request] Fallback: Using user_id from appointment: ${clientUserId}`);
        }
      }
    }

    // If we have client_id but no user_id, try to get user_id from clients table (last fallback)
    if (clientId && !clientUserId) {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('user_id')
        .eq('id', clientId)
        .maybeSingle();
      
      if (clientError) {
        console.error('[send-early-arrival-request] Error fetching client:', clientError);
      } else if (clientData?.user_id) {
        clientUserId = clientData.user_id;
        console.log(`[send-early-arrival-request] Fallback: Found user_id from clients table: ${clientUserId}`);
      }
    }

    console.log(`[send-early-arrival-request] Final clientUserId: ${clientUserId}`);
    console.log(`[send-early-arrival-request] Final clientId: ${clientId}`);

    // Try to get phone from client_profiles or profiles if not found
    if (clientUserId && (!clientPhone || !clientName)) {
      const { data: clientProfile } = await supabase
        .from('client_profiles')
        .select('phone, full_name')
        .eq('id', clientUserId)
        .maybeSingle();

      if (clientProfile) {
        clientPhone = clientPhone || clientProfile.phone || null;
        clientName = clientName || clientProfile.full_name || null;
      } else {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('phone, full_name')
          .eq('id', clientUserId)
          .maybeSingle();

        if (profileData) {
          clientPhone = clientPhone || profileData.phone || null;
          clientName = clientName || profileData.full_name || null;
        }
      }
    }

    // Send SMS notification
    if (clientPhone) {
      const message = clientName
        ? `Hola ${clientName}! El establecimiento indica que puedes asistir antes de tu hora programada. ¿Puedes asistir ahora?`
        : `El establecimiento indica que puedes asistir antes de tu hora programada. ¿Puedes asistir ahora?`;

      console.log(`[send-early-arrival-request] Sending SMS to ${clientPhone}`);

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
          appointmentId: appointmentId,
          businessId: businessId,
        }),
      });

      if (smsResponse.ok) {
        const smsResult = await smsResponse.json();
        console.log(`[send-early-arrival-request] SMS sent: ${smsResult.messageSid}`);
      } else {
        const errorText = await smsResponse.text();
        console.error('[send-early-arrival-request] SMS sending failed:', errorText);
      }
    }

    // Create client notification for BookWise Client app
    if (clientUserId) {
      const notificationMessage = clientName
        ? `Hola ${clientName}! El establecimiento indica que puedes asistir antes de tu hora programada. ¿Puedes asistir ahora?`
        : `El establecimiento indica que puedes asistir antes de tu hora programada. ¿Puedes asistir ahora?`;

      // ✅ FIX: Ensure client_id is set from request.client_id or appointment.client_id
      const finalClientId = clientId || request.client_id || request.appointments?.clients?.id || null;

      console.log(`[send-early-arrival-request] Inserting notification with:`, {
        user_id: clientUserId,
        client_id: finalClientId,
        appointment_id: appointmentId,
        business_id: businessId
      });

      const { error: notificationError } = await supabase
        .from('client_notifications')
        .insert({
          user_id: clientUserId,
          client_id: finalClientId, // ✅ FIX: Use finalClientId (from request or appointment)
          appointment_id: appointmentId,
          business_id: businessId,
          type: 'early_arrival_request',
          title: 'Solicitud de adelanto',
          message: notificationMessage, // Column is 'message', not 'body'
          read: false,
          meta: {
            request_id: requestId,
            appointment_date: request.appointments?.appointment_date || request.appointments?.date,
            start_time: request.appointments?.start_time,
            can_respond: true,
            expires_at: request.expires_at,
          },
        });

      if (notificationError) {
        console.error('[send-early-arrival-request] Error inserting notification:', notificationError);
        console.error('[send-early-arrival-request] Notification error details:', JSON.stringify(notificationError, null, 2));
        // Don't fail the whole request if notification insert fails
      } else {
        console.log(`[send-early-arrival-request] ✅ Notification created successfully for user ${clientUserId}`);
        console.log(`[send-early-arrival-request] Notification details:`, {
          user_id: clientUserId,
          client_id: clientId,
          appointment_id: appointmentId,
          type: 'early_arrival_request'
        });
      }
    } else {
      console.warn('[send-early-arrival-request] ⚠️ No clientUserId found, skipping notification');
      console.warn('[send-early-arrival-request] Debug info:', {
        request_user_id: request.user_id,
        request_client_id: request.client_id,
        appointment_id: request.appointment_id,
        has_appointment_clients: !!request.appointments?.clients,
        appointment_clients_user_id: request.appointments?.clients?.user_id
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        requestId: request.id,
        notified: !!clientPhone || !!clientUserId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[send-early-arrival-request] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

