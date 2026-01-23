import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClientNotificationRequest {
  business_id: string;
  user_id: string; // user_id del cliente
  client_id?: string;
  appointment_id?: string;
  type: 
    | 'confirmation' 
    | 'reminder' 
    | 'early_invite' 
    | 'status_change' 
    | 'next_in_queue'
    | 'cancellation' 
    | 'completed' 
    | 'review_request' 
    | 'early_arrival_request' 
    | 'review_response';
  title: string;
  message: string;
  link?: string;
  meta?: Record<string, any>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ClientNotificationRequest = await req.json();

    if (!data.business_id || !data.user_id || !data.type || !data.title || !data.message) {
      throw new Error("Missing required fields: business_id, user_id, type, title, message");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    // ✅ Usar service role para insertar en client_notifications
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insertar notificación en la tabla client_notifications (solo service role puede hacerlo)
    const { data: notification, error: insertError } = await supabase
      .from("client_notifications")
      .insert({
        business_id: data.business_id,
        user_id: data.user_id,
        client_id: data.client_id || null,
        appointment_id: data.appointment_id || null,
        type: data.type,
        title: data.title,
        message: data.message,
        read: false,
        link: data.link || null,
        meta: data.meta || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Client Notification] Error inserting:", insertError);
      throw new Error(`Failed to insert notification: ${insertError.message}`);
    }


    // Obtener push token del cliente
    const { data: profile } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", data.user_id)
      .maybeSingle();

    const pushToken = profile?.push_token;

    // Si hay push token, enviar FCM
    if (pushToken) {
      const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
      
      if (fcmServerKey) {
        try {
          const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `key=${fcmServerKey}`,
            },
            body: JSON.stringify({
              to: pushToken,
              notification: {
                title: data.title,
                body: data.message,
                sound: "default",
                badge: 1,
              },
              data: {
                type: data.type,
                appointment_id: data.appointment_id || "",
                business_id: data.business_id,
                link: data.link || "",
                ...data.meta,
              },
              priority: "high",
            }),
          });

          if (fcmResponse.ok) {
          } else {
            console.error(`[Client Notification] FCM failed:`, await fcmResponse.text());
          }
        } catch (fcmError) {
          console.error("[Client Notification] FCM error:", fcmError);
          // No fallar si FCM falla, la notificación ya está en la BD
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification_id: notification.id,
        push_sent: !!pushToken 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[Client Notification] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

