import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PartnerNotificationRequest {
  business_id: string;
  user_id: string; // owner_id del negocio
  type: 
    | 'new_appointment' 
    | 'appointment_status_change' 
    | 'early_arrival_request' 
    | 'early_arrival_approved'
    | 'early_arrival_rejected'
    | 'review_received'
    | 'payment_received'
    | 'payment_reminder'
    | 'credit_payment'
    | 'monthly_payment_reminder';
  title: string;
  message: string;
  appointment_id?: string;
  client_id?: string;
  link?: string;
  meta?: Record<string, any>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: PartnerNotificationRequest = await req.json();

    if (!data.business_id || !data.user_id || !data.type || !data.title || !data.message) {
      throw new Error("Missing required fields: business_id, user_id, type, title, message");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    // ✅ Usar service role para insertar en notifications
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insertar notificación en la tabla notifications (solo service role puede hacerlo)
    const { data: notification, error: insertError } = await supabase
      .from("notifications")
      .insert({
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        message: data.message,
        read: false,
        link: data.link || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Partner Notification] Error inserting:", insertError);
      throw new Error(`Failed to insert notification: ${insertError.message}`);
    }


    // Obtener push token del partner (owner)
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
            console.error(`[Partner Notification] FCM failed:`, await fcmResponse.text());
          }
        } catch (fcmError) {
          console.error("[Partner Notification] FCM error:", fcmError);
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
    console.error("[Partner Notification] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

