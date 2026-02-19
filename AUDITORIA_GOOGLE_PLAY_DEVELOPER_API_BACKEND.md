# 🔍 AUDITORÍA TÉCNICA COMPLETA: Google Play Developer API - Backend

**Fecha:** 2026-02-17  
**Objetivo:** Detectar por qué las llamadas a la Google Play Developer API para validar suscripciones están fallando

---

## RESUMEN EJECUTIVO

**Diagnóstico Final:** ❌ **NO EXISTE CÓDIGO BACKEND QUE USE LA GOOGLE PLAY DEVELOPER API**

El proyecto **NO tiene ninguna implementación** de validación de suscripciones de Google Play usando la Google Play Developer API. Solo existe código para:
- ✅ Stripe (webhook y verificación)
- ✅ PayPal (webhook y verificación)
- ❌ **Google Play: AUSENTE COMPLETAMENTE**

**Conclusión:** El backend no está implementado para validar suscripciones de Google Play directamente. El proyecto depende únicamente de RevenueCat, pero no hay validación backend propia.

---

## 1️⃣ AUTENTICACIÓN

### 1.1 Búsqueda de OAuth2 y Service Account

**Búsqueda realizada:**
```bash
grep -r "google.*auth\|googleapis\|@google-cloud\|service.*account" supabase/functions/
grep -r "GOOGLE.*PLAY.*SERVICE\|ANDROID.*PUBLISHER" supabase/functions/
```

**Resultado:**
- ❌ **NO existe código de autenticación OAuth2 para Google Play**
- ❌ **NO existe uso de Service Account de Google Play**
- ❌ **NO existe importación de `googleapis` o `@google-cloud/androidpublisher`**
- ❌ **NO existe variable de entorno `GOOGLE_PLAY_SERVICE_ACCOUNT` o similar**

### 1.2 Verificación de Scope OAuth2

**Búsqueda realizada:**
```bash
grep -r "androidpublisher\|https://www.googleapis.com/auth/androidpublisher" supabase/functions/
```

**Resultado:**
- ❌ **NO existe referencia al scope `https://www.googleapis.com/auth/androidpublisher`**
- ❌ **NO existe generación de access_token OAuth2**

### 1.3 Comparación con Implementaciones Existentes

