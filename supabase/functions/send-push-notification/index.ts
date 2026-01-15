import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import admin from "npm:firebase-admin@11.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log("📥 Request recibido:", JSON.stringify(requestBody).substring(0, 200));
    
    // Extract payload: handle both direct calls and webhook/trigger calls
    const record = requestBody.record || requestBody;
    console.log("📦 Record extraído:", JSON.stringify(record).substring(0, 200));
    
    const targetUserId = record.user_id || record.userId || record.clientId;
    const finalTitle = record.title || "Actualización de Cita";
    const finalBody = record.message || record.body || "Tienes una nueva actualización.";

    console.log(`🎯 Target User ID: ${targetUserId}`);
    console.log(`📝 Title: ${finalTitle}`);
    console.log(`📝 Body: ${finalBody}`);

    if (!targetUserId) {
      throw new Error("user_id, userId o clientId es requerido");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    console.log(`🔍 Buscando dispositivos para user_id: ${targetUserId}`);

    // Buscar dispositivos del usuario
    const devicesUrl = `${supabaseUrl}/rest/v1/client_devices?user_id=eq.${targetUserId}&enabled=eq.true&select=id,user_id,fcm_token,role,platform`;
    console.log(`🔍 URL de consulta: ${devicesUrl}`);

    const devicesRes = await fetch(devicesUrl, {
      headers: {
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
    });

    console.log(`📡 Devices response status: ${devicesRes.status}`);
    const devicesText = await devicesRes.text();
    console.log(`📡 Devices response body: ${devicesText}`);

    let devices;
    try {
      devices = JSON.parse(devicesText);
    } catch (e) {
      console.error("❌ Error parsing devices response:", e);
      devices = [];
    }

    if (!devices || devices.length === 0) {
      console.log("⚠️ No se encontraron dispositivos para el usuario:", targetUserId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          pushSent: false,
          message: "No devices found",
          userId: targetUserId 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`📱 Encontrados ${devices.length} dispositivo(s)`);
    devices.forEach((d: any, idx: number) => {
      console.log(`   Device ${idx + 1}: id=${d.id}, role=${d.role}, platform=${d.platform}, token=${d.fcm_token?.substring(0, 20)}...`);
    });

    // Procesar cada dispositivo
    const results = await Promise.allSettled(
      devices.map(async (device: any) => {
        const deviceId = device.id;
        const deviceRole = device.role; // NO USAR VALORES POR DEFECTO
        const fcmToken = device.fcm_token;

        console.log(`\n🔄 Procesando device ${deviceId} (role: ${deviceRole})`);

        // VALIDACIÓN ESTRICTA DEL ROL - NO ADIVINAR
        if (!deviceRole) {
          const errorMsg = `Device ${deviceId} no tiene rol definido. No se puede determinar qué proyecto Firebase usar.`;
          console.error(`❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }

        if (deviceRole !== "partner" && deviceRole !== "client") {
          const errorMsg = `Device ${deviceId} tiene rol inválido: "${deviceRole}". Solo se permiten 'partner' o 'client'.`;
          console.error(`❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }

        // SELECCIÓN DINÁMICA DEL PROYECTO FIREBASE BASADO EN EL ROL
        const isPartner = deviceRole === "partner";
        const secretName = isPartner ? "FIREBASE_SERVICE_ACCOUNT" : "FIREBASE_SERVICE_ACCOUNT_CLIENT";
        
        console.log(`🔑 Usando secret: ${secretName} para rol: ${deviceRole}`);
        
        const serviceAccountJson = Deno.env.get(secretName);
        
        if (!serviceAccountJson) {
          throw new Error(`Secret ${secretName} no está configurado`);
        }

        console.log(`✅ Secret ${secretName} encontrado (length: ${serviceAccountJson.length})`);

        let serviceAccount;
        try {
          serviceAccount = JSON.parse(serviceAccountJson);
          console.log(`✅ Service Account parseado - project_id: ${serviceAccount.project_id}`);
        } catch (e) {
          console.error(`❌ Error parseando ${secretName}:`, e);
          throw new Error(`Error parseando ${secretName}: ${e.message}`);
        }

        // Nombre único de app para cada rol
        const appName = `app-${deviceRole}`;
        console.log(`🔧 Inicializando/obteniendo Firebase app: ${appName}`);

        let currentApp;

        // Verificar si la app ya existe
        const existingApps = admin.apps || [];
        const existingApp = existingApps.find((a: any) => a && a.name === appName);
        
        if (!existingApp) {
          console.log(`   - Creando nueva instancia de Firebase app: ${appName}`);
          currentApp = admin.initializeApp(
            {
              credential: admin.credential.cert(serviceAccount),
            },
            appName
          );
          console.log(`✅ Firebase app creada: ${appName} con proyecto: ${serviceAccount.project_id}`);
        } else {
          console.log(`   - Reutilizando instancia existente: ${appName}`);
          currentApp = admin.app(appName);
        }

        console.log(`📱 Obteniendo messaging instance para ${appName}`);
        const messaging = admin.messaging(currentApp);

        // Enviar notificación
        console.log(`📤 Enviando notificación a ${deviceRole} (token: ${fcmToken.substring(0, 20)}...)`);
        console.log(`   - Proyecto Firebase: ${serviceAccount.project_id}`);
        console.log(`   - Title: ${finalTitle}`);
        console.log(`   - Body: ${finalBody}`);

        try {
          const response = await messaging.send({
            token: fcmToken,
            notification: {
              title: finalTitle,
              body: finalBody,
            },
            data: record.data || {},
            android: {
              priority: "high" as const,
              notification: {
                channelId: "default",
                sound: "default",
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: "default",
                  badge: 1,
                },
              },
            },
          });

          console.log(`✅ Notificación enviada exitosamente a ${deviceRole} (device ${deviceId})`);
          console.log(`   Response: ${response}`);

          return {
            status: "fulfilled",
            deviceId,
            role: deviceRole,
            project: serviceAccount.project_id,
            response,
          };
        } catch (err: any) {
          console.error(`❌ Error enviando a ${deviceRole} (device ${deviceId}):`, err.message);
          console.error(`   Error code: ${err.code}`);
          console.error(`   Proyecto usado: ${serviceAccount.project_id}`);
          
          if (err.code === 403 || err.message?.includes("SenderId mismatch")) {
            console.error(`   ⚠️ SENDER_ID_MISMATCH: El token fue registrado con un proyecto diferente`);
          }

          throw {
            deviceId,
            role: deviceRole,
            project: serviceAccount.project_id,
            error: err.message,
            code: err.code,
          };
        }
      })
    );

    // Contar resultados
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`\n📊 RESUMEN FINAL:`);
    console.log(`   - Total dispositivos: ${devices.length}`);
    console.log(`   - Exitosos: ${successful}`);
    console.log(`   - Fallidos: ${failed}`);

    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        const value = result.value as any;
        console.log(`   ✅ Device ${idx + 1}: ${value.role} - ${value.project} - OK`);
      } else {
        const reason = (result as any).reason;
        console.log(`   ❌ Device ${idx + 1}: ${reason.role || "unknown"} - ${reason.error || "Unknown error"}`);
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        pushSent: successful > 0,
        sent: successful,
        failed: failed,
        total: devices.length,
        results: results.map((r, idx) => {
          if (r.status === "fulfilled") {
            const value = r.value as any;
            return {
              device: devices[idx].fcm_token.substring(0, 20) + "...",
              status: "ok",
              role: value.role,
              project: value.project,
            };
          } else {
            const reason = (r as any).reason;
            return {
              device: devices[idx].fcm_token.substring(0, 20) + "...",
              status: "error",
              role: reason.role,
              error: reason.error,
            };
          }
        }),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("❌ Error Crítico:", error.message);
    console.error("Stack:", error.stack);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
