import { Purchases } from "@revenuecat/purchases-capacitor";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

/**
 * Helper: inspecciona el customerInfo completo para diagnóstico
 * Se llama cuando entitlements es undefined/null para ver qué llegó exactamente
 */
function logCustomerInfoDiagnostic(context: string, customerInfo: any) {
  console.error("========================================");
  console.error(`[RevenueCat] ❌ DIAGNÓSTICO - entitlements undefined en: ${context}`);
  console.error("========================================");
  console.error("[RevenueCat] customerInfo completo:", JSON.stringify(customerInfo, null, 2));
  console.error("[RevenueCat] typeof customerInfo:", typeof customerInfo);
  console.error("[RevenueCat] customerInfo keys:", customerInfo ? Object.keys(customerInfo) : "null/undefined");
  console.error("[RevenueCat] customerInfo.entitlements:", customerInfo?.entitlements);
  console.error("[RevenueCat] typeof entitlements:", typeof customerInfo?.entitlements);
  console.error("[RevenueCat] originalAppUserId:", customerInfo?.originalAppUserId);
  console.error("[RevenueCat] activeSubscriptions:", customerInfo?.activeSubscriptions);
  console.error("========================================");
  console.error("[RevenueCat] POSIBLES CAUSAS:");
  console.error("[RevenueCat]   1. SDK no completamente inicializado");
  console.error("[RevenueCat]   2. Error de red al obtener customerInfo");
  console.error("[RevenueCat]   3. API Key inválida (revisar logs anteriores)");
  console.error("[RevenueCat]   4. RevenueCat SDK version incompatible");
  console.error("========================================");
}

/**
 * Verifica el estado del entitlement "pro" en RevenueCat
 * y actualiza el campo is_premium en la tabla profiles de Supabase
 * 
 * @param userId - ID del usuario en Supabase (auth.users.id)
 * @returns Promise<boolean> - true si el usuario tiene acceso pro, false en caso contrario
 */
export async function verifyPremiumEntitlement(userId: string): Promise<boolean> {
  // Solo verificar en Android (RevenueCat solo funciona en plataformas nativas)
  if (Capacitor.getPlatform() !== "android") {
    console.log("[RevenueCat] Not Android platform, skipping entitlement check");
    return false;
  }

  try {
    console.log("[RevenueCat] Verificando entitlement 'pro' para usuario:", userId);

    // Obtener información del cliente de RevenueCat
    const customerInfo = await Purchases.getCustomerInfo();

    // ✅ DIAGNÓSTICO: Loggear si entitlements es undefined
    if (!customerInfo?.entitlements) {
      logCustomerInfoDiagnostic("verifyPremiumEntitlement", customerInfo);
      return false;
    }

    if (!customerInfo?.entitlements?.active) {
      console.error("[RevenueCat] ❌ entitlements existe pero .active es undefined");
      console.error("[RevenueCat] entitlements:", JSON.stringify(customerInfo.entitlements, null, 2));
      return false;
    }

    // ✅ DEFENSIVO: Acceso seguro con encadenamiento opcional
    const hasPremiumAccess = customerInfo?.entitlements?.active?.["pro"] !== undefined;

    console.log("[RevenueCat] Estado del entitlement pro:", {
      hasPremiumAccess,
      // ✅ DEFENSIVO: Object.keys solo si active existe
      activeEntitlements: Object.keys(customerInfo?.entitlements?.active ?? {}),
      userId,
    });

    // Actualizar el campo is_premium en Supabase
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ 
        is_premium: hasPremiumAccess,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[RevenueCat] Error actualizando is_premium en Supabase:", updateError);
      throw updateError;
    }

    console.log("[RevenueCat] ✅ is_premium actualizado correctamente:", hasPremiumAccess);

    return hasPremiumAccess;
  } catch (error: any) {
    console.error("[RevenueCat] Error verificando entitlement premium:", error);
    
    // Si hay un error, intentar actualizar a false por seguridad
    try {
      await supabase
        .from("profiles")
        .update({ 
          is_premium: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    } catch (fallbackError) {
      console.error("[RevenueCat] Error en fallback update:", fallbackError);
    }

    return false;
  }
}

/**
 * Obtiene el estado actual del entitlement pro sin actualizar Supabase
 * Útil para verificar el estado sin hacer cambios en la base de datos
 * 
 * @returns Promise<boolean> - true si el usuario tiene acceso pro
 */
export async function getPremiumEntitlementStatus(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android") {
    return false;
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();

    // ✅ DIAGNÓSTICO: Loggear si entitlements es undefined
    if (!customerInfo?.entitlements) {
      logCustomerInfoDiagnostic("getPremiumEntitlementStatus", customerInfo);
      return false;
    }

    // ✅ DEFENSIVO: Acceso seguro con encadenamiento opcional
    return customerInfo?.entitlements?.active?.["pro"] !== undefined;
  } catch (error) {
    console.error("[RevenueCat] Error obteniendo estado de entitlement:", error);
    return false;
  }
}

