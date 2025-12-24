import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  userId?: string;
  clientId?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  businessId: string;
  appointmentId?: string;
  notificationType?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      userId, 
      clientId, 
      title, 
      body, 
      data,
      businessId,
      appointmentId,
      notificationType 
    }: PushNotificationRequest = await req.json();

    if (!title || !body) {
      throw new Error("Title and body are required");
    }

    if (!userId && !clientId) {
      throw new Error("Either userId or clientId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get push token from profiles or clients table
    let pushToken: string | null = null;
    let targetUserId: string | null = userId || null;

    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("push_token")
        .eq("id", userId)
        .maybeSingle();
      
      pushToken = profile?.push_token || null;
    } else if (clientId) {
      // Get user_id from client, then get push token from their profile
      const { data: client } = await supabase
        .from("clients")
        .select("user_id")
        .eq("id", clientId)
        .maybeSingle();

      if (client?.user_id) {
        targetUserId = client.user_id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("push_token")
          .eq("id", client.user_id)
          .maybeSingle();
        
        pushToken = profile?.push_token || null;
      }
    }

    console.log(`Push notification request for user ${targetUserId || clientId}: ${title}`);

    // Create in-app notification regardless of push token
    if (businessId) {
      await supabase.from("client_notifications").insert({
        business_id: businessId,
        user_id: targetUserId,
        client_id: clientId,
        appointment_id: appointmentId,
        title,
        message: body,
        type: notificationType || "general",
        meta: data || {},
      });
      console.log("In-app notification created");
    }

    // If no push token, return success but note that push wasn't sent
    if (!pushToken) {
      console.log("No push token found, skipping push notification");
      return new Response(
        JSON.stringify({ 
          success: true, 
          pushSent: false, 
          reason: "no_push_token",
          inAppCreated: true 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send push notification via Expo Push API (for Capacitor/React Native apps)
    // This is a generic implementation that works with Expo Push Notification Service
    const expoPushUrl = "https://exp.host/--/api/v2/push/send";
    
    const pushPayload = {
      to: pushToken,
      title,
      body,
      data: {
        ...data,
        appointmentId,
        notificationType,
      },
      sound: "default",
      badge: 1,
    };

    console.log("Sending push notification to:", pushToken.substring(0, 20) + "...");

    const pushResponse = await fetch(expoPushUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(pushPayload),
    });

    if (!pushResponse.ok) {
      const error = await pushResponse.text();
      console.error("Push notification error:", error);
      // Don't throw, just log - in-app notification was still created
      return new Response(
        JSON.stringify({ 
          success: true, 
          pushSent: false, 
          reason: "push_api_error",
          error,
          inAppCreated: true 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const pushResult = await pushResponse.json();
    console.log("Push notification sent successfully:", pushResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pushSent: true, 
        pushResult,
        inAppCreated: true 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending push notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
