# 📋 CÓDIGO LISTO PARA COPIAR - PARTNER PUSH

Este archivo contiene los fragmentos de código exactos que se implementaron, por si necesitas verificar o copiar manualmente.

---

## 1️⃣ SERVICIO COMPLETO: `src/lib/partnerPushService.ts`

**Status:** ✅ Ya creado en tu proyecto

**Ubicación:** `src/lib/partnerPushService.ts`

**Líneas de código:** ~600

**Funciones exportadas:**
```typescript
// Singleton
export const partnerPushService = new PartnerPushService();

// Funciones de conveniencia
export async function initializePartnerPush(userId: string): Promise<boolean>
export async function cleanupPartnerPush(): Promise<void>
export function getPartnerPushStatus()
```

**Uso:**
```typescript
import { initializePartnerPush, cleanupPartnerPush } from '@/lib/partnerPushService';

// Al login o arrancar app
await initializePartnerPush(userId);

// Al logout
await cleanupPartnerPush();
```

---

## 2️⃣ INTEGRACIÓN EN AUTHCONTEXT: `src/contexts/AuthContext.tsx`

**Status:** ✅ Ya actualizado en tu proyecto

### Cambio 1: Import

```typescript
// ANTES:
import { initializePushNotifications, clearPushToken } from "@/lib/pushNotificationService";

// DESPUÉS:
import { initializePartnerPush, cleanupPartnerPush } from "@/lib/partnerPushService";
```

### Cambio 2: Inicialización al arrancar app con sesión existente

```typescript
// Ubicación: dentro de initializeAuth(), después de fetchUserProfile
if (currentUser) {
  lastUserIdRef.current = currentUser.id;
  // Fetch profile without blocking - it will set loading to false when done
  fetchUserProfile(currentUser.id).finally(() => {
    if (mounted) {
      setLoading(false);
    }
  });
  
  // ✅ NUEVO: Initialize push notifications on app start if user is already logged in
  initializePartnerPush(currentUser.id).catch((err) => {
    console.log("[Auth] Push notifications init skipped:", err);
  });
} else {
  // No session, we're done
  setLoading(false);
}
```

### Cambio 3: Inicialización al cambiar estado de auth

```typescript
// Ubicación: dentro de onAuthStateChange listener
// Fetch profile if we have a user
if (currentUser) {
  setLoading(true);
  fetchUserProfile(currentUser.id).finally(() => {
    if (mounted) {
      setLoading(false);
    }
  });
  
  // ✅ NUEVO: Initialize push notifications when auth state changes to signed in
  initializePartnerPush(currentUser.id).catch((err) => {
    console.log("[Auth] Push notifications init skipped:", err);
  });
} else {
  // No user, clear profile
  setProfile(null);
  if (mounted) {
    setLoading(false);
  }
}
```

### Cambio 4: Inicialización al login

```typescript
// Ubicación: función signIn
const signIn = async (email: string, password: string) => {
  try {
    // ... código existente ...
    
    toast.success("¡Bienvenido!");
    
    // ✅ NUEVO: Initialize push notifications after successful login
    // Get user ID and initialize partner push service
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      initializePartnerPush(user.id).catch((err) => {
        console.log("[Auth] Push notifications init skipped:", err);
      });
    }
    
    return { error: null };
  } catch (err: any) {
    toast.error(err.message || "Error inesperado");
    return { error: err };
  }
};
```

### Cambio 5: Limpieza al logout

```typescript
// ANTES:
const signOut = async () => {
  // Clear push token before signing out
  await clearPushToken().catch((err) => {
    console.log("[Auth] Error clearing push token:", err);
  });
  
  // ... resto del código ...
};

// DESPUÉS:
const signOut = async () => {
  // ✅ NUEVO: Cleanup push service before signing out
  await cleanupPartnerPush().catch((err) => {
    console.log("[Auth] Error cleaning up push service:", err);
  });
  
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    toast.error(error.message);
    return;
  }

  setUser(null);
  setSession(null);
  setProfile(null);
  lastUserIdRef.current = null;
  isInitializedRef.current = false;
  toast.success("Sesión cerrada");
  window.location.href = "/auth/login";
};
```

---

## 3️⃣ ARCHIVO ELIMINADO

**Status:** ✅ Ya eliminado

```
❌ src/lib/pushNotificationService.ts (ELIMINADO)
```

Este archivo contenía la lógica vieja que guardaba tokens en `profiles.push_token`. Ya no existe.

---

## 4️⃣ VERIFICACIÓN DE DEPENDENCIAS

### package.json

**Verificar que existe:**

```json
{
  "dependencies": {
    "@capacitor/push-notifications": "^8.0.0",
    "@capacitor/core": "^8.0.0",
    "@capacitor/android": "^8.0.0",
    "@capacitor/ios": "^8.0.0"
  }
}
```

**Si falta, instalar:**

```bash
npm install @capacitor/push-notifications@^8.0.0
npx cap sync
```

---

## 5️⃣ CONFIGURACIÓN FIREBASE (Android)

### android/app/google-services.json

**Debe existir este archivo con tu configuración de Firebase.**

Si no existe:
1. Ir a Firebase Console
2. Project Settings → General
3. Descargar `google-services.json`
4. Colocar en `android/app/google-services.json`