/**
 * Configura un listener para cambios en el estado de entitlements
 * Útil para actualizar Supabase automáticamente cuando cambia el estado de suscripción
 * 
 * @param userId - ID del usuario en Supabase
 * @returns Función para remover el listener
 */
export function setupEntitlementListener(userId: string): () => void {
  if (Capacitor.getPlatform() !== "android") {
    return () => {}; // No-op function
  }

  const listener = async () => {
    console.log("[RevenueCat] Cambio detectado en entitlements, verificando pro...");
    await verifyPremiumEntitlement(userId);
  };

  // RevenueCat no tiene un listener directo, pero podemos usar un polling approach
  // o verificar cuando la app vuelve al foreground
  // Por ahora, retornamos una función no-op
  // En el futuro, se puede implementar con App.addListener('appStateChange')
  
  return () => {
    // Cleanup si es necesario
  };
}

/**
 * Identifica al usuario en RevenueCat
 * 
 * @param userId - ID del usuario en Supabase (auth.users.id)
 */
export async function identifyUser(userId: string): Promise<void> {
  if (Capacitor.getPlatform() !== "android") {
    console.log("[RevenueCat] Not Android platform, skipping user identification");
    return;
  }

  try {
    // ✅ VALIDACIÓN: Verificar que userId sea un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error("[RevenueCat] ❌ ERROR: userId no es un UUID válido:", userId);
      throw new Error(`Invalid userId format: ${userId}. Expected UUID format.`);
    }

    console.log("========================================");
    console.log("[RevenueCat] 🔐 IDENTIFICACIÓN DE USUARIO");
    console.log("========================================");
    console.log("[RevenueCat] UUID de Supabase:", userId);
    
    // ✅ Obtener el App User ID actual antes de identificar
    try {
      const customerInfoBefore = await Purchases.getCustomerInfo();
      console.log("[RevenueCat] App User ID ANTES de identificar:", customerInfoBefore?.originalAppUserId);
      console.log("[RevenueCat] Es anonymous ID:", customerInfoBefore?.originalAppUserId?.startsWith("$RCAnonymousID"));

      // ✅ DIAGNÓSTICO antes del logIn si entitlements es undefined
      if (!customerInfoBefore?.entitlements) {
        logCustomerInfoDiagnostic("identifyUser - antes de logIn", customerInfoBefore);
      }
      
      // Si ya está identificado con el mismo UUID, no hacer nada
      if (customerInfoBefore?.originalAppUserId === userId) {
        console.log("[RevenueCat] ✅ Usuario ya está identificado con este UUID, saltando logIn");
        return;
      }
    } catch (beforeError: any) {
      console.warn("[RevenueCat] ⚠️ No se pudo obtener customerInfo antes de identificar:", beforeError);
      // Continuar con el logIn de todas formas
    }
    
    // ✅ Identificar al usuario (esto vincula el usuario de Supabase con RevenueCat)
    console.log("[RevenueCat] Ejecutando Purchases.logIn({ appUserID: userId })...");
    const { customerInfo } = await Purchases.logIn({ appUserID: userId });
    
    console.log("========================================");
    console.log("[RevenueCat] ✅ USUARIO IDENTIFICADO CORRECTAMENTE");
    console.log("========================================");
    console.log("[RevenueCat] Nuevo App User ID:", customerInfo?.originalAppUserId);
    console.log("[RevenueCat] Coincide con UUID de Supabase:", customerInfo?.originalAppUserId === userId);
    console.log("[RevenueCat] NO es anonymous ID:", !customerInfo?.originalAppUserId?.startsWith("$RCAnonymousID"));

    // ✅ DIAGNÓSTICO: Loggear si entitlements es undefined después del logIn
    if (!customerInfo?.entitlements) {
      logCustomerInfoDiagnostic("identifyUser - después de logIn", customerInfo);
    } else {
      // ✅ DEFENSIVO: Object.keys solo si active existe
      console.log("[RevenueCat] Entitlements activos:", Object.keys(customerInfo?.entitlements?.active ?? {}));
    }
    console.log("========================================");
    
    // ✅ VALIDACIÓN POST-LOGIN: Verificar que el ID cambió correctamente
    if (customerInfo?.originalAppUserId !== userId) {
      console.error("[RevenueCat] ⚠️ ADVERTENCIA: App User ID no coincide con UUID de Supabase");
      console.error("[RevenueCat] Esperado:", userId);
      console.error("[RevenueCat] Obtenido:", customerInfo?.originalAppUserId);
    }
    
    if (customerInfo?.originalAppUserId?.startsWith("$RCAnonymousID")) {
      console.error("[RevenueCat] ❌ ERROR CRÍTICO: Usuario sigue siendo anonymous después de logIn!");
      throw new Error("User identification failed: Still anonymous after logIn");
    }
  } catch (error: any) {
    console.error("========================================");
    console.error("[RevenueCat] ❌ ERROR IDENTIFICANDO USUARIO");
    console.error("========================================");
    console.error("[RevenueCat] UUID intentado:", userId);
    console.error("[RevenueCat] Error message:", error?.message);
    console.error("[RevenueCat] Error code:", error?.code);
    console.error("[RevenueCat] Underlying error:", error?.underlyingErrorMessage);
    console.error("[RevenueCat] Readable error code:", error?.readableErrorCode);
    console.error("[RevenueCat] Stack:", error?.stack);
    console.error("========================================");
    throw error;
  }
}

