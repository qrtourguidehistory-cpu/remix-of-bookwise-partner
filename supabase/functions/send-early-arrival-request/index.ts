import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import admin from "npm:firebase-admin@11.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendEarlyArrivalRequestParams {
  requestId: string;
  appointmentId: string;
  businessId: string;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SendEarlyArrivalRequestParams = await req.json();
    const { requestId, appointmentId, businessId } = body;

    if (!requestId || !appointmentId || !businessId) {
      throw new Error('Missing required parameters');
    }


    const { data: request, error: requestError } = await supabase
      .from('appointment_requests')
      .select(`
        id,
        appointment_id,
        client_id,
        status,
        expires_at
      `)
      .eq('id', requestId)
      .eq('business_id', businessId)
      .single();

    if (requestError || !request) {
      throw new Error('Request not found');
    }

    const req_data = request as any;

    if (req_data.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, error: 'Request is not pending' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get appointment with client info
    const { data: appointment } = await supabase
      .from('appointments')
      .select(`
        id,
        client_id,
        start_time,
        appointment_date,
        clients(id, user_id, full_name, phone)
      `)
      .eq('id', appointmentId)
      .single();

    const apt = appointment as any;
    const clientData = apt?.clients as any;

    let clientUserId: string | null = clientData?.user_id || null;
    let clientPhone: string | null = clientData?.phone || null;
    let clientName: string | null = clientData?.full_name || null;
    let clientId: string | null = clientData?.id || req_data.client_id || null;

    // ✅ PASO 1: Enviar push FCM al cliente (si tiene user_id y dispositivos activos)
    let pushSent = false;
    if (clientUserId) {
      console.log("🔍 [send-early-arrival-request] Buscando dispositivos activos del cliente...");
      
      const { data: devices, error: devicesError } = await supabase
        .from("client_devices")
        .select("id, user_id, fcm_token, platform")
        .eq("user_id", clientUserId)
        .eq("role", "client")
        .eq("is_active", true)
        .eq("enabled", true)
        .not("fcm_token", "is", null)
        .neq("fcm_token", "");

      if (!devicesError && devices && devices.length > 0) {
        console.log(`📱 [send-early-arrival-request] Dispositivos encontrados: ${devices.length}`);
        
        console.log("🔍 [send-early-arrival-request] Buscando secret FIREBASE_SERVICE_ACCOUNT_CLIENT...");
        const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_CLIENT");
        
        if (serviceAccountJson) {
          console.log("✅ [send-early-arrival-request] Secret encontrado");
          
          try {
            const serviceAccount: admin.ServiceAccount = JSON.parse(serviceAccountJson);
            console.log("✅ [send-early-arrival-request] Secret parseado correctamente");
            
            console.log("🚀 [send-early-arrival-request] Inicializando Firebase Admin...");
            const firebaseApp = getFirebaseApp(serviceAccount);
            const messaging = admin.messaging(firebaseApp);
            console.log("✅ [send-early-arrival-request] Firebase Admin inicializado exitosamente");
            
            const title = "¿Puedes asistir antes?";
            const body = clientName
              ? `Hola ${clientName}! El establecimiento indica que puedes asistir antes de tu hora programada. ¿Puedes asistir ahora?`
              : `El establecimiento indica que puedes asistir antes de tu hora programada. ¿Puedes asistir ahora?`;
            
            console.log("📤 [send-early-arrival-request] Enviando push notifications...");
            const results = await Promise.allSettled(
              devices.map(async (device: Device) => {
                const deviceId = device.id;
                const fcmToken = device.fcm_token;

                try {
                  await messaging.send({
                    token: fcmToken,
                    notification: { title, body },
                    data: {
                      type: "early_arrival_request",
                      appointment_id: appointmentId,
                      request_id: requestId,
                      business_id: businessId,
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

                  console.log(`✅ [send-early-arrival-request] Push enviado a dispositivo ${deviceId}`);
                  return { deviceId, status: "fulfilled" };
                } catch (err: any) {
                  console.error(`❌ [send-early-arrival-request] Error en dispositivo ${deviceId}:`, err.message, err.code);
                  
                  // Limpiar token inválido
                  if (err.code === 'messaging/registration-token-not-registered' || 
                      err.code === 'messaging/invalid-registration-token' ||
                      err.message.includes('Requested entity was not found')) {
                    await supabase
                      .from("client_devices")
                      .update({ enabled: false, is_active: false, fcm_token: null })
                      .eq("id", deviceId);
                    console.log(`🧹 [send-early-arrival-request] Token inválido limpiado para dispositivo ${deviceId}`);
                  }
                  
                  throw { deviceId, error: err.message, code: err.code };
                }
              })
            );

            const successful = results.filter((r) => r.status === "fulfilled").length;
            const failed = results.filter((r) => r.status === "rejected").length;

            console.log(`📊 [send-early-arrival-request] Resultados push: ${successful} exitosos, ${failed} fallidos`);
            
            if (successful > 0) {
              pushSent = true;
              console.log("✅ [send-early-arrival-request] PUSH_SENT - Push enviado exitosamente");
            } else {
              console.log("ℹ️ [send-early-arrival-request] PUSH_NOT_SENT - No se pudo enviar push a ningún dispositivo");
            }
          } catch (firebaseError: any) {
            console.warn("⚠️ [send-early-arrival-request] Error inicializando Firebase (continuando con SMS y DB):", firebaseError.message);
          }
        } else {
          console.warn("⚠️ [send-early-arrival-request] FIREBASE_SERVICE_ACCOUNT_CLIENT no configurado (continuando con SMS y DB)");
        }
      } else {
        console.log("ℹ️ [send-early-arrival-request] No se encontraron dispositivos activos (continuando con SMS y DB)");
      }
    } else {
      console.log("ℹ️ [send-early-arrival-request] Cliente no tiene user_id (continuando con SMS)");
    }

    // ✅ PASO 2: Send SMS notification (mantener flujo existente)
    if (clientPhone) {
      const message = clientName
        ? `Hola ${clientName}! El establecimiento indica que puedes asistir antes de tu hora programada. ¿Puedes asistir ahora?`
        : `El establecimiento indica que puedes asistir antes de tu hora programada. ¿Puedes asistir ahora?`;


      const smsFunctionUrl = `${supabaseUrl}/functions/v1/send-sms-reminder`;
      await fetch(smsFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: clientPhone,
          message: message,
          appointmentId: appointmentId,
          businessId: businessId,
        }),
      });
    }

    // Create client notification
    if (clientUserId) {
      const notificationMessage = clientName
        ? `Hola ${clientName}! El establecimiento indica que puedes asistir antes de tu hora programada.`
        : `El establecimiento indica que puedes asistir antes de tu hora programada.`;

      await supabase
        .from('client_notifications')
        .insert({
          user_id: clientUserId,
          client_id: clientId,
          appointment_id: appointmentId,
          business_id: businessId,
          type: 'early_arrival_request',
          title: 'Solicitud de adelanto',
          message: notificationMessage,
          read: false,
          meta: {
            request_id: requestId,
            can_respond: true,
            expires_at: req_data.expires_at,
          },
        });

    }

    return new Response(
      JSON.stringify({
        success: true,
        requestId: req_data.id,
        notified: !!clientPhone || !!clientUserId,
        pushSent: pushSent,
        smsSent: !!clientPhone,
        dbInserted: !!clientUserId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[send-early-arrival-request] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
