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
    
    console.log("📨 [notify-next-in-queue] ===== INICIO ===== Evento: Próximo en cola");
    console.log("📋 [notify-next-in-queue] appointment_id:", appointment_id);
    console.log("📋 [notify-next-in-queue] business_id:", business_id);
    console.log("📋 [notify-next-in-queue] staff_id:", staff_id);
    
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

    // ✅ CORRECCIÓN ETAPA 4: LOCK ATÓMICO - PRIMER PASO
    // Obtener user_id del cliente ANTES del lock (necesario para el lock)
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
      console.error("❌ [notify-next-in-queue] Error obteniendo preview de cita:", previewError);
      return new Response(
        JSON.stringify({ success: false, error: "Cita no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const previewClient = (appointmentPreview.clients as any);
    const clientUserId = previewClient?.user_id;

    if (!clientUserId || typeof clientUserId !== 'string') {
      console.warn("⚠️ [notify-next-in-queue] Cliente no tiene user_id");
      return new Response(
        JSON.stringify({ success: true, message: "Cliente no tiene user_id, no se envía push" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ LOCK ATÓMICO: INSERT en push_notification_sent como PRIMER paso real
    const { error: lockError } = await supabase
      .from("push_notification_sent")
      .insert({
        appointment_id: appointment_id,
        notification_type: "next_in_queue",
        edge_function: "notify-next-in-queue",
        sent_at: new Date().toISOString(),
      });

    if (lockError) {
      if (lockError.code === '23505' || 
          lockError.message?.includes('unique') || 
          lockError.message?.includes('duplicate')) {
        console.log("🔒 [notify-next-in-queue] PUSH::LOCKED::already_processing - Otra ejecución ya está procesando");
        return new Response(
          JSON.stringify({ success: true, message: "Already processing", locked: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.warn("⚠️ [notify-next-in-queue] Error en lock (no crítico):", lockError.message);
    } else {
      console.log("✅ [notify-next-in-queue] Lock adquirido exitosamente");
    }

    // ✅ CORRECCIÓN ETAPA 4: Notificar sobre la cita ACTUAL, no buscar la siguiente
    // El botón "Siguiente en turno" se presiona sobre una cita específica
    const { data: nextAppointment, error: queryError } = await supabase
      .from('appointments')
      .select(`
        id,
        business_id,
        client_id,
        start_time,
        appointment_date,
        clients!inner(id, user_id, full_name)
      `)
      .eq('id', appointment_id)
      .single();

    if (queryError || !nextAppointment) {
      console.error("❌ [notify-next-in-queue] Error obteniendo cita:", queryError);
      return new Response(
        JSON.stringify({ success: false, error: "Cita no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = (nextAppointment.clients as any);
    // clientUserId ya se obtuvo en el preview, pero validar que coincida
    const appointmentClientUserId = client?.user_id;
    
    if (appointmentClientUserId !== clientUserId) {
      console.warn("⚠️ [notify-next-in-queue] user_id no coincide entre preview y query completo");
      // Continuar con el user_id del preview (ya validado)
    }

    console.log("✅ [notify-next-in-queue] Cliente encontrado:", client?.full_name);
    console.log("✅ [notify-next-in-queue] client_user_id:", clientUserId);

    // ✅ VALIDACIÓN: user_id debe ser UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientUserId.trim())) {
      console.error("❌ [notify-next-in-queue] user_id no es UUID válido:", clientUserId);
      return new Response(
        JSON.stringify({ success: false, error: "user_id inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ [notify-next-in-queue] user_id receptor validado:", clientUserId);

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

    console.log("📤 [notify-next-in-queue] Preparando envío de push a", devices.length, "dispositivos del cliente...");
    console.log("📤 [notify-next-in-queue] Título:", title);
    console.log("📤 [notify-next-in-queue] Mensaje:", body);

    const results = await Promise.allSettled(
      devices.map(async (device: Device) => {
        try {
          console.log(`📤 [notify-next-in-queue] Enviando push a dispositivo ${device.id}...`);
          const result = await messaging.send({
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
          console.log(`✅ [notify-next-in-queue] Push enviado exitosamente a dispositivo ${device.id}`);
          return { deviceId: device.id, status: "fulfilled", result };
        } catch (err: any) {
          console.error(`❌ [notify-next-in-queue] Error en dispositivo ${device.id}:`, err.message, err.code);
          if (err.code === 'messaging/registration-token-not-registered' || 
              err.code === 'messaging/invalid-registration-token') {
            console.log(`🧹 [notify-next-in-queue] Desactivando token inválido: ${device.id}`);
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

    console.log(`📊 [notify-next-in-queue] Resultados push: ${successful} exitosos, ${failed} fallidos`);
    
    if (successful > 0) {
      console.log("✅ [notify-next-in-queue] PUSH_SENT - Al menos un push enviado exitosamente");
    } else {
      console.log("❌ [notify-next-in-queue] PUSH_NOT_SENT - Ningún push se envió exitosamente");
    }

    // ✅ CORRECCIÓN ETAPA 4: Insertar en client_notifications SOLO si el push se envió exitosamente
    if (successful > 0) {
      console.log("💾 [notify-next-in-queue] Intentando insertar en tabla client_notifications...");
      
      const clientId = nextAppointment.client_id;
      const nextAppointmentBusinessId = nextAppointment.business_id || business_id;
      const appointmentTime = nextAppointment.start_time || '';
      
      console.log("💾 [notify-next-in-queue] Datos para insertar:", {
        user_id: clientUserId,
        client_id: clientId,
        appointment_id: nextAppointment.id,
        business_id: nextAppointmentBusinessId,
        type: "next_in_queue"
      });
      
      try {
        // Insertar en client_notifications con manejo de duplicados (ON CONFLICT DO NOTHING)
        // El constraint UNIQUE (user_id, appointment_id, type) previene duplicados a nivel de DB
        const { data: insertedNotification, error: insertError } = await supabase
          .from("client_notifications")
          .insert({
            user_id: clientUserId,
            client_id: clientId,
            appointment_id: nextAppointment.id,
            business_id: nextAppointmentBusinessId,
            type: "next_in_queue",
            title: title,
            message: body,
            role: "client",
            read: false,
            meta: {
              type: "next_in_queue",
              business_id: nextAppointmentBusinessId,
              appointment_date: nextAppointment.appointment_date || null,
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
            console.log("ℹ️ [notify-next-in-queue] DB_NOTIFICATION_SKIPPED_DUPLICATE - Ya existe registro en campana (idempotencia)");
          } else {
            // Otro tipo de error, loguear pero no fallar
            console.warn("⚠️ [notify-next-in-queue] Error al insertar en DB (no crítico):", insertError.message, insertError.code);
          }
        } else if (insertedNotification) {
          console.log("✅ [notify-next-in-queue] DB_NOTIFICATION_INSERTED - Registro creado en campana exitosamente");
          console.log("✅ [notify-next-in-queue] notification_id:", insertedNotification.id);
        }
      } catch (dbError: any) {
        // Error inesperado al insertar, loguear pero no fallar
        console.error("❌ [notify-next-in-queue] Excepción al insertar en DB:", dbError.message);
      }
    } else {
      console.log("ℹ️ [notify-next-in-queue] PUSH_NOT_SENT - No se envió ningún push, no se inserta en DB");
    }

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

