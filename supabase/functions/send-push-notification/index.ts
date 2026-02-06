import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import admin from "npm:firebase-admin@11.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeo de roles a nombres de secrets de Firebase
const SECRETS: Record<string, string> = {
  partner: "FIREBASE_SERVICE_ACCOUNT_PARTNER",
  client: "FIREBASE_SERVICE_ACCOUNT_CLIENT",
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
    
    // ✅ LOG: Payload recibido
    console.log("📥 [PAYLOAD] Request recibido:", JSON.stringify({
      user_id: requestBody.user_id,
      record_user_id: requestBody.record?.user_id,
      role: requestBody.role || requestBody.record?.role,
      title: requestBody.title || requestBody.record?.title
    }));
    
    // ✅ FIX CRÍTICO: Extraer user_id con prioridad exacta y exclusiva
    // PRIORIDAD 1: requestBody.user_id (directo desde call_send_push_notification)
    // PRIORIDAD 2: requestBody.record?.user_id (solo si requestBody.user_id no existe)
    // ❌ ELIMINADO: Todos los fallbacks (record.userId, record.clientId, etc.)
    const targetUserId = requestBody.user_id ?? requestBody.record?.user_id;
    
    // 🚨 REGLA DE ORO: VALIDACIÓN OBLIGATORIA DE user_id
    // ❌ COMPORTAMIENTO INACEPTABLE: Enviar notificaciones si user_id es NULL o inválido
    // ✅ COMPORTAMIENTO CORRECTO: Fail hard, cancelar envío, sin excepciones
    
    // ✅ VALIDACIÓN 1: user_id NO puede ser null, undefined o string vacío
    if (!targetUserId || typeof targetUserId !== 'string' || targetUserId.trim() === '') {
      console.error("🚨 [REGLA DE ORO] ❌ CANCELADO: user_id es null, undefined o string vacío. NO se envía notificación.");
      console.error("📥 Payload recibido:", JSON.stringify(requestBody, null, 2));
      return new Response(
        JSON.stringify({
          success: false,
          message: "Notification cancelled",
          error: "REGLA DE ORO: user_id es requerido y no puede ser null, undefined o vacío. Envío cancelado por seguridad.",
          cancelled: true,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // ✅ VALIDACIÓN 2: user_id DEBE ser un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId.trim())) {
      console.error(`🚨 [REGLA DE ORO] ❌ CANCELADO: user_id no es un UUID válido: ${targetUserId}. NO se envía notificación.`);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Notification cancelled",
          error: `REGLA DE ORO: user_id debe ser un UUID válido. Valor recibido: ${targetUserId}. Envío cancelado por seguridad.`,
          cancelled: true,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Detectar rol de forma ultra-robusta
    const detectedRole = detectRole(requestBody, requestBody.record || requestBody);
    // ✅ Protección: Si roleKey no existe o es inválido, usar 'client' por defecto para evitar fugas
    const roleKey = (detectedRole === "partner" || detectedRole === "client") ? detectedRole : "client";
    // ✅ SEGURIDAD CRÍTICA: Sanitizar roleKey para prevenir inyección en URL
    // Solo permitir letras minúsculas (a-z) - eliminar cualquier carácter especial
    const sanitizedRole = roleKey.replace(/[^a-z]/gi, '').toLowerCase();
    // Validar que después de sanitizar sea 'partner' o 'client'
    const finalRole = (sanitizedRole === 'partner' || sanitizedRole === 'client') ? sanitizedRole : 'client';
    
    // ✅ VALIDACIÓN 3: Si role = 'client', user_id es OBLIGATORIO (ya validado arriba, pero reforzamos)
    if (finalRole === 'client' && (!targetUserId || targetUserId.trim() === '')) {
      console.error(`🚨 [REGLA DE ORO] ❌ CANCELADO: role='client' pero user_id es inválido. NO se envía notificación.`);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Notification cancelled",
          error: "REGLA DE ORO: Si role='client', user_id es obligatorio. Envío cancelado por seguridad.",
          cancelled: true,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const secretName = SECRETS[finalRole] || SECRETS.client;
    const appName = APP_NAMES[finalRole] || APP_NAMES.client;
    
    // ✅ LOG: User ID final usado (ya validado)
    console.log("✅ [REGLA DE ORO] user_id validado correctamente:", targetUserId);
    console.log("✅ [REGLA DE ORO] role:", finalRole);
    
    // Extraer título y mensaje del payload
    const record = requestBody.record || requestBody;
    // ✅ Asegurar que título y cuerpo sean strings (requisito de Firebase)
    const finalTitle = String(record.title || requestBody.title || "Actualización de Cita");
    const finalBody = String(record.message || record.body || requestBody.message || requestBody.body || "Tienes una nueva actualización.");

    // ✅ Normalizar targetUserId (trim y lowercase para consistencia)
    const normalizedUserId = targetUserId.trim().toLowerCase();

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
    // ✅ CORREGIDO: Agregar filtro por role para evitar envíos a roles incorrectos
    let devices: Device[] = [];
    try {
      // ✅ Filtro por role: solo dispositivos del rol solicitado
      // ✅ Punto 12: Filtrar por is_active=true (dispositivos activos para recibir notificaciones)
      // ✅ SEGURIDAD: Usar normalizedUserId (ya validado como UUID) y finalRole (sanitizado)
      // ✅ GARANTIZAR: Consultar dispositivos SOLO por normalizedUserId (sin fallbacks)
      const roleFilter = `&role=eq.${finalRole}`;
      const devicesUrl = `${supabaseUrl}/rest/v1/client_devices?user_id=eq.${normalizedUserId}&is_active=eq.true${roleFilter}&select=id,user_id,fcm_token,role,platform`;
      
      const devicesRes = await fetch(devicesUrl, {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      });

      if (devicesRes.ok) {
        devices = await devicesRes.json();
        
        // ✅ LOG: Cantidad de dispositivos encontrados
        console.log(`📱 [DEVICES] Dispositivos encontrados: ${devices.length} para user_id=${normalizedUserId}, role=${finalRole}`);
        
        // ✅ Protección: Verificar que todos los dispositivos tengan el user_id y role correctos
        const uniqueUserIds = new Set(devices.map((d: Device) => d.user_id));
        const uniqueRoles = new Set(devices.map((d: Device) => d.role));
        
        if (uniqueUserIds.size > 1) {
          console.error(`❌ [NOTIFICATION] ERROR CRÍTICO: Se encontraron múltiples user_id distintos en los dispositivos:`, Array.from(uniqueUserIds));
          // Filtrar solo los que coinciden con normalizedUserId y finalRole
          devices = devices.filter((d: Device) => d.user_id?.toLowerCase() === normalizedUserId && d.role === finalRole);
          console.warn(`⚠️ [NOTIFICATION] Dispositivos filtrados a ${devices.length} que coinciden con user_id=${normalizedUserId} y role=${finalRole}`);
        }
        
        if (uniqueRoles.size > 1 || (uniqueRoles.size === 1 && !uniqueRoles.has(finalRole))) {
          console.error(`❌ [NOTIFICATION] ERROR: Se encontraron roles incorrectos en los dispositivos. Esperado: ${finalRole}, Encontrados:`, Array.from(uniqueRoles));
          // Filtrar solo los que tienen el role correcto
          devices = devices.filter((d: Device) => d.role === finalRole);
          console.warn(`⚠️ [NOTIFICATION] Dispositivos filtrados a ${devices.length} con role=${finalRole}`);
        }
        
        // Log ya está arriba
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
      console.warn(`⚠️ No se encontraron dispositivos para user_id: ${normalizedUserId}, role: ${finalRole}`);
      return new Response(
        JSON.stringify({
          success: true,
          pushSent: false,
          message: "No devices found",
          userId: normalizedUserId,
          role: finalRole,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Obtener el JSON del secreto usando el nombre del mapeo
    console.log(`🔍 [send-push-notification] Buscando secret: ${secretName} para role: ${finalRole}`);
    const serviceAccountJson = Deno.env.get(secretName);
    
    // ✅ DEBUG: Log para verificar qué secret se está buscando
    if (serviceAccountJson) {
      console.log(`✅ [send-push-notification] Secret encontrado: ${secretName}`);
      console.log(`🔍 [send-push-notification] Longitud del secret: ${serviceAccountJson.length} caracteres`);
    } else {
      console.error(`❌ [send-push-notification] Secret ${secretName} no encontrado`);
    }
    
    // ✅ REGLA DE ORO: NO FALLBACKS - Fail fast si el secret no existe
    if (!serviceAccountJson) {
      console.error(`❌ [REGLA DE ORO] Secret ${secretName} no está configurado. NO se usan fallbacks.`);
      // ✅ LISTAR TODOS LOS SECRETS DISPONIBLES (solo nombres, no valores) para debugging
      const allEnvKeys = Object.keys(Deno.env.toObject());
      const firebaseSecrets = allEnvKeys.filter(key => key.includes('FIREBASE'));
      console.error(`🔍 [SECRET] Secrets de Firebase disponibles: ${firebaseSecrets.join(', ')}`);
      
      return new Response(
        JSON.stringify({
          success: false,
          message: "Notification cancelled",
          error: `REGLA DE ORO: Secret ${secretName} es requerido. No se usan fallbacks.`,
          cancelled: true,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let serviceAccount: admin.ServiceAccount;
    try {
      console.log(`🔍 [send-push-notification] Parseando secret ${secretName}...`);
      serviceAccount = JSON.parse(serviceAccountJson);
      console.log(`✅ [send-push-notification] Secret parseado correctamente`);
    } catch (error: any) {
      console.error(`❌ [send-push-notification] Error parseando secreto ${secretName}: ${error.message}`);
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
    console.log(`🚀 [send-push-notification] Inicializando Firebase Admin para role: ${finalRole}, app: ${appName}...`);
    let currentApp: admin.app.App;
    try {
      currentApp = getFirebaseApp(finalRole, serviceAccount);
      console.log(`✅ [send-push-notification] Firebase Admin inicializado exitosamente para ${appName}`);
    } catch (error: any) {
      console.error(`❌ [send-push-notification] Error inicializando Firebase ${appName}: ${error.message}`);
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
    console.log(`✅ [send-push-notification] Proyecto Firebase cargado y listo para enviar push notifications`);

    // ✅ FUNCIÓN PARA SANITIZAR DATA: Convertir todos los valores a string (requisito de Firebase)
    const sanitizeData = (data: Record<string, any>): Record<string, string> => {
      const sanitized: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) {
          sanitized[key] = '';
        } else if (typeof value === 'boolean') {
          sanitized[key] = value ? 'true' : 'false';
        } else if (typeof value === 'number') {
          sanitized[key] = value.toString();
        } else if (typeof value === 'object') {
          sanitized[key] = JSON.stringify(value);
        } else {
          sanitized[key] = String(value);
        }
      }
      return sanitized;
    };

    // ✅ SANITIZAR DATA ANTES DE ENVIAR A FIREBASE
    const sanitizedData = sanitizeData(record.data || {});

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
            data: sanitizedData,
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
          
          // ✅ LIMPIAR TOKEN SI ES INVÁLIDO (invalid-registration-token, registration-token-not-registered)
          if (err.code === 'messaging/registration-token-not-registered' || 
              err.code === 'messaging/invalid-registration-token' ||
              err.message.includes('Requested entity was not found')) {
            
            // Desactivar dispositivo en la BD
            try {
              await fetch(`${supabaseUrl}/rest/v1/client_devices?id=eq.${deviceId}`, {
                method: 'PATCH',
                headers: {
                  apikey: supabaseServiceKey,
                  Authorization: `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify({
                  enabled: false,
                  is_active: false,
                  fcm_token: null, // Limpiar token inválido
                }),
              });
              console.log(`✅ [CLEANUP] Token inválido limpiado para dispositivo ${deviceId}`);
            } catch (cleanupError: any) {
              console.error(`❌ [CLEANUP] Error limpiando token inválido: ${cleanupError.message}`);
            }
          }
          
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
