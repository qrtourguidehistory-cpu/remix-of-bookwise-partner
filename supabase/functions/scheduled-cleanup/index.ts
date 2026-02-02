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

    // Calcular la fecha límite: hace 24 horas
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const cutoffDate = twentyFourHoursAgo.toISOString();

    console.log(`🧹 Iniciando limpieza de notificaciones anteriores a: ${cutoffDate}`);

    // Eliminar registros de la tabla notifications con más de 24 horas
    const { data: deletedNotifications, error: notificationsError } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', cutoffDate)
      .select();

    if (notificationsError) {
      console.error('❌ Error eliminando notificaciones de la tabla notifications:', notificationsError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: notificationsError.message,
          message: 'Error al limpiar notificaciones'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notificationsDeleted = deletedNotifications?.length || 0;
    console.log(`✅ Eliminadas ${notificationsDeleted} notificaciones de la tabla notifications`);

    // Eliminar registros de la tabla client_notifications con más de 24 horas
    const { data: deletedClientNotifications, error: clientNotificationsError } = await supabase
      .from('client_notifications')
      .delete()
      .lt('created_at', cutoffDate)
      .select();

    if (clientNotificationsError) {
      console.error('❌ Error eliminando notificaciones de la tabla client_notifications:', clientNotificationsError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: clientNotificationsError.message,
          message: 'Error al limpiar notificaciones de clientes'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientNotificationsDeleted = deletedClientNotifications?.length || 0;
    console.log(`✅ Eliminadas ${clientNotificationsDeleted} notificaciones de la tabla client_notifications`);

    const totalDeleted = notificationsDeleted + clientNotificationsDeleted;

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Limpieza completada exitosamente',
        deleted: {
          notifications: notificationsDeleted,
          client_notifications: clientNotificationsDeleted,
          total: totalDeleted
        },
        cutoff_date: cutoffDate
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error inesperado en scheduled-cleanup:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error?.message || 'Unknown error',
        message: 'Error inesperado durante la limpieza'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

