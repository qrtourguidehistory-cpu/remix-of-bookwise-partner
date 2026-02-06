import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import admin from "npm:firebase-admin@11.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  appointment_id: string;
  business_id: string;
  staff_id: string;
  current_appointment_end_time: string;
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
    const { appointment_id, business_id, staff_id, current_appointment_end_time }: RequestBody = await req.json();
    
    console.log("📨 [notify-next-in-queue] Evento: Próximo en cola");
    console.log("📋 [notify-next-in-queue] appointment_id:", appointment_id);
    
    if (!appointment_id || !business_id || !staff_id || !current_appointment_end_time) {
      return new Response(
        JSON.stringify({ success: false, error: "appointment_id, business_id, staff_id y current_appointment_end_time son requeridos" }),
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

    // Buscar siguiente cita en cola
    const { data: nextAppointment, error: queryError } = await supabase
      .from('appointments')
      .select(`
        id,
        client_id,
        start_time,
        appointment_date,
        clients!inner(id, user_id, full_name)
      `)
      .eq('business_id', business_id)
      .eq('staff_id', staff_id)
      .in('status', ['pending', 'confirmed'])
      .neq('id', appointment_id)
      .gte('start_time', current_appointment_end_time)
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error("❌ [notify-next-in-queue] Error buscando siguiente cita:", queryError);
      return new Response(
        JSON.stringify({ success: false, error: "Error buscando siguiente cita" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!nextAppointment) {
      console.log("ℹ️ [notify-next-in-queue] No hay siguiente cita en cola");
      return new Response(
        JSON.stringify({ success: true, pushSent: false, message: "No next appointment in queue" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = (nextAppointment.clients as any);
    const clientUserId = client?.user_id;

    if (!clientUserId || typeof clientUserId !== 'string') {
      console.warn("⚠️ [notify-next-in-queue] Cliente no tiene user_id");
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

    console.log("✅ [notify-next-in-queue] user_id receptor:", clientUserId);

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
      console.warn("⚠️ [notify-next-in-queue] No se encontraron dispositivos activos");
      return new Response(
        JSON.stringify({ success: true, pushSent: false, message: "No devices found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📱 [notify-next-in-queue] Dispositivos encontrados: ${devices.length}`);

    console.log("🔍 [notify-next-in-queue] Buscando secret FIREBASE_SERVICE_ACCOUNT_CLIENT...");
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_CLIENT");
    if (!serviceAccountJson) {
      console.error("❌ [notify-next-in-queue] FIREBASE_SERVICE_ACCOUNT_CLIENT no configurado");
      return new Response(
        JSON.stringify({ success: false, error: "FIREBASE_SERVICE_ACCOUNT_CLIENT not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ [notify-next-in-queue] Secret encontrado");

    let serviceAccount: admin.ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
      console.log("✅ [notify-next-in-queue] Secret parseado correctamente");
    } catch (error: any) {
      console.error("❌ [notify-next-in-queue] Error parseando secret:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Error parseando FIREBASE_SERVICE_ACCOUNT_CLIENT" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🚀 [notify-next-in-queue] Inicializando Firebase Admin...");
    const firebaseApp = getFirebaseApp(serviceAccount);
    const messaging = admin.messaging(firebaseApp);
    console.log("✅ [notify-next-in-queue] Firebase Admin inicializado exitosamente");

    const clientName = client?.full_name || 'Cliente';
    const title = "Eres el siguiente";
    const body = `Hola ${clientName}! Tu cita es la siguiente. Por favor acércate al establecimiento.`;

    const results = await Promise.allSettled(
      devices.map(async (device: Device) => {
        try {
          await messaging.send({
            token: device.fcm_token,
            notification: { title, body },
            data: {
              type: "next_in_queue",
              appointment_id: nextAppointment.id,
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
          console.log(`✅ [notify-next-in-queue] Push enviado a dispositivo ${device.id}`);
          return { deviceId: device.id, status: "fulfilled" };
        } catch (err: any) {
          console.error(`❌ [notify-next-in-queue] Error en dispositivo ${device.id}:`, err.message);
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

    console.log(`📊 [notify-next-in-queue] Resultados: ${successful} exitosos, ${failed} fallidos`);

    return new Response(
      JSON.stringify({
        success: true,
        pushSent: successful > 0,
        sent: successful,
        failed: failed,
        total: devices.length,
        appointment_id: nextAppointment.id,
        user_id: clientUserId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ [notify-next-in-queue] Error general:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

