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

// Detect token type based on format
function detectTokenType(token: string): 'fcm' | 'apns' | 'expo' | 'unknown' {
  if (!token) return 'unknown';
  
  // Expo tokens start with "ExponentPushToken["
  if (token.startsWith('ExponentPushToken[')) return 'expo';
  
  // FCM tokens are typically long alphanumeric strings with colons
  if (token.includes(':') && token.length > 100) return 'fcm';
  
  // APNs tokens are 64 character hex strings
  if (/^[a-f0-9]{64}$/i.test(token)) return 'apns';
  
  // Default to FCM for Capacitor Android tokens
  if (token.length > 100) return 'fcm';
  
  return 'unknown';
}

// Send via Firebase Cloud Messaging (for Android/Capacitor)
async function sendViaFCM(token: string, title: string, body: string, data: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
  
  if (!fcmServerKey) {
    console.log("[FCM] No FCM_SERVER_KEY configured, skipping FCM push");
    return { success: false, error: "FCM not configured" };
  }

  try {
    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `key=${fcmServerKey}`,
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title,
          body,
          sound: "default",
          badge: 1,
        },
        data: {
          ...data,
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
        priority: "high",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[FCM] Error:", error);
      return { success: false, error };
    }

    const result = await response.json();
    console.log("[FCM] Sent successfully:", result);
    return { success: true };
  } catch (error: any) {
    console.error("[FCM] Exception:", error);
    return { success: false, error: error.message };
  }
}

// Send via Expo Push API (fallback for Expo tokens)
async function sendViaExpo(token: string, title: string, body: string, data: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data,
        sound: "default",
        badge: 1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Expo] Error:", error);
      return { success: false, error };
    }

    const result = await response.json();
    console.log("[Expo] Sent successfully:", result);
    return { success: true };
  } catch (error: any) {
    console.error("[Expo] Exception:", error);
    return { success: false, error: error.message };
  }
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

    console.log(`[Push] Notification request for user ${targetUserId || clientId}: ${title}`);

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
      console.log("[Push] In-app notification created");
    }

    // If no push token, return success but note that push wasn't sent
    if (!pushToken) {
      console.log("[Push] No push token found, skipping push notification");
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

    // Detect token type and send accordingly
    const tokenType = detectTokenType(pushToken);
    console.log(`[Push] Token type detected: ${tokenType}`);

    const pushData = {
      ...data,
      appointmentId,
      notificationType,
    };

    let pushResult: { success: boolean; error?: string };

    switch (tokenType) {
      case 'fcm':
        pushResult = await sendViaFCM(pushToken, title, body, pushData);
        break;
      case 'expo':
        pushResult = await sendViaExpo(pushToken, title, body, pushData);
        break;
      default:
        // Try FCM first (most common for Capacitor), then Expo as fallback
        pushResult = await sendViaFCM(pushToken, title, body, pushData);
        if (!pushResult.success) {
          console.log("[Push] FCM failed, trying Expo as fallback");
          pushResult = await sendViaExpo(pushToken, title, body, pushData);
        }
    }

    if (!pushResult.success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          pushSent: false, 
          reason: "push_api_error",
          error: pushResult.error,
          inAppCreated: true 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pushSent: true, 
        tokenType,
        inAppCreated: true 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[Push] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
