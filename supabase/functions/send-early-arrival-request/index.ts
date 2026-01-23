import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendEarlyArrivalRequestParams {
  requestId: string;
  appointmentId: string;
  businessId: string;
}

serve(async (req) => {
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
      throw new Error('Missing required parameters');
    }


    const { data: request, error: requestError } = await supabase
      .from('appointment_requests')
      .select(`
        id,
        appointment_id,
        client_id,
        status,
        expires_at
      `)
      .eq('id', requestId)
      .eq('business_id', businessId)
      .single();

    if (requestError || !request) {
      throw new Error('Request not found');
    }

    const req_data = request as any;

    if (req_data.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, error: 'Request is not pending' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get appointment with client info
    const { data: appointment } = await supabase
      .from('appointments')
      .select(`
        id,
        client_id,
        start_time,
        appointment_date,
        clients(id, user_id, full_name, phone)
      `)
      .eq('id', appointmentId)
      .single();

    const apt = appointment as any;
    const clientData = apt?.clients as any;

    let clientUserId: string | null = clientData?.user_id || null;
    let clientPhone: string | null = clientData?.phone || null;
    let clientName: string | null = clientData?.full_name || null;
    let clientId: string | null = clientData?.id || req_data.client_id || null;

    // Send SMS notification
    if (clientPhone) {
      const message = clientName
        ? `Hola ${clientName}! El establecimiento indica que puedes asistir antes de tu hora programada. ¿Puedes asistir ahora?`
        : `El establecimiento indica que puedes asistir antes de tu hora programada. ¿Puedes asistir ahora?`;


      const smsFunctionUrl = `${supabaseUrl}/functions/v1/send-sms-reminder`;
      await fetch(smsFunctionUrl, {
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
    }

    // Create client notification
    if (clientUserId) {
      const notificationMessage = clientName
        ? `Hola ${clientName}! El establecimiento indica que puedes asistir antes de tu hora programada.`
        : `El establecimiento indica que puedes asistir antes de tu hora programada.`;

      await supabase
        .from('client_notifications')
        .insert({
          user_id: clientUserId,
          client_id: clientId,
          appointment_id: appointmentId,
          business_id: businessId,
          type: 'early_arrival_request',
          title: 'Solicitud de adelanto',
          message: notificationMessage,
          read: false,
          meta: {
            request_id: requestId,
            can_respond: true,
            expires_at: req_data.expires_at,
          },
        });

    }

    return new Response(
      JSON.stringify({
        success: true,
        requestId: req_data.id,
        notified: !!clientPhone || !!clientUserId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[send-early-arrival-request] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
