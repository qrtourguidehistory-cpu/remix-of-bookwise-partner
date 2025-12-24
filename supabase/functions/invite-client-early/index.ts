import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteClientEarlyRequest {
  appointmentId: string;
  businessId: string;
  staffId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: InviteClientEarlyRequest = await req.json();
    const { appointmentId, businessId, staffId } = body;

    if (!appointmentId || !businessId || !staffId) {
      throw new Error('Missing required parameters');
    }

    console.log(`[invite-client-early] Processing appointment ${appointmentId}`);

    const { data: functionResult, error: functionError } = await supabase.rpc('create_early_arrival_request', {
      p_appointment_id: appointmentId,
      p_business_id: businessId,
      p_staff_id: staffId,
    });

    if (functionError) {
      console.error('[invite-client-early] Function error:', functionError);
      throw functionError;
    }

    const result = functionResult as any;
    if (!result || !result.success) {
      const errorMsg = result?.error || 'Unknown error';
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: appointment } = await supabase
      .from('appointments')
      .select(`
        id,
        client_id,
        start_time,
        appointment_date,
        clients(id, user_id, full_name, email, phone)
      `)
      .eq('id', appointmentId)
      .eq('business_id', businessId)
      .single();

    if (!appointment) {
      return new Response(
        JSON.stringify({ success: true, message: 'Early invitation marked but notification not sent' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apt = appointment as any;
    const clientData = apt.clients as any;

    let clientUserId: string | null = clientData?.user_id || null;
    let clientPhone: string | null = clientData?.phone || null;
    let clientName: string | null = clientData?.full_name || null;

    if (clientPhone) {
      const message = clientName
        ? `Hola ${clientName}! El establecimiento está disponible antes de lo previsto. ¿Puedes asistir ahora?`
        : `El establecimiento está disponible antes de lo previsto. ¿Puedes asistir ahora?`;

      console.log(`[invite-client-early] Sending SMS to ${clientPhone}`);

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
          appointmentId: apt.id,
          businessId: businessId,
        }),
      });
    }

    await supabase
      .from('appointment_notifications')
      .insert({
        appointment_id: appointmentId,
        business_id: businessId,
        notification_type: 'early_invite',
        send_at: new Date().toISOString(),
        status: 'sent',
        meta: {
          message: 'Invitación anticipada enviada',
          phone: clientPhone,
          client_name: clientName,
        },
      });

    if (clientUserId) {
      await supabase
        .from('client_notifications')
        .insert({
          user_id: clientUserId,
          appointment_id: appointmentId,
          business_id: businessId,
          type: 'early_invite',
          title: 'Invitación anticipada',
          message: `El establecimiento está disponible antes de lo previsto. ¿Puedes asistir ahora?`,
          read: false,
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        appointmentId: appointmentId,
        notified: !!clientPhone,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[invite-client-early] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