/**
 * Realiza la compra del paquete mensual de RevenueCat
 * Usa el offering default y el paquete monthly
 * 
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function purchaseProduct(): Promise<{ success: boolean; error?: string }> {
  if (Capacitor.getPlatform() !== "android") {
    return { success: false, error: "RevenueCat solo funciona en Android" };
  }

  try {
    console.log("[RevenueCat] 💳 Iniciando compra del paquete mensual...");
    
    // ✅ PASO 1: Verificar que RevenueCat esté configurado obteniendo customerInfo
    // Si falla, intentar identificar al usuario primero (puede que no esté identificado)
    let customerInfo: any = null;
    let needsIdentification = false;
    
    try {
      customerInfo = await Purchases.getCustomerInfo();
      console.log("[RevenueCat] App User ID actual:", customerInfo?.originalAppUserId);
      
      // Verificar si el usuario está identificado (no es anonymous)
      if (customerInfo?.originalAppUserId?.startsWith("$RCAnonymousID")) {
        console.warn("[RevenueCat] ⚠️ Usuario es anonymous, necesitará identificación");
        needsIdentification = true;
      }
      
      // ✅ DIAGNÓSTICO: Loggear si entitlements es undefined
      if (!customerInfo?.entitlements) {
        logCustomerInfoDiagnostic("purchaseProduct - pre-compra", customerInfo);
        // ⚠️ NO bloquear la compra aquí - puede que simplemente no tenga entitlements activos todavía
        // El SDK puede funcionar correctamente incluso sin entitlements previos
        console.warn("[RevenueCat] ⚠️ entitlements es undefined, pero continuando con la compra...");
      } else {
        // ✅ DEFENSIVO: Object.keys solo si active existe
        console.log("[RevenueCat] Entitlements activos:", Object.keys(customerInfo?.entitlements?.active ?? {}));
      }
    } catch (infoError: any) {
      console.error("[RevenueCat] ❌ Error obteniendo customerInfo antes de compra:", infoError);
      console.error("[RevenueCat] Error details:", {
        message: infoError?.message,
        code: infoError?.code,
        underlyingErrorMessage: infoError?.underlyingErrorMessage,
        readableErrorCode: infoError?.readableErrorCode,
      });
      
      // ✅ Si es un error de credenciales (Invalid API Key), retornar error específico
      if (infoError?.code === "InvalidCredentialsError" || 
          infoError?.underlyingErrorMessage?.includes("Invalid API Key") ||
          infoError?.message?.includes("credentials")) {
        return { 
          success: false, 
          error: `Error de autenticación: ${infoError?.underlyingErrorMessage || infoError?.message || "API Key inválida. Verifica la configuración en RevenueCat Dashboard."}` 
        };
      }
      
      // ✅ Si es un error de red, retornar error específico
      if (infoError?.code === "NetworkError" || 
          infoError?.underlyingErrorMessage?.includes("network") ||
          infoError?.underlyingErrorMessage?.includes("7981")) {
        return { 
          success: false, 
          error: `Error de conexión: ${infoError?.underlyingErrorMessage || infoError?.message || "No se pudo conectar con RevenueCat. Verifica tu conexión a internet y la configuración en RevenueCat Dashboard."}` 
        };
      }
      
      // ✅ Para otros errores, continuar con la compra (puede ser un problema temporal)
      console.warn("[RevenueCat] ⚠️ Error obteniendo customerInfo, pero continuando con la compra...");
      needsIdentification = true;
    }
    
    // ✅ PASO 2: Si el usuario necesita identificación, intentar identificarlo
    // (Nota: Esto normalmente se hace en Paywall.tsx, pero lo hacemos aquí como fallback)
    if (needsIdentification) {
      console.log("[RevenueCat] 🔄 Intentando identificar usuario antes de comprar...");
      // No podemos identificar aquí sin el userId, así que solo logueamos
      // El usuario debería estar identificado en Paywall.tsx antes de llamar a purchaseProduct()
      console.warn("[RevenueCat] ⚠️ Usuario no identificado. Asegúrate de llamar identifyUser() antes de purchaseProduct()");
    }

    // Obtener ofertas disponibles (usa el offering default)
    console.log("[RevenueCat] 📦 Obteniendo ofertas disponibles (offering default)...");
    const offerings = await Purchases.getOfferings();
    
    console.log("[RevenueCat] Ofertas obtenidas:", {
      hasCurrent: !!offerings.current,
      currentIdentifier: offerings.current?.identifier,
      availablePackagesCount: offerings.current ? 
        (Array.isArray(offerings.current.availablePackages) 
          ? offerings.current.availablePackages.length 
          : Object.keys(offerings.current.availablePackages).length)
        : 0,
    });
    
    if (!offerings.current) {
      console.error("[RevenueCat] ❌ No hay ofertas disponibles (offerings.current es null)");
      console.error("[RevenueCat] Todas las ofertas:", offerings);
      return { success: false, error: "No hay ofertas disponibles. Verifica la configuración en RevenueCat Dashboard." };
    }

    // Buscar el paquete monthly del offering default
    // RevenueCat usa identificadores como "$rc_monthly", "$rc_annual", etc.
    // O podemos buscar por packageType
    let targetPackage = null;
    const packages = offerings.current.availablePackages;
    
    // Si es un array
    if (Array.isArray(packages)) {
      // Primero intentar buscar por identifier "$rc_monthly" o "monthly"
      targetPackage = packages.find(
        (pkg: any) => 
          pkg.identifier === "$rc_monthly" || 
          pkg.identifier === "monthly" ||
          pkg.identifier?.toLowerCase().includes("monthly")
      );
      
      // Si no se encuentra, buscar por packageType
      if (!targetPackage) {
        targetPackage = packages.find(
          (pkg: any) => pkg.packageType === "MONTHLY" || pkg.packageType === "monthly"
        );
      }
      
      // Si aún no se encuentra, usar el primer paquete disponible
      if (!targetPackage && packages.length > 0) {
        targetPackage = packages[0];
        console.warn("[RevenueCat] ⚠️ No se encontró paquete monthly, usando el primer paquete disponible:", targetPackage.identifier);
      }
    } 
    // Si es un objeto
    else if (typeof packages === 'object') {
      // Buscar por clave "monthly" o "$rc_monthly"
      if (packages["$rc_monthly"]) {
        targetPackage = packages["$rc_monthly"];
      } else if (packages["monthly"]) {
        targetPackage = packages["monthly"];
      } else {
        // Usar el primer paquete disponible
        const firstKey = Object.keys(packages)[0];
        if (firstKey) {
          targetPackage = (packages as any)[firstKey];
          console.warn("[RevenueCat] ⚠️ No se encontró paquete monthly, usando:", firstKey);
        }
      }
    }

    if (!targetPackage) {
      console.error("[RevenueCat] ❌ No se pudo encontrar ningún paquete disponible");
      console.error("[RevenueCat] Paquetes disponibles:", packages);
      return { success: false, error: "No se encontró el paquete mensual. Verifica la configuración en RevenueCat Dashboard." };
    }

    console.log("[RevenueCat] ✅ Paquete encontrado:", {
      identifier: targetPackage.identifier,
      packageType: targetPackage.packageType,
      storeProduct: {
        identifier: targetPackage.storeProduct?.identifier,
        title: targetPackage.storeProduct?.title,
        description: targetPackage.storeProduct?.description,
        price: targetPackage.storeProduct?.price,
        priceString: targetPackage.storeProduct?.priceString,
      }
    });
    
    // Log detallado para verificar que el producto de Google Play está correcto
    console.log("[RevenueCat] 🔍 Verificación del producto de Google Play:");
    console.log("[RevenueCat]   - Product ID esperado: partner_mensual_pro");
    console.log("[RevenueCat]   - Product ID en paquete:", targetPackage.storeProduct?.identifier);
    console.log("[RevenueCat]   - Coincide:", targetPackage.storeProduct?.identifier === "partner_mensual_pro");

    // ✅ PASO 3: Realizar la compra
    console.log("[RevenueCat] 🛒 Iniciando proceso de compra...");
    let purchaseCustomerInfo: any;
    
    try {
      const purchaseResult = await Purchases.purchasePackage({ aPackage: targetPackage });
      purchaseCustomerInfo = purchaseResult.customerInfo;
      console.log("[RevenueCat] ✅ Compra procesada exitosamente");
    } catch (purchaseError: any) {
      // Si el usuario canceló, retornar sin error
      if (purchaseError?.userCancelled) {
        console.log("[RevenueCat] ℹ️ Usuario canceló la compra");
        return { success: false, error: "Compra cancelada por el usuario" };
      }
      throw purchaseError; // Re-lanzar para que se maneje en el catch general
    }

    // ✅ PASO 4: Verificar entitlements después de la compra
    // Si entitlements es undefined, esperar un momento y reintentar (puede ser un problema de timing)
    let finalCustomerInfo = purchaseCustomerInfo;
    
    if (!finalCustomerInfo?.entitlements) {
      console.warn("[RevenueCat] ⚠️ entitlements undefined inmediatamente después de compra, esperando 1 segundo y reintentando...");
      logCustomerInfoDiagnostic("purchaseProduct - post-compra (inmediato)", finalCustomerInfo);
      
      // Esperar 1 segundo y reintentar getCustomerInfo()
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        finalCustomerInfo = await Purchases.getCustomerInfo();
        console.log("[RevenueCat] ✅ CustomerInfo obtenido después del retry");
      } catch (retryError: any) {
        console.error("[RevenueCat] ❌ Error en retry de getCustomerInfo:", retryError);
        // Continuar con el customerInfo de la compra
      }
      
      // Si aún es undefined después del retry, loggear pero continuar
      if (!finalCustomerInfo?.entitlements) {
        logCustomerInfoDiagnostic("purchaseProduct - post-compra (después de retry)", finalCustomerInfo);
        console.warn("[RevenueCat] ⚠️ entitlements sigue siendo undefined después del retry, pero la compra fue exitosa");
        // ⚠️ NO retornar error aquí - la compra fue exitosa, el entitlement puede activarse vía webhook
        // Retornar éxito pero con advertencia
        return { 
          success: true, 
          // No poner error aquí, solo éxito - el webhook activará el entitlement
        };
      }
    }

    console.log("[RevenueCat] 📋 CustomerInfo final después de compra:", {
      originalAppUserId: finalCustomerInfo?.originalAppUserId,
      // ✅ DEFENSIVO: Object.keys solo si active existe
      activeEntitlements: Object.keys(finalCustomerInfo?.entitlements?.active ?? {}),
      hasEntitlements: !!finalCustomerInfo?.entitlements,
    });

    // ✅ PASO 5: Verificar si la compra fue exitosa verificando el entitlement "pro"
    const hasProAccess = finalCustomerInfo?.entitlements?.active?.["pro"] !== undefined;

    if (hasProAccess) {
      console.log("[RevenueCat] ✅ Compra exitosa, entitlement 'pro' activo inmediatamente");
      return { success: true };
    } else {
      console.warn("[RevenueCat] ⚠️ Compra completada pero entitlement 'pro' no activo aún");
      // ✅ DEFENSIVO: Object.keys solo si active existe
      const availableEntitlements = Object.keys(finalCustomerInfo?.entitlements?.active ?? {});
      console.warn("[RevenueCat] Entitlements disponibles:", availableEntitlements);
      
      // ⚠️ La compra fue exitosa, pero el entitlement puede activarse vía webhook
      // Retornar éxito - el webhook de RevenueCat actualizará is_premium en Supabase
      console.log("[RevenueCat] ℹ️ El entitlement se activará vía webhook de RevenueCat");
      return { 
        success: true,
        // No poner error - la compra fue exitosa, el webhook manejará la activación
      };
    }
  } catch (error: any) {
    console.error("========================================");
    console.error("[RevenueCat] ❌ ERROR COMPLETO EN COMPRA");
    console.error("========================================");
    console.error("[RevenueCat] Error object:", error);
    console.error("[RevenueCat] Error message:", error?.message);
    console.error("[RevenueCat] Error code:", error?.code);
    console.error("[RevenueCat] Underlying error message:", error?.underlyingErrorMessage);
    console.error("[RevenueCat] Readable error code:", error?.readableErrorCode);
    console.error("[RevenueCat] User cancelled:", error?.userCancelled);
    console.error("[RevenueCat] Error stack:", error?.stack);
    
    // Log detallado del error para diagnóstico
    if (error?.underlyingErrorMessage) {
      console.error("[RevenueCat] 🔍 Underlying error (detalle completo):", error.underlyingErrorMessage);
    }
    console.error("========================================");
    
    // ✅ ERRORES ESPECÍFICOS DE REVENUECAT
    
    // 1. Usuario canceló
    if (error?.userCancelled) {
      console.log("[RevenueCat] ℹ️ Usuario canceló la compra");
      return { success: false, error: "Compra cancelada por el usuario" };
    }
    
    // 2. Compras no permitidas
    if (error?.code === "PURCHASE_NOT_ALLOWED") {
      return { success: false, error: "Las compras no están permitidas en este dispositivo" };
    }
    
    // 3. Error de credenciales (Invalid API Key)
    if (error?.code === "InvalidCredentialsError" || 
        error?.underlyingErrorMessage?.includes("Invalid API Key") ||
        error?.message?.includes("credentials") || 
        error?.underlyingErrorMessage?.includes("credentials")) {
      const detailedError = error?.underlyingErrorMessage || error?.message || "Error de credenciales";
      console.error("[RevenueCat] 🔐 ERROR DE CREDENCIALES detectado");
      console.error("[RevenueCat] Verifica:");
      console.error("[RevenueCat] 1. API Key correcta (debe empezar con 'goog_' para Google Play)");
      console.error("[RevenueCat] 2. JSON de Google Play subido correctamente en RevenueCat Dashboard");
      console.error("[RevenueCat] 3. App User ID identificado correctamente");
      return { 
        success: false, 
        error: `Error de autenticación: ${detailedError}. Verifica la configuración en RevenueCat Dashboard.` 
      };
    }
    
    // 4. Error de red o IAM token (7981)
    if (error?.code === "NetworkError" || 
        error?.underlyingErrorMessage?.includes("7981") ||
        error?.underlyingErrorMessage?.includes("Invalid IAM token") ||
        error?.underlyingErrorMessage?.includes("network")) {
      const detailedError = error?.underlyingErrorMessage || error?.message || "Error de conexión";
      console.error("[RevenueCat] 🌐 ERROR DE RED/CONFIGURACIÓN detectado");
      console.error("[RevenueCat] Verifica:");
      console.error("[RevenueCat] 1. Conexión a internet activa");
      console.error("[RevenueCat] 2. Service Account JSON subido en RevenueCat Dashboard");
      console.error("[RevenueCat] 3. Service Account tiene permisos en Google Play Console");
      console.error("[RevenueCat] 4. Google Play Developer API habilitada en GCP");
      return { 
        success: false, 
        error: `Error de conexión: ${detailedError}. Verifica la configuración en RevenueCat Dashboard y Google Play Console.` 
      };
    }
    
    // 5. Error desconocido del backend
    if (error?.code === "UnknownBackendError") {
      const detailedError = error?.underlyingErrorMessage || error?.message || "Error desconocido del servidor";
      console.error("[RevenueCat] ❓ ERROR DESCONOCIDO DEL BACKEND");
      console.error("[RevenueCat] Este error generalmente indica un problema de configuración en RevenueCat Dashboard");
      return { 
        success: false, 
        error: `Error del servidor: ${detailedError}. Contacta al soporte de RevenueCat o verifica la configuración.` 
      };
    }

    // 6. Error genérico
    return { 
      success: false, 
      error: error?.underlyingErrorMessage || error?.message || "Error al procesar la compra. Por favor, intenta de nuevo." 
    };
  }
}
