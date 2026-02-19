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

/**
 * Inicializa o recupera la app Firebase para cliente
 */
function getFirebaseApp(serviceAccount: admin.ServiceAccount): admin.app.App {
  const appName = "app-client";
  
  try {
    const existingApps = admin.apps || [];
    const existingApp = existingApps.find((a: any) => a && a.name === appName);
    if (existingApp) {
      return admin.app(appName);
    }
    return admin.initializeApp(
      { credential: admin.credential.cert(serviceAccount) },
      appName
    );
  } catch (error: any) {
    if (error.code === "app/duplicate-app") {
      return admin.app(appName);
    }
    throw error;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { appointment_id }: RequestBody = await req.json();
    
    console.log("📨 [notify-appointment-confirmed] Evento: Cita confirmada");
    console.log("📋 [notify-appointment-confirmed] appointment_id:", appointment_id);
    
    // ✅ VALIDACIÓN 1: appointment_id es obligatorio
    if (!appointment_id || typeof appointment_id !== 'string' || appointment_id.trim() === '') {
      console.error("❌ [notify-appointment-confirmed] appointment_id es requerido");
      return new Response(
        JSON.stringify({ success: false, error: "appointment_id es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ [notify-appointment-confirmed] Supabase credentials no configuradas");
      return new Response(
        JSON.stringify({ success: false, error: "Supabase credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ✅ PASO 1: Obtener user_id del cliente (necesario para el lock)
    // Query mínima solo para obtener user_id
    const { data: appointmentPreview, error: previewError } = await supabase
      .from("appointments")
      .select(`
        id,
        client_id,
        clients!inner(id, user_id)
      `)
      .eq("id", appointment_id)
      .single();

    if (previewError || !appointmentPreview) {
      console.error("❌ [notify-appointment-confirmed] Error obteniendo preview de cita:", previewError);
      return new Response(
        JSON.stringify({ success: false, error: "Cita no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const previewClient = (appointmentPreview.clients as any);
    const clientUserId = previewClient?.user_id;

    // ✅ VALIDACIÓN 2: user_id del cliente es obligatorio
    if (!clientUserId || typeof clientUserId !== 'string') {
      console.warn("⚠️ [notify-appointment-confirmed] Cliente no tiene user_id (cita manual)");
      return new Response(
        JSON.stringify({ success: true, message: "Cliente no tiene user_id, no se envía push" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ VALIDACIÓN 3: user_id debe ser UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientUserId.trim())) {
      console.error("❌ [notify-appointment-confirmed] user_id no es UUID válido:", clientUserId);
      return new Response(
        JSON.stringify({ success: false, error: "user_id inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ [notify-appointment-confirmed] user_id receptor:", clientUserId);

    // ✅ PASO 2: LOCK ATÓMICO - INSERT en push_notification_sent como primer paso real
    // Este INSERT funciona como un lock: solo UNA ejecución puede insertar exitosamente
    // Las demás fallarán con error 23505 (duplicate key) y retornarán inmediatamente
    const notificationType = 'appointment_confirmed';
    const edgeFunctionName = 'notify-appointment-confirmed';
    
    console.log("🔒 [notify-appointment-confirmed] Intentando adquirir lock atómico...");
    
    const { error: lockError } = await supabase
      .from('push_notification_sent')
      .insert({
        appointment_id: appointment_id,
        notification_type: notificationType,
        edge_function: edgeFunctionName,
        user_id: clientUserId,
        sent_at: new Date().toISOString()
      });

    // ✅ Si el INSERT falla con error 23505 (duplicate key), significa que otra ejecución ya adquirió el lock
    if (lockError) {
      if (lockError.code === '23505' || 
          lockError.message?.includes('unique') || 
          lockError.message?.includes('duplicate') ||
          lockError.message?.includes('violates unique constraint')) {
        console.log(`🔒 [notify-appointment-confirmed] PUSH::LOCKED::already_processing - Otra ejecución ya está procesando o ya procesó appointment_id: ${appointment_id}`);
        return new Response(
          JSON.stringify({
            success: true,
            pushSent: false,
            locked: true,
            reason: 'already_processing',
            appointment_id: appointment_id,
            message: "PUSH::LOCKED::already_processing"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Error inesperado al insertar - loguear pero continuar (fail-open solo para errores inesperados)
        console.error("⚠️ [notify-appointment-confirmed] Error inesperado al adquirir lock (continuando):", lockError);
        // Continuar con el flujo aunque falle el lock (solo para errores inesperados, no duplicados)
      }
    } else {
      console.log("✅ [notify-appointment-confirmed] Lock adquirido exitosamente - Esta ejecución procederá a enviar push");
    }

    // ✅ PASO 3: Obtener información completa de la cita y cliente
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select(`
        id,
        business_id,
        client_id,
        appointment_date,
        start_time,
        clients!inner(id, user_id, full_name)
      `)
      .eq("id", appointment_id)
      .single();

    if (appointmentError || !appointment) {
      console.error("❌ [notify-appointment-confirmed] Error obteniendo cita:", appointmentError);
      return new Response(
        JSON.stringify({ success: false, error: "Cita no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ PASO 4: Buscar dispositivos activos del cliente
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
      console.error("❌ [notify-appointment-confirmed] Error consultando dispositivos:", devicesError);
      return new Response(
        JSON.stringify({ success: false, error: "Error consultando dispositivos" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!devices || devices.length === 0) {
      console.warn("⚠️ [notify-appointment-confirmed] No se encontraron dispositivos activos");
      return new Response(
        JSON.stringify({ success: true, pushSent: false, message: "No devices found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📱 [notify-appointment-confirmed] Dispositivos encontrados: ${devices.length}`);

    // ✅ PASO 5: Obtener secret de Firebase para cliente
    console.log("🔍 [notify-appointment-confirmed] Buscando secret FIREBASE_SERVICE_ACCOUNT_CLIENT...");
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_CLIENT");
    if (!serviceAccountJson) {
      console.error("❌ [notify-appointment-confirmed] FIREBASE_SERVICE_ACCOUNT_CLIENT no configurado");
      return new Response(
        JSON.stringify({ success: false, error: "FIREBASE_SERVICE_ACCOUNT_CLIENT not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ [notify-appointment-confirmed] Secret encontrado");

    let serviceAccount: admin.ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
      console.log("✅ [notify-appointment-confirmed] Secret parseado correctamente");
    } catch (error: any) {
      console.error("❌ [notify-appointment-confirmed] Error parseando secret:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Error parseando FIREBASE_SERVICE_ACCOUNT_CLIENT" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ PASO 6: Inicializar Firebase
    console.log("🚀 [notify-appointment-confirmed] Inicializando Firebase Admin...");
    const firebaseApp = getFirebaseApp(serviceAccount);
    const messaging = admin.messaging(firebaseApp);
    console.log("✅ [notify-appointment-confirmed] Firebase Admin inicializado exitosamente");

    // ✅ PASO 7: Preparar mensaje
    const appointmentDate = appointment.appointment_date 
      ? new Date(appointment.appointment_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
      : 'próximamente';
    const appointmentTime = appointment.start_time || '';

    const title = "Cita confirmada";
    const body = `Tu cita ha sido confirmada para el ${appointmentDate} a las ${appointmentTime}.`;

    // ✅ PASO 8: Enviar push token por token (nunca batch)
    console.log("📤 [notify-appointment-confirmed] Enviando push notifications...");
    const results = await Promise.allSettled(
      devices.map(async (device: Device) => {
        const deviceId = device.id;
        const fcmToken = device.fcm_token;

        try {
          const response = await messaging.send({
            token: fcmToken,
            notification: { title, body },
            data: {
              type: "appointment_confirmed",
              appointment_id: appointment_id,
              appointment_date: appointment.appointment_date || "",
              appointment_time: appointmentTime,
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

          console.log(`✅ [notify-appointment-confirmed] Push enviado a dispositivo ${deviceId}`);
          return { deviceId, status: "fulfilled", response };
        } catch (err: any) {
          console.error(`❌ [notify-appointment-confirmed] Error en dispositivo ${deviceId}:`, err.message, err.code);
          
          // Limpiar token inválido
          if (err.code === 'messaging/registration-token-not-registered' || 
              err.code === 'messaging/invalid-registration-token' ||
              err.message.includes('Requested entity was not found')) {
            await supabase
              .from("client_devices")
              .update({ enabled: false, is_active: false, fcm_token: null })
              .eq("id", deviceId);
            console.log(`🧹 [notify-appointment-confirmed] Token inválido limpiado para dispositivo ${deviceId}`);
          }
          
          throw { deviceId, error: err.message, code: err.code };
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`📊 [notify-appointment-confirmed] Resultados: ${successful} exitosos, ${failed} fallidos`);

    // ✅ PASO 9: Insertar en client_notifications SOLO si el push se envió exitosamente
    if (successful > 0) {
      console.log("✅ [notify-appointment-confirmed] PUSH_SENT - Al menos un push enviado exitosamente");
      
      const clientData = appointment.clients as any;
      const clientId = appointment.client_id;
      const businessId = appointment.business_id;
      
      try {
        // Insertar en client_notifications con manejo de duplicados (ON CONFLICT DO NOTHING)
        // El constraint UNIQUE (user_id, appointment_id, type) previene duplicados a nivel de DB
        const { data: insertedNotification, error: insertError } = await supabase
          .from("client_notifications")
          .insert({
            user_id: clientUserId,
            client_id: clientId,
            appointment_id: appointment_id,
            business_id: businessId,
            type: "confirmation",
            title: title,
            message: body,
            role: "client",
            read: false,
            meta: {
              type: "confirmation",
              business_id: businessId,
              appointment_date: appointment.appointment_date || null,
              appointment_time: appointmentTime,
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
            console.log("ℹ️ [notify-appointment-confirmed] DB_NOTIFICATION_SKIPPED_DUPLICATE - Ya existe registro en campana (idempotencia)");
          } else {
            // Otro tipo de error, loguear pero no fallar
            console.warn("⚠️ [notify-appointment-confirmed] Error al insertar en DB (no crítico):", insertError.message);
          }
        } else if (insertedNotification) {
          console.log("✅ [notify-appointment-confirmed] DB_NOTIFICATION_INSERTED - Registro creado en campana exitosamente");
        }
      } catch (dbError: any) {
        // Error inesperado al insertar, loguear pero no fallar
        console.warn("⚠️ [notify-appointment-confirmed] Excepción al insertar en DB (no crítico):", dbError.message);
      }
    } else {
      console.log("ℹ️ [notify-appointment-confirmed] PUSH_NOT_SENT - No se envió ningún push, no se inserta en DB");
    }

    // ✅ NOTA: El registro en push_notification_sent ya se hizo en el PASO 2 (lock atómico)
    // No es necesario volver a insertar aquí

    return new Response(
      JSON.stringify({
        success: true,
        pushSent: successful > 0,
        sent: successful,
        failed: failed,
        total: devices.length,
        appointment_id: appointment_id,
        user_id: clientUserId,
        locked: false, // Esta ejecución adquirió el lock
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ [notify-appointment-confirmed] Error general:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
