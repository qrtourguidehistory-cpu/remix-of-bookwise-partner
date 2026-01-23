import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import admin from "npm:firebase-admin@11.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeo de roles a nombres de secrets de Firebase
const SECRETS: Record<string, string> = {
  partner: "FIREBASE_SERVICE_ACCOUNT_PARTNER",
  client: "FIREBASE_SERVICE_ACCOUNT_CLIENTE",
};

// Nombres de apps Firebase para evitar colisiones
const APP_NAMES: Record<string, string> = {
  partner: "app-partner",
  client: "app-client",
};

interface RequestBody {
  user_id?: string;
  userId?: string;
  clientId?: string;
  role?: string;
  title?: string;
  message?: string;
  body?: string;
  data?: Record<string, string>;
  record?: {
    user_id?: string;
    userId?: string;
    clientId?: string;
    role?: string;
    title?: string;
    message?: string;
    body?: string;
    data?: Record<string, string>;
    type?: string;
  };
  type?: string;
}

interface Device {
  id: string;
  user_id: string;
  fcm_token: string;
  role?: string;
  platform?: string;
}

/**
 * Detecta el rol del usuario de forma ultra-robusta
 * Busca en: body.role, body.record.role, body.type (solo si contiene 'partner')
 */
function detectRole(requestBody: RequestBody, record: any): string {
  // 1. Intentar desde body.role
  if (requestBody.role) {
    const role = requestBody.role.toLowerCase().trim();
    if (role === "partner" || role === "client") {
      return role;
    }
  }

  // 2. Intentar desde record.role (para triggers SQL)
  if (record?.role) {
    const role = record.role.toLowerCase().trim();
    if (role === "partner" || role === "client") {
      return role;
    }
  }

  // 3. Intentar desde body.type (solo si contiene 'partner')
  // NOTA: type normalmente es tipo de notificación, pero puede contener el rol
  if (requestBody.type && requestBody.type.toLowerCase().includes("partner")) {
    return "partner";
  }

  // 4. Por defecto, asumir 'client'
  return "client";
}

/**
 * Inicializa o recupera una app Firebase por rol
 * Evita colisiones usando nombres únicos: app-partner y app-client
 */
function getFirebaseApp(roleKey: string, serviceAccount: admin.ServiceAccount): admin.app.App {
  const appName = APP_NAMES[roleKey] || APP_NAMES.client;
  
  try {
    // Verificar si la app ya existe
    const existingApps = admin.apps || [];
    const existingApp = existingApps.find((a: any) => a && a.name === appName);

    if (existingApp) {
      return admin.app(appName);
    }

    // Inicializar nueva app con nombre único
    return admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
      },
      appName
    );
  } catch (error: any) {
    // Si hay error de inicialización (app ya existe), recuperarla
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
    const requestBody: RequestBody = await req.json();
    
    // Extract payload: handle both direct calls and webhook/trigger calls
    const record = requestBody.record || requestBody;
    
    // Detectar rol de forma ultra-robusta
    const detectedRole = detectRole(requestBody, record);
    const roleKey = detectedRole === "partner" ? "partner" : "client";
    const secretName = SECRETS[roleKey];
    const appName = APP_NAMES[roleKey];
    
    const targetUserId = record.user_id || record.userId || record.clientId;
    const finalTitle = record.title || "Actualización de Cita";
    const finalBody = record.message || record.body || "Tienes una nueva actualización.";

    if (!targetUserId) {
      console.warn("⚠️ user_id, userId o clientId no proporcionado");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Notification failed",
          error: "user_id, userId o clientId es requerido",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ Supabase credentials no configuradas");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Notification failed",
          error: "Supabase credentials not configured",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Buscar dispositivos del usuario en client_devices (única tabla)
    let devices: Device[] = [];
    try {
      const devicesUrl = `${supabaseUrl}/rest/v1/client_devices?user_id=eq.${targetUserId}&enabled=eq.true&select=id,user_id,fcm_token,role,platform`;
      
      const devicesRes = await fetch(devicesUrl, {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      });

      if (devicesRes.ok) {
        devices = await devicesRes.json();
      } else {
        console.error(`❌ Error consultando dispositivos: ${devicesRes.status} ${devicesRes.statusText}`);
      }
    } catch (error: any) {
      console.error(`❌ Excepción consultando dispositivos: ${error.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Notification failed",
          error: `Error consultando dispositivos: ${error.message}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!devices || devices.length === 0) {
      console.warn(`⚠️ No se encontraron dispositivos para user_id: ${targetUserId}`);
      return new Response(
        JSON.stringify({
          success: true,
          pushSent: false,
          message: "No devices found",
          userId: targetUserId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Obtener el JSON del secreto usando el nombre del mapeo
    const serviceAccountJson = Deno.env.get(secretName);
    
    if (!serviceAccountJson) {
      console.error(`❌ Secret ${secretName} no está configurado`);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Notification failed",
          error: `Secret ${secretName} no está configurado`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let serviceAccount: admin.ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error: any) {
      console.error(`❌ Error parseando secreto ${secretName}: ${error.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Notification failed",
          error: `Error parseando ${secretName}: ${error.message}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Inicializar Firebase app con nombre único basado en el rol
    let currentApp: admin.app.App;
    try {
      currentApp = getFirebaseApp(roleKey, serviceAccount);
    } catch (error: any) {
      console.error(`❌ Error inicializando Firebase ${appName}: ${error.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Notification failed",
          error: `Error inicializando Firebase: ${error.message}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const messaging = admin.messaging(currentApp);

    // Procesar cada dispositivo
    const results = await Promise.allSettled(
      devices.map(async (device: Device) => {
        const deviceId = device.id;
        const fcmToken = device.fcm_token;

        if (!fcmToken) {
          throw new Error(`Device ${deviceId} no tiene FCM token`);
        }

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

          return {
            status: "fulfilled" as const,
            deviceId,
            response,
          };
        } catch (err: any) {
          console.error(`❌ Error enviando notificación a dispositivo ${deviceId}:`, err.message, err.code);
          throw {
            deviceId,
            error: err.message,
            code: err.code,
          };
        }
      })
    );

    // Contar resultados
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // Si todos los envíos fallaron, devolver 'Notification failed' pero mantener 200
    if (successful === 0 && failed > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          pushSent: false,
          message: "Notification failed",
          sent: 0,
          failed: failed,
          total: devices.length,
          error: "Todos los envíos fallaron",
          results: results.map((r) => {
            if (r.status === "fulfilled") {
              return {
                deviceId: r.value.deviceId,
                status: "ok",
              };
            } else {
              return {
                deviceId: r.reason.deviceId || "unknown",
                status: "error",
                error: r.reason.error || "Unknown error",
                code: r.reason.code,
              };
            }
          }),
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
        pushSent: successful > 0,
        sent: successful,
        failed: failed,
        total: devices.length,
        results: results.map((r) => {
          if (r.status === "fulfilled") {
            return {
              deviceId: r.value.deviceId,
              status: "ok",
            };
          } else {
            return {
              deviceId: r.reason.deviceId || "unknown",
              status: "error",
              error: r.reason.error || "Unknown error",
              code: r.reason.code,
            };
          }
        }),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    // Fail-safe: siempre devolver 200 con 'Notification failed' para no bloquear triggers SQL
    console.error("❌ Error general en send-push-notification:", error.message);
    console.error("Stack trace:", error.stack);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Notification failed",
        error: error.message || "Unknown error",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
