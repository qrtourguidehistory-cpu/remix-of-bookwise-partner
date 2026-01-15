import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { initializeApp, cert, getApps } from "npm:firebase-admin@11.5.0/app";
import { getMessaging } from "npm:firebase-admin@11.5.0/messaging";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  userId?: string;
  user_id?: string;
  clientId?: string;
  role?: string;
  title?: string;
  body?: string;
  message?: string;
  token?: string;
  data?: Record<string, any>;
  businessId?: string;
  appointmentId?: string;
  notificationType?: string;
  record?: any;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    
    // Extract payload: handle both direct calls and webhook/trigger calls
    // When called from a trigger, data comes in requestBody.record
    const payload = requestBody.record || requestBody;
    
    console.log("📥 Request body completo:", JSON.stringify(requestBody).substring(0, 200));
    console.log("📥 Payload extraído:", JSON.stringify(payload).substring(0, 200));
    
    const { 
      userId, 
      user_id,
      clientId, 
      role,
      title, 
      body, 
      message,
      token,
      data,
      businessId,
      appointmentId,
      notificationType 
    }: PushNotificationRequest = payload;
    
    // Handle different field names
    const finalTitle = title || payload.title;
    const finalBody = body || message || payload.body || payload.message;

    console.log("📥 Datos extraídos:", JSON.stringify({ 
      userId, 
      user_id, 
      clientId, 
      role, 
      finalTitle, 
      finalBody, 
      token, 
      data 
    }));

    if (!finalTitle || !finalBody) {
      console.error("❌ Missing title or body:", { finalTitle, finalBody, payload });
      throw new Error("Title and body are required");
    }

    // Accept userId, user_id, or clientId
    const targetUserId = userId || user_id || clientId;
    const directToken = token;
    
    console.log(`🔍 Target User ID: ${targetUserId || "NO PROPORCIONADO"}`);
    console.log(`🔍 Direct Token: ${directToken ? directToken.substring(0, 20) + "..." : "NO PROPORCIONADO"}`);
    console.log(`🔍 Role recibido en request: ${role || "NO PROPORCIONADO"}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }
    
    // If we have a direct token, we can skip user lookup
    if (directToken && !targetUserId && !role) {
      console.log("⚠️ Direct token provided without userId or role. Will attempt to send with default settings.");
    }

    // Determine user role
    let userRole = role;
    
    if (!userRole) {
      console.log(`🔍 Role no proporcionado, consultando tabla profiles para user_id: ${targetUserId}`);
      // If role not provided, get it from profiles table
      const profileUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${targetUserId}&select=id,role`;
      console.log(`🔍 Consultando: ${profileUrl}`);
      
      const profileResponse = await fetch(profileUrl, {
        headers: {
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      });
      
      console.log(`🔍 Profile response status: ${profileResponse.status}`);
      const profiles = await profileResponse.json();
      console.log(`🔍 Profile response data:`, JSON.stringify(profiles));
      
      if (profiles && profiles.length > 0) {
        userRole = profiles[0].role;
        console.log(`✅ Rol encontrado en profiles: ${userRole}`);
      } else {
        console.log(`⚠️ No se encontró perfil para user_id: ${targetUserId}, usando 'client' por defecto`);
        userRole = "client";
      }
    } else {
      console.log(`✅ Usando rol proporcionado en request: ${userRole}`);
    }

    console.log(`👤 ROL FINAL DETERMINADO: ${userRole}`);

    // Determine which Firebase project to use based on role
    const isPartner = userRole === "partner";
    console.log(`🔍 isPartner: ${isPartner} (userRole === "partner": ${userRole === "partner"})`);
    
    const projectId = isPartner 
      ? Deno.env.get("FIREBASE_PARTNER_PROJECT_ID") || "bookwise-partner"
      : Deno.env.get("FIREBASE_CLIENT_PROJECT_ID") || "mi-turnow-cliente";
    
    const clientEmail = isPartner
      ? Deno.env.get("FIREBASE_PARTNER_CLIENT_EMAIL") || "firebase-adminsdk-fbsvc@bookwise-partner.iam.gserviceaccount.com"
      : Deno.env.get("FIREBASE_CLIENT_CLIENT_EMAIL") || "firebase-adminsdk-fbsvc@mi-turnow-cliente.iam.gserviceaccount.com";
    
    const privateKey = isPartner
      ? Deno.env.get("FIREBASE_PARTNER_PRIVATE_KEY")
      : Deno.env.get("FIREBASE_CLIENT_PRIVATE_KEY");

    // Get project number from Firebase Admin (for SenderId validation)
    // Note: SenderId = Project Number in Firebase
    const expectedSenderId = isPartner ? "766564879842" : null; // bookwise-partner project number
    const expectedClientSenderId = "YOUR_CLIENT_PROJECT_NUMBER"; // Replace with actual client project number if known
    
    console.log(`🔥 Credenciales Firebase seleccionadas:`);
    console.log(`   - Rol: ${userRole}`);
    console.log(`   - isPartner: ${isPartner}`);
    console.log(`   - Project ID: ${projectId}`);
    console.log(`   - Expected SenderId (Project Number): ${isPartner ? expectedSenderId : "N/A"}`);
    console.log(`   - Client Email: ${clientEmail}`);
    console.log(`   - Private Key exists: ${!!privateKey}`);
    console.log(`   - Private Key preview: ${privateKey ? `${privateKey.substring(0, 50)}...` : "NO ENCONTRADA"}`);
    
    // Log environment variables status
    console.log(`🔍 Environment Variables Check:`);
    console.log(`   - FIREBASE_PARTNER_PROJECT_ID: ${Deno.env.get("FIREBASE_PARTNER_PROJECT_ID") || "NOT SET"}`);
    console.log(`   - FIREBASE_PARTNER_CLIENT_EMAIL exists: ${!!Deno.env.get("FIREBASE_PARTNER_CLIENT_EMAIL")}`);
    console.log(`   - FIREBASE_PARTNER_PRIVATE_KEY exists: ${!!Deno.env.get("FIREBASE_PARTNER_PRIVATE_KEY")}`);
    console.log(`   - FIREBASE_CLIENT_PROJECT_ID: ${Deno.env.get("FIREBASE_CLIENT_PROJECT_ID") || "NOT SET"}`);
    console.log(`   - FIREBASE_CLIENT_CLIENT_EMAIL exists: ${!!Deno.env.get("FIREBASE_CLIENT_CLIENT_EMAIL")}`);
    console.log(`   - FIREBASE_CLIENT_PRIVATE_KEY exists: ${!!Deno.env.get("FIREBASE_CLIENT_PRIVATE_KEY")}`);

    if (!privateKey) {
      throw new Error(`Missing private key for role: ${userRole}`);
    }

    // Log private key format for debugging
    console.log(`🔑 Private Key Analysis for ${userRole}:`);
    console.log(`   - Length: ${privateKey.length} characters`);
    console.log(`   - Starts with: ${privateKey.substring(0, 30)}`);
    console.log(`   - Contains \\n: ${privateKey.includes('\\n')}`);
    console.log(`   - Contains literal newlines: ${privateKey.includes('\n')}`);
    console.log(`   - First 100 chars: ${privateKey.substring(0, 100)}`);

    // Initialize Firebase Admin with the correct credentials
    const appName = `app-${userRole}`;
    console.log(`🔧 Initializing Firebase app: ${appName}`);
    console.log(`   - Using projectId: ${projectId}`);
    console.log(`   - Using clientEmail: ${clientEmail}`);
    
    if (getApps().length === 0 || !getApps().find((app) => app.name === appName)) {
      // Clean the private key: handle both \\n and \n, and ensure proper format
      let cleanedPrivateKey = privateKey;
      
      // If the key contains escaped newlines (\\n), replace them with real newlines
      if (cleanedPrivateKey.includes('\\n')) {
        cleanedPrivateKey = cleanedPrivateKey.replace(/\\n/g, '\n');
        console.log(`   - Replaced \\\\n with \\n`);
      }
      
      // Ensure the key starts with -----BEGIN and ends with -----END
      if (!cleanedPrivateKey.includes('-----BEGIN')) {
        throw new Error(`Invalid private key format for ${userRole}: does not contain BEGIN marker`);
      }
      
      console.log(`   - Private key after cleaning (first 60 chars): ${cleanedPrivateKey.substring(0, 60)}`);
      console.log(`   - Private key after cleaning (last 60 chars): ${cleanedPrivateKey.substring(cleanedPrivateKey.length - 60)}`);
      
      const firebaseConfig = {
        projectId,
        clientEmail,
        privateKey: cleanedPrivateKey,
      };
      
      console.log(`   - Creating new Firebase app instance for ${appName}`);
      
      try {
        initializeApp({
          credential: cert(firebaseConfig),
        }, appName);
        console.log(`✅ Firebase app initialized: ${appName} with project: ${projectId}`);
      } catch (initError: any) {
        console.error(`❌ Error initializing Firebase app for ${userRole}:`, initError.message);
        console.error(`   Project ID: ${projectId}`);
        console.error(`   Client Email: ${clientEmail}`);
        console.error(`   Private Key length: ${cleanedPrivateKey.length}`);
        console.error(`   Private Key start: ${cleanedPrivateKey.substring(0, 50)}`);
        throw new Error(`Failed to initialize Firebase for ${userRole}: ${initError.message}`);
      }
    } else {
      console.log(`   - Reusing existing Firebase app instance: ${appName}`);
    }

    const app = getApps().find((app) => app.name === appName);
    if (!app) {
      throw new Error(`Failed to get Firebase app: ${appName}`);
    }
    
    console.log(`📱 Getting messaging instance from app: ${appName}`);
    const messaging = getMessaging(app);
    console.log(`✅ Messaging instance obtained for project: ${projectId}`);

    // Get FCM tokens from client_devices table
    let devices: any[] = [];
    
    if (targetUserId) {
      // First, try to get devices with the specific role
      let devicesUrl = `${supabaseUrl}/rest/v1/client_devices?user_id=eq.${targetUserId}&role=eq.${userRole}&enabled=eq.true&select=id,fcm_token,role,platform`;
      console.log(`🔍 Consultando dispositivos con:`);
      console.log(`   - user_id: ${targetUserId} (length: ${targetUserId.length})`);
      console.log(`   - role EXACTO: "${userRole}" (type: ${typeof userRole}, length: ${userRole.length})`);
      console.log(`   - enabled: true`);
      console.log(`   - URL COMPLETA: ${devicesUrl}`);
      console.log(`   - Headers: apikey=${supabaseServiceKey.substring(0, 20)}..., Authorization=Bearer ${supabaseServiceKey.substring(0, 20)}...`);
      
      let devicesResponse = await fetch(devicesUrl, {
        headers: {
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      });

      console.log(`🔍 Devices response status: ${devicesResponse.status}`);
      const responseText = await devicesResponse.text();
      console.log(`🔍 Devices response body: ${responseText}`);
      
      try {
        devices = JSON.parse(responseText);
      } catch (e) {
        console.error(`❌ Error parsing response: ${e}`);
        devices = [];
      }
      
      console.log(`🔍 Devices encontrados con role="${userRole}": ${devices?.length || 0}`);
      
      // If no devices found with the specific role, try without role filter (fallback)
      if (!devices || devices.length === 0) {
        console.log(`⚠️ No se encontraron dispositivos con role="${userRole}", intentando sin filtro de rol...`);
        devicesUrl = `${supabaseUrl}/rest/v1/client_devices?user_id=eq.${targetUserId}&enabled=eq.true&select=id,fcm_token,role,platform`;
        console.log(`🔍 Consultando dispositivos (sin filtro de rol): ${devicesUrl}`);
        
        devicesResponse = await fetch(devicesUrl, {
          headers: {
            "apikey": supabaseServiceKey,
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
        });
        
        const responseText2 = await devicesResponse.text();
        console.log(`🔍 Devices response (sin rol) status: ${devicesResponse.status}`);
        console.log(`🔍 Devices response (sin rol) body: ${responseText2}`);
        
        try {
          devices = JSON.parse(responseText2);
        } catch (e) {
          console.error(`❌ Error parsing response (sin rol): ${e}`);
          devices = [];
        }
        
        console.log(`🔍 Devices encontrados (sin filtro de rol): ${devices?.length || 0}`);
        
        if (devices && devices.length > 0) {
          console.log(`⚠️ ADVERTENCIA: Se encontraron dispositivos pero con roles diferentes:`);
          devices.forEach((d: any) => {
            console.log(`   - Device ${d.id}: role="${d.role}" (type: ${typeof d.role}, length: ${d.role?.length}), platform=${d.platform}`);
          });
        } else {
          // Last resort: check if ANY device exists for this user_id
          console.log(`⚠️ Verificando si EXISTE algún dispositivo para user_id=${targetUserId}...`);
          const checkUrl = `${supabaseUrl}/rest/v1/client_devices?user_id=eq.${targetUserId}&select=id,user_id,role,enabled`;
          console.log(`🔍 URL de verificación: ${checkUrl}`);
          
          const checkResponse = await fetch(checkUrl, {
            headers: {
              "apikey": supabaseServiceKey,
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
          });
          
          const checkText = await checkResponse.text();
          console.log(`🔍 Verificación response: ${checkText}`);
        }
      }
      
      // Last resort: search by token if provided
      if ((!devices || devices.length === 0) && directToken) {
        console.log(`⚠️ No se encontraron dispositivos por user_id, intentando buscar por token directo...`);
        devicesUrl = `${supabaseUrl}/rest/v1/client_devices?fcm_token=eq.${directToken}&enabled=eq.true&select=id,fcm_token,role,platform,user_id`;
        console.log(`🔍 Consultando dispositivos por token: ${directToken.substring(0, 20)}...`);
        
        devicesResponse = await fetch(devicesUrl, {
          headers: {
            "apikey": supabaseServiceKey,
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
        });
        
        devices = await devicesResponse.json();
        console.log(`🔍 Devices encontrados por token: ${devices?.length || 0}`);
        
        if (devices && devices.length > 0) {
          console.log(`✅ Dispositivo encontrado por token:`);
          devices.forEach((d: any) => {
            console.log(`   - Device ${d.id}: user_id=${d.user_id}, role="${d.role}", platform=${d.platform}`);
          });
        }
      }
    } else if (directToken) {
      // If no userId but we have a token, use it directly
      console.log(`⚠️ No se proporcionó user_id, usando token directo: ${directToken.substring(0, 20)}...`);
      devices = [{ fcm_token: directToken, id: "direct-token", role: userRole || "unknown", platform: "unknown" }];
    }
    
    if (!devices || devices.length === 0) {
      console.log(`⚠️ No devices found for user_id: ${targetUserId}, role: ${userRole}`);
      return new Response(
        JSON.stringify({ 
          success: true,
          pushSent: false,
          reason: "no_devices",
          message: `No devices found for user_id: ${targetUserId}, role: ${userRole}` 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`📱 Found ${devices.length} device(s) for user_id: ${targetUserId}`);
    devices.forEach((d: any, idx: number) => {
      console.log(`   Device ${idx + 1}: id=${d.id}, role=${d.role}, platform=${d.platform}, token=${d.fcm_token?.substring(0, 20)}...`);
    });

    // Send notification to all devices
    console.log(`🚀 Iniciando envío de notificaciones a ${devices.length} dispositivo(s) usando Firebase project: ${projectId}`);
    
    const results = await Promise.allSettled(
      devices.map(async (device: any) => {
        const deviceId = device.id || "unknown";
        const deviceRole = device.role || "unknown";
        const tokenPreview = device.fcm_token?.substring(0, 20) + "...";
        
        console.log(`📤 Enviando a device ${deviceId} (role: ${deviceRole}, token: ${tokenPreview})`);
        console.log(`   Usando Firebase project: ${projectId}, clientEmail: ${clientEmail}`);
        
        const message = {
          token: device.fcm_token,
          notification: {
            title: finalTitle,
            body: finalBody,
          },
          data: data || {},
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
        };

        try {
          const response = await messaging.send(message);
          console.log(`✅ Device ${deviceId}: Enviado exitosamente - ${response}`);
          return { deviceId, success: true, response };
        } catch (error: any) {
          console.error(`❌ Device ${deviceId}: Error al enviar -`, error);
          console.error(`   Error code: ${error.code}, message: ${error.message}`);
          console.error(`   Firebase project usado: ${projectId}`);
          
          // Detect SenderId mismatch error
          if (error.code === 403 || error.message?.includes("SenderId mismatch") || error.message?.includes("SENDER_ID_MISMATCH")) {
            console.error(`   ⚠️ SENDERID MISMATCH DETECTADO:`);
            console.error(`   - El token FCM fue registrado con un proyecto Firebase diferente`);
            console.error(`   - Proyecto actual: ${projectId}`);
            console.error(`   - Rol del usuario: ${userRole}`);
            console.error(`   - Rol del dispositivo: ${deviceRole}`);
            console.error(`   - SOLUCIÓN: El token necesita ser regenerado en la app usando el google-services.json correcto`);
            console.error(`   - Para partner: usar google-services.json de bookwise-partner (project_number: 766564879842)`);
          }
          
          throw { deviceId, error, userRole, projectId, deviceRole };
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`📊 RESUMEN FINAL:`);
    console.log(`   - Rol detectado: ${userRole}`);
    console.log(`   - Firebase project: ${projectId}`);
    console.log(`   - Exitosos: ${successful}/${devices.length}`);
    console.log(`   - Fallidos: ${failed}/${devices.length}`);
    
    // Log detailed error information
    results.forEach((result, idx) => {
      if (result.status === "rejected") {
        const error = (result as any).reason;
        console.error(`   ❌ Device ${idx + 1} falló:`, error);
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        pushSent: successful > 0,
        sent: successful,
        failed: failed,
        total: devices.length,
        results: results.map((r, idx) => ({
          device: devices[idx].fcm_token.substring(0, 20) + "...",
          status: r.status,
          ...(r.status === "fulfilled" ? { result: r.value } : { error: (r as any).reason?.message || "Unknown error" }),
        })),
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