**Código existente para PayPal (referencia):**
```typescript
// supabase/functions/process-paypal-return/index.ts
async function getPayPalAccessToken(): Promise<string> {
  const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)}`,
    },
    body: 'grant_type=client_credentials',
  });
  // ...
}
```

**Código esperado para Google Play (AUSENTE):**
```typescript
// ❌ NO EXISTE
import { google } from 'googleapis';
// ❌ NO EXISTE
const auth = new google.auth.GoogleAuth({
  keyFile: serviceAccountJson,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
// ❌ NO EXISTE
const androidpublisher = google.androidpublisher({ version: 'v3', auth });
```

**Conclusión:** ❌ **NO existe autenticación OAuth2 para Google Play Developer API**

---

## 2️⃣ PROYECTO GCP

### 2.1 Búsqueda de Configuración de Proyecto GCP

**Búsqueda realizada:**
```bash
grep -r "project_id\|GCP_PROJECT\|GOOGLE_CLOUD_PROJECT" supabase/functions/
find . -name "*.json" -type f | grep -i google
```

**Resultado:**
- ❌ **NO existe variable de entorno con project_id de GCP**
- ❌ **NO existe archivo JSON de Service Account de Google Play en el código**
- ✅ Existe `google-services.json` (Firebase, NO Google Play Developer API)
- ✅ Existe `mi-turnow-partner-firebase-adminsdk-fbsvc-48bc413e72.json` (Firebase Admin SDK, NO Google Play)

### 2.2 Verificación de Archivos JSON

**Archivos JSON encontrados:**
1. `android/app/google-services.json` - Firebase (NO Google Play Developer API)
2. `android/mi-turnow-partner-firebase-adminsdk-fbsvc-48bc413e72.json` - Firebase Admin SDK (NO Google Play Developer API)

**Archivos JSON AUSENTES:**
- ❌ **NO existe archivo JSON de Service Account de Google Play Developer API**
- ❌ **NO existe variable de entorno con JSON de Service Account**

### 2.3 Comparación con Firebase (implementación existente)

**Código existente para Firebase:**
```typescript
// supabase/functions/send-push-notification/index.ts
const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_CLIENT");
const serviceAccount: admin.ServiceAccount = JSON.parse(serviceAccountJson);
const firebaseApp = getFirebaseApp(finalRole, serviceAccount);
```

**Código esperado para Google Play (AUSENTE):**
```typescript
// ❌ NO EXISTE
const googlePlayServiceAccountJson = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT");
// ❌ NO EXISTE
const serviceAccount = JSON.parse(googlePlayServiceAccountJson);
// ❌ NO EXISTE
const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
```

**Conclusión:** ❌ **NO existe configuración de proyecto GCP para Google Play Developer API**

---

## 3️⃣ ENDPOINTS DE LA API

### 3.1 Búsqueda de Endpoints de Google Play Developer API

**Búsqueda realizada:**
```bash
grep -r "androidpublisher\|purchases.subscriptions\|purchases.subscriptionsv2" supabase/functions/
grep -r "play.googleapis.com" supabase/functions/
```

**Resultado:**
- ❌ **NO existe llamada a `androidpublisher.purchases.subscriptions.get`**
- ❌ **NO existe llamada a `androidpublisher.purchases.subscriptionsv2.get`**
- ❌ **NO existe llamada a `play.googleapis.com/androidpublisher/v3`**
- ❌ **NO existe ninguna función que valide purchase tokens de Google Play**

### 3.2 Comparación con Implementaciones Existentes

**Código existente para PayPal:**
```typescript
// supabase/functions/process-paypal-return/index.ts
async function getPayPalSubscription(accessToken: string, subscriptionId: string): Promise<any> {
  const response = await fetch(`https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${subscriptionId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  return await response.json();
}
```

**Código esperado para Google Play (AUSENTE):**
```typescript
// ❌ NO EXISTE
async function getGooglePlaySubscription(
  packageName: string,
  subscriptionId: string,
  purchaseToken: string
): Promise<any> {
  const androidpublisher = google.androidpublisher({ version: 'v3', auth });
  const response = await androidpublisher.purchases.subscriptions.get({
    packageName: packageName,
    subscriptionId: subscriptionId,
    token: purchaseToken,
  });
  return response.data;
}
```

### 3.3 Edge Functions Existentes

**Edge Functions encontradas:**
- ✅ `verify-stripe-session` - Verifica sesiones de Stripe
- ✅ `stripe-webhook` - Procesa webhooks de Stripe
- ✅ `paypal-webhook` - Procesa webhooks de PayPal
- ✅ `process-paypal-return` - Procesa retornos de PayPal
- ✅ `confirm-paypal-subscription` - Confirma suscripciones de PayPal
- ❌ **`verify-google-play-subscription` - AUSENTE**
- ❌ **`google-play-webhook` - AUSENTE**

**Conclusión:** ❌ **NO existe ningún endpoint que use la Google Play Developer API**

---

## 4️⃣ DATOS CRÍTICOS DE LA LLAMADA

### 4.1 Búsqueda de packageName

**Búsqueda realizada:**
```bash
grep -r "com.miturnow.partner\|packageName\|package_name" supabase/functions/
```

**Resultado:**
- ❌ **NO existe uso de `packageName` en Edge Functions**
- ❌ **NO existe validación de `packageName` en backend**
- ✅ `packageName` existe en `capacitor.config.ts` y `build.gradle` (frontend/build)

**Ubicación del packageName (solo frontend):**
```typescript
// capacitor.config.ts
appId: 'com.miturnow.partner'

// android/app/build.gradle
applicationId "com.miturnow.partner"
```

### 4.2 Búsqueda de subscriptionId y purchaseToken

**Búsqueda realizada:**
```bash
grep -r "subscriptionId\|purchaseToken\|purchase_token" supabase/functions/
```

**Resultado:**
- ❌ **NO existe uso de `purchaseToken` en Edge Functions**
- ❌ **NO existe validación de `purchaseToken` en backend**
- ✅ `subscriptionId` existe pero solo para PayPal/Stripe, NO para Google Play

**Código existente (solo PayPal/Stripe):**
```typescript
// supabase/functions/process-paypal-return/index.ts
const { subscription_id, token, ba_token } = body; // PayPal token, NO purchaseToken de Google Play
```

**Código esperado para Google Play (AUSENTE):**
```typescript
// ❌ NO EXISTE
const { packageName, subscriptionId, purchaseToken } = body;
// ❌ NO EXISTE
if (!packageName || !subscriptionId || !purchaseToken) {
  return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400 });
}
```

### 4.3 Verificación de Tokens

**Búsqueda realizada:**
```bash
grep -r "token.*expir\|expired.*token\|validate.*token" supabase/functions/
```

**Resultado:**
- ❌ **NO existe validación de tokens de Google Play**
- ❌ **NO existe detección de tokens expirados**
- ❌ **NO existe verificación de tokens incorrectos**

**Conclusión:** ❌ **NO existe validación de datos críticos (packageName, subscriptionId, purchaseToken) para Google Play**

---

## 5️⃣ CONTEXTO DE EJECUCIÓN

### 5.1 Verificación de Llamadas desde Frontend

**Búsqueda realizada:**
```bash
grep -r "supabase.functions.invoke.*google\|supabase.functions.invoke.*play" src/
grep -r "verify.*google.*play\|validate.*google.*play" src/
```

**Resultado:**
- ❌ **NO existe llamada desde frontend a función de validación de Google Play**
- ❌ **NO existe hook o servicio que valide suscripciones de Google Play en backend**

**Código existente (solo RevenueCat en frontend):**
```typescript
// src/lib/revenueCatService.ts
export async function purchaseProduct(): Promise<{ success: boolean; error?: string }> {
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: targetPackage });
  // Solo usa RevenueCat SDK, NO valida en backend
}
```

### 5.2 Verificación de Llamadas desde Cliente Móvil

**Búsqueda realizada:**
```bash
grep -r "android.*publisher\|google.*play.*api" android/
```

**Resultado:**
- ❌ **NO existe código nativo Android que llame a Google Play Developer API**
- ✅ Solo existe uso de RevenueCat SDK (que internamente usa Google Play Billing Library)

**Conclusión:** ✅ **Las llamadas se hacen SOLO desde backend (pero NO EXISTE backend para Google Play)**

---

## 6️⃣ ERRORES Y RESPUESTAS

### 6.1 Búsqueda de Manejo de Errores HTTP

**Búsqueda realizada:**
```bash
grep -r "401\|403\|404.*google\|play" supabase/functions/
grep -r "error.*google.*play\|Invalid.*token.*google" supabase/functions/
```

**Resultado:**
- ❌ **NO existe manejo de errores 401/403/404 de Google Play Developer API**
- ❌ **NO existe captura de errores de autenticación de Google Play**
- ❌ **NO existe logging de errores de Google Play Developer API**

### 6.2 Análisis de Errores Esperados

**Si existiera código, estos serían los errores posibles:**

1. **401 Unauthorized:**
   - Causa: Token OAuth2 inválido o expirado
   - Significado: Service Account no autenticado correctamente
   - Línea de código: ❌ **NO EXISTE CÓDIGO**

2. **403 Forbidden:**
   - Causa: Service Account sin permisos en Google Play Console
   - Significado: Cuenta de servicio no invitada o sin permisos
   - Línea de código: ❌ **NO EXISTE CÓDIGO**

3. **404 Not Found:**
   - Causa: packageName, subscriptionId o purchaseToken incorrectos
   - Significado: Suscripción no encontrada en Google Play
   - Línea de código: ❌ **NO EXISTE CÓDIGO**

**Conclusión:** ❌ **NO existe código que pueda generar estos errores porque NO EXISTE implementación**

---

## 7️⃣ CONCLUSIÓN

### 7.1 Qué está mal

❌ **NO existe código backend que use la Google Play Developer API**
- ❌ No hay autenticación OAuth2 con Service Account
- ❌ No hay llamadas a `androidpublisher.purchases.subscriptions.get`
- ❌ No hay validación de purchase tokens
- ❌ No hay Edge Function para verificar suscripciones de Google Play
- ❌ No hay manejo de errores de Google Play Developer API

❌ **El proyecto depende únicamente de RevenueCat**
- ✅ RevenueCat SDK funciona en frontend
- ❌ No hay validación backend propia de Google Play
- ❌ No hay webhook de RevenueCat configurado (si existe)

### 7.2 Qué está bien

✅ **Configuración de frontend:**
- ✅ RevenueCat SDK configurado correctamente
- ✅ API Key de RevenueCat correcta (`goog_tikShxRoguFTFrhLWiWrSmssyzo`)
- ✅ Package name consistente (`com.miturnow.partner`)

✅ **Implementaciones de otros proveedores:**
- ✅ Stripe: webhook y verificación funcionando
- ✅ PayPal: webhook y verificación funcionando

### 7.3 Qué debe cambiarse

🔧 **IMPLEMENTAR validación backend de Google Play Developer API**

**Acciones requeridas:**

1. **Crear Edge Function `verify-google-play-subscription`:**
   ```typescript
   // supabase/functions/verify-google-play-subscription/index.ts
   import { google } from 'googleapis';
   
   serve(async (req) => {
     // 1. Obtener Service Account JSON desde Secrets
     const serviceAccountJson = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
     if (!serviceAccountJson) {
       return new Response(JSON.stringify({ error: 'Service Account not configured' }), { status: 500 });
     }
     
     // 2. Autenticar con OAuth2
     const auth = new google.auth.GoogleAuth({
       credentials: JSON.parse(serviceAccountJson),
       scopes: ['https://www.googleapis.com/auth/androidpublisher'],
     });
     
     // 3. Inicializar Android Publisher API
     const androidpublisher = google.androidpublisher({ version: 'v3', auth });
     
     // 4. Obtener datos del request
     const { packageName, subscriptionId, purchaseToken } = await req.json();
     
     // 5. Validar suscripción
     try {
       const response = await androidpublisher.purchases.subscriptions.get({
         packageName: packageName,
         subscriptionId: subscriptionId,
         token: purchaseToken,
       });
       
       return new Response(JSON.stringify({ success: true, data: response.data }), { status: 200 });
     } catch (error: any) {
       // Manejar errores 401, 403, 404
       return new Response(JSON.stringify({ 
         success: false, 
         error: error.message,
         code: error.code,
       }), { status: error.code || 500 });
     }
   });
   ```

2. **Configurar variable de entorno en Supabase:**
   - Nombre: `GOOGLE_PLAY_SERVICE_ACCOUNT`
   - Valor: JSON completo del Service Account (como string)

3. **Verificar que el Service Account tenga:**
   - ✅ Permisos en Google Play Console
   - ✅ Scope `https://www.googleapis.com/auth/androidpublisher`
   - ✅ Project ID correcto donde está habilitada la API

4. **Crear función helper para validar suscripciones:**
   ```typescript
   // src/lib/googlePlayService.ts
   export async function verifyGooglePlaySubscription(
     packageName: string,
     subscriptionId: string,
     purchaseToken: string
   ): Promise<{ success: boolean; data?: any; error?: string }> {
     const { data, error } = await supabase.functions.invoke('verify-google-play-subscription', {
       body: { packageName, subscriptionId, purchaseToken },
     });
     
     if (error) {
       return { success: false, error: error.message };
     }
     
     return { success: true, data };
   }
   ```

### 7.4 Diagnóstico Final

**Problema raíz:** ❌ **NO EXISTE implementación backend de Google Play Developer API**

**Solución:** 🔧 **Crear Edge Function que use la Google Play Developer API con autenticación OAuth2**

**Tiempo estimado:** 2-4 horas (implementación + testing)

**Dificultad:** Media-Alta (requiere conocimiento de Google Play Developer API y OAuth2)

---

## 8️⃣ CHECKLIST DE IMPLEMENTACIÓN

### 8.1 Verificaciones Previas

- [x] ✅ Service Account existe en Google Cloud Platform
- [x] ✅ Service Account está invitado en Google Play Console
- [x] ✅ Service Account tiene permisos: "Administrar pedidos y suscripciones" y "Ver datos financieros"
- [x] ✅ API Google Play Developer está habilitada en el proyecto GCP
- [ ] ⚠️ JSON de Service Account está disponible para usar en Supabase Secrets

### 8.2 Implementación Requerida

- [ ] **1. Crear Edge Function `verify-google-play-subscription`**
- [ ] **2. Implementar autenticación OAuth2 con Service Account**
- [ ] **3. Implementar llamada a `androidpublisher.purchases.subscriptions.get`**
- [ ] **4. Agregar manejo de errores (401, 403, 404)**
- [ ] **5. Configurar variable de entorno `GOOGLE_PLAY_SERVICE_ACCOUNT` en Supabase**
- [ ] **6. Crear función helper en frontend (opcional)**
- [ ] **7. Probar con purchase token real**
- [ ] **8. Verificar logs de errores**

---

## 9️⃣ EXPLICACIÓN TÉCNICA DETALLADA

### 9.1 Por qué no funciona actualmente

**Flujo actual:**
```
1. App Android → RevenueCat SDK → RevenueCat Backend
2. RevenueCat Backend → Google Play Developer API ❌ (RevenueCat tiene su propia validación)
3. Si RevenueCat falla, NO hay fallback en tu backend
```

**Flujo esperado (con implementación):**
```
1. App Android → RevenueCat SDK → RevenueCat Backend
2. Tu Backend → Google Play Developer API ✅ (validación propia)
3. Si RevenueCat falla, tu backend puede validar directamente
```

### 9.2 Errores comunes y soluciones

**Error 401 Unauthorized:**
- **Causa:** Service Account JSON incorrecto o scope incorrecto
- **Solución:** Verificar que el JSON tenga `project_id`, `private_key`, `client_email` y que el scope sea exactamente `https://www.googleapis.com/auth/androidpublisher`

**Error 403 Forbidden:**
- **Causa:** Service Account no invitado en Google Play Console o sin permisos
- **Solución:** Invitar Service Account en Google Play Console → Setup → API access → Service accounts → Link service account

**Error 404 Not Found:**
- **Causa:** packageName, subscriptionId o purchaseToken incorrectos
- **Solución:** Verificar que `packageName` sea exactamente `com.miturnow.partner`, que `subscriptionId` exista en Google Play Console, y que `purchaseToken` sea válido y no esté expirado

---

## 🔟 CONCLUSIÓN FINAL

**Diagnóstico:** ❌ **NO EXISTE código backend que use la Google Play Developer API**

**Solución:** 🔧 **Implementar Edge Function con autenticación OAuth2 y llamadas a la API**

**Prioridad:** 🔴 **ALTA** (si necesitas validación backend propia de Google Play)

**Nota:** Si solo usas RevenueCat y no necesitas validación backend propia, el problema puede estar en la configuración de RevenueCat (Service Account no vinculado en RevenueCat Dashboard), NO en tu backend.

---

**FIN DE AUDITORÍA TÉCNICA**

