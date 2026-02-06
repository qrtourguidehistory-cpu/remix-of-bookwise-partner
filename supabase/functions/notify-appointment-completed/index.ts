import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import admin from "npm:firebase-admin@11.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  appointment_id: string;
}

interface Device {
  id: string;
  user_id: string;
  fcm_token: string;
  platform?: string;
}

function getFirebaseApp(serviceAccount: admin.ServiceAccount): admin.app.App {
  const appName = "app-client";
  try {
    const existingApps = admin.apps || [];
    const existingApp = existingApps.find((a: any) => a && a.name === appName);
    if (existingApp) return admin.app(appName);
    return admin.initializeApp(
      { credential: admin.credential.cert(serviceAccount) },
      appName
    );
  } catch (error: any) {
    if (error.code === "app/duplicate-app") return admin.app(appName);
    throw error;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { appointment_id }: RequestBody = await req.json();
    
    console.log("📨 [notify-appointment-completed] Evento: Cita completada");
    console.log("📋 [notify-appointment-completed] appointment_id:", appointment_id);
    
    if (!appointment_id || typeof appointment_id !== 'string' || appointment_id.trim() === '') {
      console.error("❌ [notify-appointment-completed] appointment_id es requerido");
      return new Response(
        JSON.stringify({ success: false, error: "appointment_id es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Supabase credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select(`
        id,
        business_id,
        client_id,
        clients!inner(id, user_id, full_name)
      `)
      .eq("id", appointment_id)
      .single();

    if (appointmentError || !appointment) {
      console.error("❌ [notify-appointment-completed] Error obteniendo cita:", appointmentError);
      return new Response(
        JSON.stringify({ success: false, error: "Cita no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = (appointment.clients as any);
    const clientUserId = client?.user_id;

    if (!clientUserId || typeof clientUserId !== 'string') {
      console.warn("⚠️ [notify-appointment-completed] Cliente no tiene user_id");
      return new Response(
        JSON.stringify({ success: true, message: "Cliente no tiene user_id, no se envía push" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientUserId.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ [notify-appointment-completed] user_id receptor:", clientUserId);

    const { data: devices, error: devicesError } = await supabase
      .from("client_devices")
      .select("id, user_id, fcm_token, platform")
      .eq("user_id", clientUserId)
      .eq("role", "client")
      .eq("is_active", true)
      .eq("enabled", true)
      .not("fcm_token", "is", null)
      .neq("fcm_token", "");

    if (devicesError) {
      return new Response(
        JSON.stringify({ success: false, error: "Error consultando dispositivos" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!devices || devices.length === 0) {
      console.warn("⚠️ [notify-appointment-completed] No se encontraron dispositivos activos");
      return new Response(
        JSON.stringify({ success: true, pushSent: false, message: "No devices found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📱 [notify-appointment-completed] Dispositivos encontrados: ${devices.length}`);

    console.log("🔍 [notify-appointment-completed] Buscando secret FIREBASE_SERVICE_ACCOUNT_CLIENT...");
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_CLIENT");
    if (!serviceAccountJson) {
      console.error("❌ [notify-appointment-completed] FIREBASE_SERVICE_ACCOUNT_CLIENT no configurado");
      return new Response(
        JSON.stringify({ success: false, error: "FIREBASE_SERVICE_ACCOUNT_CLIENT not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ [notify-appointment-completed] Secret encontrado");

    let serviceAccount: admin.ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
      console.log("✅ [notify-appointment-completed] Secret parseado correctamente");
    } catch (error: any) {
      console.error("❌ [notify-appointment-completed] Error parseando secret:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Error parseando FIREBASE_SERVICE_ACCOUNT_CLIENT" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🚀 [notify-appointment-completed] Inicializando Firebase Admin...");
    const firebaseApp = getFirebaseApp(serviceAccount);
    const messaging = admin.messaging(firebaseApp);
    console.log("✅ [notify-appointment-completed] Firebase Admin inicializado exitosamente");

    const title = "Cita completada";
    const body = "Tu cita ha sido completada. ¡Gracias por visitarnos! ¿Cómo fue tu experiencia?";

    const results = await Promise.allSettled(
      devices.map(async (device: Device) => {
        try {
          await messaging.send({
            token: device.fcm_token,
            notification: { title, body },
            data: {
              type: "appointment_completed",
              appointment_id: appointment_id,
            },
            android: {
              priority: "high" as const,
              notification: { channelId: "default", sound: "default" },
            },
            apns: {
              payload: {
                aps: { sound: "default", badge: 1 },
              },
            },
          });
          console.log(`✅ [notify-appointment-completed] Push enviado a dispositivo ${device.id}`);
          return { deviceId: device.id, status: "fulfilled" };
        } catch (err: any) {
          console.error(`❌ [notify-appointment-completed] Error en dispositivo ${device.id}:`, err.message);
          if (err.code === 'messaging/registration-token-not-registered' || 
              err.code === 'messaging/invalid-registration-token') {
            await supabase
              .from("client_devices")
              .update({ enabled: false, is_active: false, fcm_token: null })
              .eq("id", device.id);
          }
          throw { deviceId: device.id, error: err.message, code: err.code };
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`📊 [notify-appointment-completed] Resultados: ${successful} exitosos, ${failed} fallidos`);

    return new Response(
      JSON.stringify({
        success: true,
        pushSent: successful > 0,
        sent: successful,
        failed: failed,
        total: devices.length,
        appointment_id: appointment_id,
        user_id: clientUserId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ [notify-appointment-completed] Error general:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

