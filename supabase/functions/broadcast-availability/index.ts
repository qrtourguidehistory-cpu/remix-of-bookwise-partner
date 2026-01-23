import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface BroadcastAvailabilityRequest {
  business_id: string;
  message?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: BroadcastAvailabilityRequest = await req.json();
    const { business_id, message } = body;

    if (!business_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameter: business_id' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verificar que el negocio existe
    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('id, business_name')
      .eq('id', business_id)
      .maybeSingle();

    if (businessError || !businessData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Negocio no encontrado. Verifica que el business_id sea correcto.' 
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Obtener todos los clientes registrados del negocio
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('user_id, full_name, email, phone')
      .eq('business_id', business_id);

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error al obtener los clientes del negocio.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No hay clientes registrados para este negocio.',
          sent_count: 0 
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Mensaje por defecto si no se proporciona uno
    const defaultMessage = `¡Tenemos espacio disponible! Agenda tu cita ahora en ${businessData.business_name}`;

    const broadcastMessage = message || defaultMessage;

    // Crear notificaciones para cada cliente
    const notifications = clients.map(client => ({
      user_id: client.user_id,
      business_id: business_id,
      type: 'broadcast_availability',
      title: "Espacio Disponible",
      message: broadcastMessage,
      role: 'client',
    }));

    // Insertar notificaciones
    const { error: notificationsError } = await supabase
      .from('client_notifications')
      .insert(notifications);

    if (notificationsError) {
      console.error('Error creating notifications:', notificationsError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error al crear las notificaciones.' 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Enviar push notifications (opcional - llamar a la función de push notification)
    // Por ahora solo creamos las notificaciones en la base de datos


    return new Response(
      JSON.stringify({
        success: true,
        sent_count: clients.length,
        message: `Message sent to ${clients.length} client${clients.length !== 1 ? 's' : ''}`,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Error in broadcast-availability:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

