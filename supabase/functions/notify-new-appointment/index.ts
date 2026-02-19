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
  const appName = "app-partner";
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
    
    console.log("📨 [notify-new-appointment] Evento: Nueva cita creada");
    console.log("📋 [notify-new-appointment] appointment_id:", appointment_id);
    
    if (!appointment_id || typeof appointment_id !== 'string' || appointment_id.trim() === '') {
      console.error("❌ [notify-new-appointment] appointment_id es requerido");
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

    // Obtener información de la cita y negocio
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select(`
        id,
        business_id,
        client_id,
        client_name,
        appointment_date,
        start_time,
        businesses!inner(id, owner_id, business_name)
      `)
      .eq("id", appointment_id)
      .single();

    if (appointmentError || !appointment) {
      console.error("❌ [notify-new-appointment] Error obteniendo cita:", appointmentError);
      return new Response(
        JSON.stringify({ success: false, error: "Cita no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const business = (appointment.businesses as any);
    const ownerId = business?.owner_id;

    if (!ownerId || typeof ownerId !== 'string') {
      console.warn("⚠️ [notify-new-appointment] Negocio no tiene owner_id");
      return new Response(
        JSON.stringify({ success: true, message: "Negocio no tiene owner_id, no se envía push" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(ownerId.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: "owner_id inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ [notify-new-appointment] user_id receptor (owner):", ownerId);

    // Buscar dispositivos activos del partner (owner)
    const { data: devices, error: devicesError } = await supabase
      .from("client_devices")
      .select("id, user_id, fcm_token, platform")
      .eq("user_id", ownerId)
      .eq("role", "partner")
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
      console.warn("⚠️ [notify-new-appointment] No se encontraron dispositivos activos");
      return new Response(
        JSON.stringify({ success: true, pushSent: false, message: "No devices found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📱 [notify-new-appointment] Dispositivos encontrados: ${devices.length}`);

    console.log("🔍 [notify-new-appointment] Buscando secret FIREBASE_SERVICE_ACCOUNT_PARTNER...");
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_PARTNER");
    if (!serviceAccountJson) {
      console.error("❌ [notify-new-appointment] FIREBASE_SERVICE_ACCOUNT_PARTNER no configurado");
      return new Response(
        JSON.stringify({ success: false, error: "FIREBASE_SERVICE_ACCOUNT_PARTNER not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ [notify-new-appointment] Secret encontrado");

    let serviceAccount: admin.ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
      console.log("✅ [notify-new-appointment] Secret parseado correctamente");
    } catch (error: any) {
      console.error("❌ [notify-new-appointment] Error parseando secret:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Error parseando FIREBASE_SERVICE_ACCOUNT_PARTNER" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🚀 [notify-new-appointment] Inicializando Firebase Admin...");
    const firebaseApp = getFirebaseApp(serviceAccount);
    const messaging = admin.messaging(firebaseApp);
    console.log("✅ [notify-new-appointment] Firebase Admin inicializado exitosamente");

    const clientName = appointment.client_name || 'Cliente';
    const title = "Nueva cita recibida";
    const body = `${clientName} ha reservado una cita`;

    const results = await Promise.allSettled(
      devices.map(async (device: Device) => {
        try {
          await messaging.send({
            token: device.fcm_token,
            notification: { title, body },
            data: {
              type: "new_appointment",
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
          console.log(`✅ [notify-new-appointment] Push enviado a dispositivo ${device.id}`);
          return { deviceId: device.id, status: "fulfilled" };
        } catch (err: any) {
          console.error(`❌ [notify-new-appointment] Error en dispositivo ${device.id}:`, err.message);
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

    console.log(`📊 [notify-new-appointment] Resultados: ${successful} exitosos, ${failed} fallidos`);

    // ✅ PASO: Insertar en notifications SOLO si el push se envió exitosamente
    if (successful > 0) {
      console.log("✅ [notify-new-appointment] PUSH_SENT - Al menos un push enviado exitosamente");
      
      const businessId = appointment.business_id;
      const clientId = appointment.client_id;
      const businessName = business?.business_name || '';
      
      try {
        // Insertar en notifications con manejo de duplicados (ON CONFLICT DO NOTHING)
        // La tabla notifications no tiene constraint UNIQUE explícito, pero manejamos errores
        const { data: insertedNotification, error: insertError } = await supabase
          .from("notifications")
          .insert({
            user_id: ownerId,
            type: "new_appointment",
            title: title,
            message: body,
            read: false,
            appointment_id: appointment_id,
            client_id: clientId,
            meta: {
              type: "new_appointment",
              business_id: businessId,
              business_name: businessName,
              client_name: clientName,
              appointment_date: appointment.appointment_date || null,
              appointment_time: appointment.start_time || null,
              consolidated: true,
              push_sent: true
            }
          })
          .select()
          .single();
        
        if (insertError) {
          // Si el error es por constraint UNIQUE (duplicado), es esperado (ON CONFLICT DO NOTHING)
          if (insertError.code === '23505' || 
              insertError.message?.includes('unique') || 
              insertError.message?.includes('duplicate') ||
              insertError.message?.includes('violates unique constraint')) {
            console.log("ℹ️ [notify-new-appointment] DB_NOTIFICATION_SKIPPED_DUPLICATE - Ya existe registro en campana (idempotencia)");
          } else {
            // Otro tipo de error, loguear pero no fallar
            console.warn("⚠️ [notify-new-appointment] Error al insertar en DB (no crítico):", insertError.message);
          }
        } else if (insertedNotification) {
          console.log("✅ [notify-new-appointment] DB_NOTIFICATION_INSERTED - Registro creado en campana exitosamente");
        }
      } catch (dbError: any) {
        // Error inesperado al insertar, loguear pero no fallar
        console.warn("⚠️ [notify-new-appointment] Excepción al insertar en DB (no crítico):", dbError.message);
      }
    } else {
      console.log("ℹ️ [notify-new-appointment] PUSH_NOT_SENT - No se envió ningún push, no se inserta en DB");
    }

    return new Response(
      JSON.stringify({
        success: true,
        pushSent: successful > 0,
        sent: successful,
        failed: failed,
        total: devices.length,
        appointment_id: appointment_id,
        user_id: ownerId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ [notify-new-appointment] Error general:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

