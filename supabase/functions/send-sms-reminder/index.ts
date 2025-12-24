import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Base de datos central compartida con BookWise Client
const CENTRAL_SUPABASE_URL = "https://rdznelijpliklisnflfm.supabase.co";

interface SMSRequest {
  to: string;
  message: string;
  appointmentId?: string;
  businessId?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, message, appointmentId, businessId }: SMSRequest = await req.json();

    if (!to || !message) {
      throw new Error("Phone number and message are required");
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Twilio credentials not configured");
    }

    console.log(`Sending SMS to ${to}: ${message.substring(0, 50)}...`);

    // Send SMS via Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append("To", to);
    formData.append("From", TWILIO_PHONE_NUMBER);
    formData.append("Body", message);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Twilio API error:", error);
      throw new Error(`Twilio API error: ${error}`);
    }

    const data = await response.json();
    console.log("SMS sent successfully:", data.sid);

    // Log the SMS in database using central database
    if (appointmentId && businessId) {
      const supabaseClient = createClient(
        CENTRAL_SUPABASE_URL,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabaseClient.from("sms_logs").insert({
        business_id: businessId,
        appointment_id: appointmentId,
        phone_number: to,
        message: message,
        status: "sent",
        twilio_sid: data.sid,
      });
    }

    return new Response(
      JSON.stringify({ success: true, messageSid: data.sid }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending SMS:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
