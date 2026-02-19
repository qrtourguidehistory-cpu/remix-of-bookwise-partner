import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import admin from "npm:firebase-admin@11.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  request_id: string;
  response: 'accepted' | 'rejected';
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
    const { request_id, response }: RequestBody = await req.json();
    
    console.log("📨 [notify-partner-client-response] ===== INICIO ===== Evento: Cliente respondió a 'puede asistir'");
    console.log("📋 [notify-partner-client-response] request_id:", request_id);
    console.log("📋 [notify-partner-client-response] response:", response);
    
    if (!request_id || typeof request_id !== 'string' || request_id.trim() === '') {
      console.error("❌ [notify-partner-client-response] request_id es requerido");
      return new Response(
        JSON.stringify({ success: false, error: "request_id es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response || !['accepted', 'rejected'].includes(response)) {
      console.error("❌ [notify-partner-client-response] response debe ser 'accepted' o 'rejected'");
      return new Response(
        JSON.stringify({ success: false, error: "response inválido" }),
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

    // Obtener información de la solicitud, cita y negocio
    const { data: request, error: requestError } = await supabase
      .from("appointment_requests")
      .select(`
        id,
        appointment_id,
        business_id,
        client_id,
        status,
        appointments!inner(
          id,
          client_name,
          appointment_date,
          start_time,
          businesses!inner(id, owner_id, business_name)
        )
      `)
      .eq("id", request_id)
      .single();

    if (requestError || !request) {
      console.error("❌ [notify-partner-client-response] Error obteniendo solicitud:", requestError);
      return new Response(
        JSON.stringify({ success: false, error: "Solicitud no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appointment = (request.appointments as any);
    const business = (appointment.businesses as any);
    const ownerId = business?.owner_id;

    console.log("✅ [notify-partner-client-response] owner_id obtenido:", ownerId);
    console.log("✅ [notify-partner-client-response] business_id:", business?.id);
    console.log("✅ [notify-partner-client-response] business_name:", business?.business_name);

    if (!ownerId || typeof ownerId !== 'string') {
      console.warn("⚠️ [notify-partner-client-response] Negocio no tiene owner_id");
      return new Response(
        JSON.stringify({ success: true, message: "Negocio no tiene owner_id, no se envía push" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obtener nombre del cliente
    const clientName = appointment.client_name || 'Cliente';
    console.log("✅ [notify-partner-client-response] client_name:", clientName);
    
    // ✅ CORRECCIÓN ETAPA 3: Obtener dispositivos activos del partner
    console.log("🔍 [notify-partner-client-response] Buscando dispositivos del partner (owner_id):", ownerId);
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
      console.error("❌ [notify-partner-client-response] Error obteniendo dispositivos:", devicesError);
      return new Response(
        JSON.stringify({ success: false, error: "Error obteniendo dispositivos" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📱 [notify-partner-client-response] Dispositivos encontrados: ${devices?.length || 0}`);

    if (!devices || devices.length === 0) {
      console.log("ℹ️ [notify-partner-client-response] No hay dispositivos activos para el partner");
      return new Response(
        JSON.stringify({ success: true, message: "No hay dispositivos activos" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ CORRECCIÓN ETAPA 3: Obtener secret de Firebase PARTNER (no cliente)
    console.log("🔍 [notify-partner-client-response] Buscando secret FIREBASE_SERVICE_ACCOUNT_PARTNER...");
    const firebaseSecret = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_PARTNER");
    if (!firebaseSecret) {
      console.error("❌ [notify-partner-client-response] FIREBASE_SERVICE_ACCOUNT_PARTNER no configurado");
      return new Response(
        JSON.stringify({ success: false, error: "Firebase secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let serviceAccount: admin.ServiceAccount;
    try {
      serviceAccount = JSON.parse(firebaseSecret);
      console.log("✅ [notify-partner-client-response] Secret encontrado");
      console.log("✅ [notify-partner-client-response] Proyecto Firebase:", serviceAccount.project_id);
    } catch (parseError) {
      console.error("❌ [notify-partner-client-response] Error parseando secret:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Error parsing Firebase secret" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ CORRECCIÓN ETAPA 3: Inicializar Firebase Admin con app PARTNER
    console.log("🚀 [notify-partner-client-response] Inicializando Firebase Admin (PARTNER)...");
    const firebaseApp = getFirebaseApp(serviceAccount);
    console.log("✅ [notify-partner-client-response] Firebase Admin inicializado (app-partner)");

    // Preparar mensaje según respuesta
    const title = response === 'accepted' 
      ? "Cliente puede asistir antes" 
      : "Cliente no puede asistir antes";
    const body = response === 'accepted'
      ? `${clientName} confirmó que puede asistir antes de su hora programada`
      : `${clientName} no puede asistir antes de su hora programada`;

    // ✅ CORRECCIÓN ETAPA 3: Enviar push a todos los dispositivos del PARTNER
    console.log("📤 [notify-partner-client-response] Preparando envío de push a", devices.length, "dispositivos...");
    const messaging = admin.messaging(firebaseApp);
    
    const results = await Promise.allSettled(
      (devices as Device[]).map(async (device: Device) => {
        try {
          const message: admin.messaging.Message = {
            token: device.fcm_token,
            notification: {
              title,
              body,
            },
            data: {
              type: "client_response",
              request_id: request_id,
              appointment_id: appointment.id,
              response: response,
              click_action: "FLUTTER_NOTIFICATION_CLICK",
            },
            android: {
              priority: "high" as const,
            },
            apns: {
              headers: {
                "apns-priority": "10",
              },
            },
          };

          console.log(`📤 [notify-partner-client-response] Enviando push a dispositivo ${device.id}...`);
          const result = await messaging.send(message);
          console.log(`✅ [notify-partner-client-response] Push enviado exitosamente a dispositivo ${device.id}`);
          return { success: true, deviceId: device.id };
        } catch (error: any) {
          console.error(`❌ [notify-partner-client-response] Error enviando push a dispositivo ${device.id}:`, error.message, error.code);
          
          // Si el token es inválido, desactivarlo
          if (error.code === "messaging/registration-token-not-registered" || 
              error.code === "messaging/invalid-registration-token") {
            console.log(`🧹 [notify-partner-client-response] Desactivando token inválido: ${device.id}`);
            await supabase
              .from("client_devices")
              .update({ is_active: false, enabled: false })
              .eq("id", device.id);
          }
          
          return { success: false, deviceId: device.id, error: error.message };
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    const failed = results.length - successful;

    console.log(`📊 [notify-partner-client-response] Resultados push: ${successful} exitosos, ${failed} fallidos`);
    
    if (successful > 0) {
      console.log("✅ [notify-partner-client-response] PUSH_SENT - Al menos un push enviado exitosamente");
    } else {
      console.log("❌ [notify-partner-client-response] PUSH_NOT_SENT - Ningún push se envió exitosamente");
    }

    // ✅ CORRECCIÓN ETAPA 3: Insertar en notifications (PARTNER) SOLO si el push se envió exitosamente
    if (successful > 0) {
      console.log("💾 [notify-partner-client-response] Intentando insertar en tabla notifications (partner)...");
      
      try {
        const notificationType = response === 'accepted' ? 'early_arrival_approved' : 'early_arrival_rejected';
        const { data: insertedNotification, error: insertError } = await supabase
          .from("notifications")
          .insert({
            user_id: ownerId,
            type: notificationType,
            title: title,
            message: body,
            read: false,
            appointment_id: appointment.id,
            meta: {
              type: notificationType,
              request_id: request_id,
              appointment_id: appointment.id,
              response: response,
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
          // Si el error es por constraint UNIQUE (duplicado), es esperado y no es un error real
          if (insertError.code === '23505' || 
              insertError.message?.includes('unique') || 
              insertError.message?.includes('duplicate')) {
            console.log("ℹ️ [notify-partner-client-response] DB_NOTIFICATION_SKIPPED_DUPLICATE - Ya existe registro en campana (idempotencia)");
          } else {
            // Otro tipo de error, loguear pero no fallar
            console.warn("⚠️ [notify-partner-client-response] Error al insertar en DB (no crítico):", insertError.message, insertError.code);
          }
        } else if (insertedNotification) {
          console.log("✅ [notify-partner-client-response] DB_NOTIFICATION_INSERTED - Registro creado en campana exitosamente");
          console.log("✅ [notify-partner-client-response] notification_id:", insertedNotification.id);
        }
      } catch (dbInsertError: any) {
        console.error("❌ [notify-partner-client-response] Excepción al insertar en notifications:", dbInsertError.message);
      }
    } else {
      console.log("ℹ️ [notify-partner-client-response] PUSH_NOT_SENT - No se envió ningún push, no se inserta en DB");
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        failed: failed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ [notify-partner-client-response] Error general:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

