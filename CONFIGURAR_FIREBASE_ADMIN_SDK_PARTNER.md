# 🔧 Configurar Firebase Admin SDK para Partner - mi-turnow-partner

## 📋 Resumen

Esta guía explica cómo configurar las credenciales de Firebase Admin SDK para el proyecto **mi-turnow-partner** en Supabase Edge Functions.

## 🔑 Información del Proyecto

- **Package Name**: `com.miturnow.partner`
- **Project ID**: `mi-turnow-partner`
- **Archivo de credenciales**: `mi-turnow-partner-firebase-adminsdk.json` (en la raíz del proyecto)

## ✅ Verificaciones Completadas

### 1. `google-services.json` ✅
El archivo `android/app/google-services.json` ya está configurado correctamente:
- **Project ID**: `mi-turnow-partner` ✅
- **Package Name**: `com.miturnow.partner` ✅

### 2. Registro de Token FCM ✅
El archivo `src/services/partnerPushService.ts` ya guarda los tokens correctamente:
```typescript
await supabase.from('client_devices').upsert({
  user_id: userId,
  role: 'partner',  // ✅ CORRECTO
  platform: platform,
  fcm_token: token.value,
  enabled: true
});
```

### 3. Edge Function ✅
La Edge Function `supabase/functions/send-push-notification/index.ts` está configurada para usar:
- Secret: `FIREBASE_SERVICE_ACCOUNT` (para rol `partner`)
- Lee el JSON completo del secret y lo parsea

## 🚀 Pasos para Configurar el Secret en Supabase

### Opción 1: Usando Supabase Dashboard (Recomendado)

1. **Ir a Supabase Dashboard**
   - Abre [Supabase Dashboard](https://app.supabase.com/)
   - Selecciona tu proyecto

2. **Navegar a Edge Functions Secrets**
   - Ve a **Settings** → **Edge Functions** → **Secrets**

3. **Agregar/Actualizar el Secret**
   - Busca el secret `FIREBASE_SERVICE_ACCOUNT` (o créalo si no existe)
   - Abre el archivo `mi-turnow-partner-firebase-adminsdk.json` en un editor de texto
   - Copia **todo el contenido JSON** (incluyendo las llaves `{}`)
   - Pégalo en el valor del secret

4. **Verificar el formato**
   El JSON debe verse así (sin espacios extra al inicio/final):
   ```json
   {
     "type": "service_account",
     "project_id": "mi-turnow-partner",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-...@mi-turnow-partner.iam.gserviceaccount.com",
     ...
   }
   ```

### Opción 2: Usando Supabase CLI

```bash
# Leer el contenido del archivo JSON y subirlo como secret
cat mi-turnow-partner-firebase-adminsdk.json | supabase secrets set FIREBASE_SERVICE_ACCOUNT
```

**Nota para Windows PowerShell:**
```powershell
# En PowerShell, usar Get-Content para leer el archivo
Get-Content mi-turnow-partner-firebase-adminsdk.json -Raw | supabase secrets set FIREBASE_SERVICE_ACCOUNT
```

### Opción 3: Usando la API de Supabase

```bash
# Obtener el Access Token de Supabase
SUPABASE_ACCESS_TOKEN="tu-access-token"

# Leer el JSON y codificarlo
JSON_CONTENT=$(cat mi-turnow-partner-firebase-adminsdk.json)

# Subir el secret
curl -X POST "https://api.supabase.com/v1/projects/{project-ref}/secrets" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"FIREBASE_SERVICE_ACCOUNT\", \"value\": $JSON_CONTENT}"
```

## ✅ Verificación

### 1. Verificar que el secret esté configurado

Puedes verificar que el secret esté configurado correctamente revisando los logs de la Edge Function:

```bash
supabase functions logs send-push-notification --follow
```

Cuando se ejecute, deberías ver:
```
🔑 Usando secret: FIREBASE_SERVICE_ACCOUNT para rol: partner
✅ Secret FIREBASE_SERVICE_ACCOUNT encontrado
✅ Service Account parseado - project_id: mi-turnow-partner
```

### 2. Probar el envío de notificación

Inserta una notificación de prueba:

```sql
INSERT INTO client_notifications (
  user_id,
  title,
  message,
  type
) VALUES (
  'USER_ID_AQUI',
  'Prueba de Configuración',
  'Verificando Firebase Admin SDK',
  'general'
);
```

Si todo está bien configurado, deberías ver en los logs:
```
✅ Firebase app creada: app-partner con proyecto: mi-turnow-partner
✅ Notificación enviada exitosamente a partner
```

## ⚠️ Importante

1. **El archivo JSON no se usa directamente en el código**
   - El Edge Function de Supabase lee el JSON desde el secret `FIREBASE_SERVICE_ACCOUNT`
   - No necesitas modificar el código para cambiar de proyecto

2. **El secret debe contener el JSON completo**
   - No solo el `private_key`, sino todo el objeto JSON completo
   - El código parsea el JSON y extrae `project_id`, `private_key`, `client_email`, etc.

3. **Seguridad**
   - El archivo `mi-turnow-partner-firebase-adminsdk.json` debe estar en `.gitignore`
   - Nunca subas este archivo a GitHub o repositorios públicos

## 📝 Archivos Modificados

Durante esta configuración, se actualizó la documentación:

- ✅ `PUSH_NOTIFICATIONS_SETUP.md` - Actualizado para mencionar `mi-turnow-partner`
- ✅ `PUSH_NOTIFICATION_NAVIGATION.md` - Actualizado para mencionar `mi-turnow-partner`
- ✅ Este archivo (`CONFIGURAR_FIREBASE_ADMIN_SDK_PARTNER.md`) - Nueva guía

**Código existente (NO modificado):**
- ✅ `supabase/functions/send-push-notification/index.ts` - Ya configurado correctamente
- ✅ `src/services/partnerPushService.ts` - Ya guarda con `role: 'partner'`
- ✅ `android/app/google-services.json` - Ya tiene `project_id: "mi-turnow-partner"`

## 🎯 Resumen Final

**Estado de la configuración:**

- ✅ `google-services.json` → Project ID: `mi-turnow-partner`
- ✅ `partnerPushService.ts` → Guarda tokens con `role: 'partner'`
- ✅ Edge Function → Usa `FIREBASE_SERVICE_ACCOUNT` secret
- ⚠️ **PENDIENTE**: Subir el contenido de `mi-turnow-partner-firebase-adminsdk.json` como secret `FIREBASE_SERVICE_ACCOUNT` en Supabase

Una vez que subas el secret a Supabase, todo debería funcionar correctamente. 🚀

