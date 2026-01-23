import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyNextClientRequest {
  appointmentId: string;
  businessId: string;
  staffId: string;
  currentAppointmentEndTime: string;
  currentAppointmentDate: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotifyNextClientRequest = await req.json();
    const { appointmentId, businessId, staffId, currentAppointmentEndTime, currentAppointmentDate } = body;

    if (!appointmentId || !businessId || !staffId || !currentAppointmentEndTime || !currentAppointmentDate) {
      throw new Error('Missing required parameters');
    }


    const { data: nextAppointment, error: queryError } = await supabase
      .from('appointments')
      .select(`
        id,
        client_id,
        start_time,
        appointment_date,
        status,
        clients(id, user_id, full_name, email, phone)
      `)
      .eq('business_id', businessId)
      .eq('staff_id', staffId)
      .in('status', ['pending', 'confirmed'])
      .neq('id', appointmentId)
      .gte('start_time', currentAppointmentEndTime)
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error('[notify-next-client] Error:', queryError);
      throw queryError;
    }

    if (!nextAppointment) {
      return new Response(
        JSON.stringify({ success: true, message: 'No next appointment in queue', notified: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apt = nextAppointment as any;
    const clientData = apt.clients as any;

    let clientUserId: string | null = clientData?.user_id || null;
    let clientPhone: string | null = clientData?.phone || null;
    let clientName: string | null = clientData?.full_name || null;

    if (!clientPhone) {
      return new Response(
        JSON.stringify({ success: true, message: 'No phone number available', notified: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appointmentDate = apt.appointment_date 
      ? new Date(apt.appointment_date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
      : 'próximamente';

    const message = clientName 
      ? `Hola ${clientName}! Tu cita es la siguiente. Por favor acércate al establecimiento.`
      : `Tu cita es la siguiente. Por favor acércate al establecimiento.`;


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
        appointmentId: apt.id,
        businessId: businessId,
      }),
    });

    if (!smsResponse.ok) {
      const errorText = await smsResponse.text();
      console.error('[notify-next-client] SMS failed:', errorText);
      throw new Error(`SMS failed: ${errorText}`);
    }

    const smsResult = await smsResponse.json();

    await supabase
      .from('appointment_notifications')
      .insert({
        appointment_id: apt.id,
        business_id: businessId,
        notification_type: 'next_in_queue',
        send_at: new Date().toISOString(),
        status: 'sent',
        meta: {
          triggered_by_appointment_id: appointmentId,
          message: message,
          phone: clientPhone,
        },
      });

    if (clientUserId) {
      await supabase
        .from('client_notifications')
        .insert({
          user_id: clientUserId,
          appointment_id: apt.id,
          business_id: businessId,
          type: 'next_in_queue',
          title: 'Eres el siguiente',
          message: message,
          read: false,
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified: true,
        nextAppointmentId: apt.id,
        messageSid: smsResult.messageSid,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[notify-next-client] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