### android/app/build.gradle

**Verificar que existe:**

```gradle
apply plugin: 'com.google.gms.google-services'
```

---

## 6️⃣ TABLA EN SUPABASE

### client_devices

**Verificar estructura:**

```sql
CREATE TABLE IF NOT EXISTS client_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  fcm_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'partner')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, platform, role)
);
```

**Verificar RLS policies:**

```sql
-- Policy para que usuarios gestionen sus propios dispositivos
CREATE POLICY "Users can manage own devices"
ON client_devices
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## 7️⃣ COMANDOS PARA BUILD Y SYNC

```bash
# 1. Build del proyecto
npm run build

# 2. Sincronizar con Capacitor
npx cap sync

# 3. Abrir en Android Studio (para compilar)
npx cap open android

# 4. O compilar desde terminal
cd android
./gradlew assembleDebug
```

---

## 8️⃣ LOGS ESPERADOS

### Al iniciar la app:

```
[PartnerPush] 🚀 Iniciando servicio...
[PartnerPush] 📢 Creando canal Android...
[PartnerPush] 🔐 Verificando permisos...
[PartnerPush] ✅ Permisos ya otorgados
[PartnerPush] 📝 Registrando para notificaciones...
[PartnerPush] 🎧 Configurando listeners...
[PartnerPush] 👁️ Iniciando monitoreo de permisos...
[PartnerPush] ✅ Servicio inicializado correctamente
```

### Cuando llega el token:

```
[PartnerPush] 🎫 Token FCM recibido: eyJhbGciOiJSUzI1NiIsImtpZCI6...
[PartnerPush] 💾 Guardando token en Supabase...
[PartnerPush] ✅ Token guardado exitosamente: [{ id: "...", user_id: "...", ... }]
```

### Al recibir notificación (foreground):

```
[PartnerPush] 📥 FOREGROUND - Notificación recibida: {
  title: "Nueva cita",
  body: "Juan Pérez reservó para hoy 3:00 PM",
  data: { appointment_id: "123-abc" }
}
```

### Al tocar notificación (background):

```
[PartnerPush] 🔔 BACKGROUND/CLOSED - Usuario tocó notificación: {
  actionId: "tap",
  notification: { data: { appointment_id: "123-abc" } }
}
[PartnerPush] 🧭 Navegando según payload: { appointment_id: "123-abc" }
```

### Al hacer logout:

```
[PartnerPush] 🧹 Limpiando servicio...
[PartnerPush] ✅ Token desmarcado en BD
[PartnerPush] ✅ Listeners removidos
[PartnerPush] ✅ Limpieza completa
```

---

## 9️⃣ QUERY SQL PARA VERIFICAR

```sql
-- Ver token del usuario actual
SELECT 
  id,
  user_id,
  fcm_token,
  platform,
  role,
  enabled,
  created_at,
  updated_at
FROM client_devices
WHERE user_id = 'TU_USER_ID'  -- Reemplazar con tu user_id
  AND role = 'partner'
ORDER BY updated_at DESC;
```

**Resultado esperado:**

| id | user_id | fcm_token | platform | role | enabled | created_at | updated_at |
|----|---------|-----------|----------|------|---------|------------|------------|
| abc-123 | def-456 | eyJhbGci... | android | partner | true | 2026-01-14 | 2026-01-14 |

---

## 🔟 ENVIAR NOTIFICACIÓN DE PRUEBA

### Opción 1: Firebase Console

1. Ir a Firebase Console
2. Cloud Messaging → Send test message
3. Pegar el `fcm_token` de la BD
4. Agregar título y mensaje
5. Enviar

### Opción 2: Edge Function

```bash
curl -X POST https://TU_PROYECTO.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer TU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "abc-123-def",
    "role": "partner",
    "title": "Test de notificación",
    "body": "Esta es una prueba",
    "data": {
      "appointment_id": "test-123",
      "type": "test"
    }
  }'
```

### Opción 3: Supabase Dashboard

```sql
-- Llamar Edge Function desde SQL
SELECT net.http_post(
  url := 'https://TU_PROYECTO.supabase.co/functions/v1/send-push-notification',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || 'TU_SERVICE_ROLE_KEY'
  ),
  body := jsonb_build_object(
    'user_id', 'abc-123-def',
    'role', 'partner',
    'title', 'Test',
    'body', 'Prueba',
    'data', jsonb_build_object('appointment_id', 'test-123')
  )
);
```

---

## ✅ CHECKLIST FINAL

Antes de considerar completo:

- [ ] Archivo `partnerPushService.ts` creado
- [ ] Archivo `pushNotificationService.ts` eliminado
- [ ] `AuthContext.tsx` actualizado (5 cambios)
- [ ] Dependencias instaladas
- [ ] `google-services.json` configurado
- [ ] Tabla `client_devices` existe con RLS
- [ ] Build y sync ejecutados
- [ ] Testeado en dispositivo real
- [ ] Token aparece en BD
- [ ] Notificaciones llegan

---

## 🎉 ¡LISTO!

**Si todos los checkboxes están marcados, la implementación está completa.**

**No hay más código que copiar o modificar.**

**🚀 A testear y desplegar!**






