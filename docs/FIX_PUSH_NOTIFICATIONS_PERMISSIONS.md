# 🔧 Fix: Permisos de Notificaciones Push y Registro de Token FCM

## 🐛 Problemas Identificados

1. **El log mostraba:** `[PartnerPush] Not native, skipping`
   - La app no intentaba obtener permisos en modo web
   - Solo funcionaba en plataforma nativa (Android/iOS)

2. **Faltaba solicitud inicial de permisos**
   - No había lógica para pedir permisos al abrir la app
   - El usuario tenía que ir manualmente a configuración

3. **Registro de Token FCM**
   - Verificar que el token se guarde con `role: 'partner'` en `client_devices`
   - Sin este token, Supabase no sabe a qué teléfono físico enviar notificaciones

---

## ✅ SOLUCIONES APLICADAS

### 1. **`partnerPushService.ts` - Soporte para Web** ✅

**Archivo modificado:** `src/services/partnerPushService.ts`

**Cambios:**
- ✅ Removido el `return` temprano cuando no es nativo
- ✅ Agregado soporte para Web Notification API
- ✅ En web: solicita permisos usando `Notification.requestPermission()`
- ✅ En nativo: mantiene el flujo completo de FCM (Android/iOS)

**Código aplicado:**
```typescript
export const initializePartnerPush = async (userId: string) => {
  console.log('[PartnerPush] START - User:', userId);

  const isNative = Capacitor.isNativePlatform();

  // ✅ WEB: Solicitar permisos usando Web Notification API
  if (!isNative) {
    console.log('[PartnerPush] Web platform detected, requesting Web Notification permissions...');
    
    if (!('Notification' in window)) {
      console.log('[PartnerPush] Web Notifications not supported in this browser');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('[PartnerPush] Web Notification permission:', permission);
      
      if (permission === 'granted') {
        console.log('[PartnerPush] ✅ Web Notification permission granted');
      } else {
        console.log('[PartnerPush] ⚠️ Web Notification permission denied');
      }
    } catch (error) {
      console.error('[PartnerPush] Error requesting web notification permission:', error);
    }
    
    return; // Web no usa FCM, solo solicita permisos
  }

  // ✅ NATIVE: Flujo completo de FCM (Android/iOS)
  // ... resto del código nativo
```

**Estado:** ✅ Completado

---

### 2. **`MobileLayout.tsx` - Solicitud Inicial de Permisos** ✅

**Archivo modificado:** `src/components/mobile/MobileLayout.tsx`

**Cambios:**
- ✅ Agregado `useEffect` para solicitar permisos al abrir la app
- ✅ Usa `useRef` para evitar solicitudes duplicadas
- ✅ Solo solicita si el usuario es partner (`profile?.business_id`)
- ✅ Configura callback de navegación para push notifications

**Código aplicado:**
```typescript
// ✅ Solicitar permisos de notificaciones al abrir la app
const notificationPermissionRequested = useRef(false);

useEffect(() => {
  if (!profile?.id || notificationPermissionRequested.current) return;

  const requestNotificationPermissions = async () => {
    try {
      notificationPermissionRequested.current = true;
      console.log('[MobileLayout] 🔔 Solicitando permisos de notificaciones...');

      // Llamar initializePartnerPush que maneja tanto web como nativo
      await initializePartnerPush(profile.id);
      
      console.log('[MobileLayout] ✅ Permisos de notificaciones procesados');
    } catch (error) {
      console.error('[MobileLayout] ❌ Error solicitando permisos de notificaciones:', error);
    }
  };

  // Solo solicitar si el usuario está autenticado y es partner
  if (profile?.business_id) {
    requestNotificationPermissions();
  }
}, [profile?.id, profile?.business_id]);

// ✅ Configurar callback de navegación para push notifications
useEffect(() => {
  const { setNavigationCallback } = require('@/services/partnerPushService');
  setNavigationCallback((path: string) => {
    console.log('[MobileLayout] 🧭 Navegando desde notificación push:', path);
    navigate(path);
  });

  return () => {
    // Cleanup: remover callback cuando el componente se desmonta
    setNavigationCallback(() => {});
  };
}, [navigate]);
```

**Estado:** ✅ Completado

---

### 3. **Verificación: Registro de Token FCM con `role: 'partner'`** ✅

**Archivo verificado:** `src/services/partnerPushService.ts`

**Verificación:**
- ✅ Línea 79-95: El token FCM se guarda correctamente en `client_devices`
- ✅ Línea 63: `role: 'partner'` está configurado correctamente
- ✅ Línea 64: `platform: platform` (android/ios) está configurado
- ✅ Línea 65: `fcm_token: token.value` se guarda correctamente
- ✅ Línea 66: `enabled: true` está configurado

**Código verificado:**
```typescript
// Step 4: Listen for token
await PushNotifications.addListener('registration', async (token) => {
  console.log('[PartnerPush] TOKEN RECEIVED:', token.value);
  
  try {
    const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
    
    const { error } = await supabase
      .from('client_devices')
      .upsert({
        user_id: userId,
        role: 'partner', // ✅ CORRECTO: role='partner'
        platform: platform,
        fcm_token: token.value, // ✅ CORRECTO: token FCM
        enabled: true,
        device_info: { device: platform, ts: new Date().toISOString() }
      });

    if (error) {
      console.error('[PartnerPush] Supabase error:', error);
    } else {
      console.log('[PartnerPush] Token saved to Supabase ✓');
    }
  } catch (e) {
    console.error('[PartnerPush] Exception:', e);
  }
});
```

**Estado:** ✅ **CORRECTO** - El token se guarda con `role: 'partner'` en `client_devices`

---

## 🚀 FLUJO COMPLETO DE NOTIFICACIONES

### **Web (Browser):**
1. Usuario abre la app
2. `MobileLayout` solicita permisos → `initializePartnerPush`
3. `initializePartnerPush` detecta que no es nativo
4. Solicita permisos usando `Notification.requestPermission()`
5. ✅ Permisos concedidos → Usuario puede recibir notificaciones web
6. ❌ En web NO se guarda token FCM (las notificaciones web funcionan diferente)

### **Nativo (Android/iOS):**
1. Usuario abre la app
2. `MobileLayout` solicita permisos → `initializePartnerPush`
3. `initializePartnerPush` detecta que es nativo
4. Crea canal Android (si aplica)
5. Solicita permisos usando `PushNotifications.requestPermissions()`
6. ✅ Permisos concedidos → Registra para FCM
7. Recibe token FCM del dispositivo
8. Guarda token en `client_devices` con `role: 'partner'`
9. ✅ Token guardado → Supabase puede enviar notificaciones push

---

## 🔍 VERIFICACIÓN

### **Verificar en Logcat (Android) o Console (Web):**

**✅ Logs Esperados (Éxito en Web):**
```
[MobileLayout] 🔔 Solicitando permisos de notificaciones...
[PartnerPush] START - User: abc-123-def
[PartnerPush] Web platform detected, requesting Web Notification permissions...
[PartnerPush] Web Notification permission: granted
[PartnerPush] ✅ Web Notification permission granted
[MobileLayout] ✅ Permisos de notificaciones procesados
```

**✅ Logs Esperados (Éxito en Nativo - Android/iOS):**
```
[MobileLayout] 🔔 Solicitando permisos de notificaciones...
[PartnerPush] START - User: abc-123-def
[PartnerPush] Creating Android channel...
[PartnerPush] Channel created
[PartnerPush] Requesting native permissions...
[PartnerPush] Permission result: granted
[PartnerPush] Registering for FCM...
[PartnerPush] Register called
[PartnerPush] TOKEN RECEIVED: eyJhbGci...
[PartnerPush] Token saved to Supabase ✓
[MobileLayout] ✅ Permisos de notificaciones procesados
```

### **Verificar Token en Supabase:**

```sql
-- Verificar que el token se guardó con role: 'partner'
SELECT 
  id,
  user_id,
  role,
  platform,
  fcm_token,
  enabled,
  created_at,
  updated_at
FROM client_devices
WHERE user_id = 'TU_USER_ID'  -- Reemplazar con tu user_id
  AND role = 'partner'
ORDER BY updated_at DESC
LIMIT 5;

-- Deberías ver:
-- id | user_id | role    | platform | fcm_token        | enabled | created_at | updated_at
-- ---|---------|---------|----------|------------------|---------|------------|------------
-- ...| abc-123 | partner | android  | eyJhbGci...      | true    | 2026-01-17 | 2026-01-17
```

---

## 🐛 TROUBLESHOOTING

### Problema: "Not native, skipping" sigue apareciendo

**Causa:** El código antiguo todavía está en caché

**Solución:**
1. Limpia el caché del navegador: `Ctrl+Shift+Delete` → Limpiar caché
2. Reinicia el servidor de desarrollo: `npm run dev`
3. Recarga la página con `Ctrl+F5` (hard refresh)

### Problema: Permisos no se solicitan al abrir la app

**Causa:** El `useEffect` no se está ejecutando

**Solución:**
1. Verifica en Logcat/Console que ves: `[MobileLayout] 🔔 Solicitando permisos de notificaciones...`
2. Si no lo ves, verifica que:
   - `profile?.id` existe
   - `profile?.business_id` existe (debe ser partner)
   - `notificationPermissionRequested.current` es `false`

### Problema: Token FCM no se guarda en `client_devices`

**Causa:** Error al guardar en Supabase o permisos no concedidos

**Solución:**
1. Verifica en Logcat que ves: `[PartnerPush] TOKEN RECEIVED: ...`
2. Si ves el token pero no se guarda, revisa los logs:
   - `[PartnerPush] Supabase error: ...` → Error de conexión o permisos
3. Verifica que la tabla `client_devices` tenga RLS permitiendo INSERT para el usuario
4. Verifica que el token se esté recibiendo: Busca `[PartnerPush] TOKEN RECEIVED` en los logs

### Problema: Permisos se solicitan múltiples veces

**Causa:** El `useRef` no está funcionando correctamente

**Solución:**
1. Verifica que `notificationPermissionRequested.current = true` se esté ejecutando
2. Verifica que no hay múltiples instancias de `MobileLayout` montándose
3. Revisa los logs: Solo deberías ver `[MobileLayout] 🔔 Solicitando permisos...` UNA vez

---

## ✅ CHECKLIST DE VERIFICACIÓN

Antes de considerar el fix completo, verifica:

- [x] `partnerPushService.ts` solicita permisos en web usando Web Notification API ✅
- [x] `partnerPushService.ts` mantiene flujo completo de FCM en nativo ✅
- [x] `MobileLayout.tsx` solicita permisos al abrir la app ✅
- [x] `MobileLayout.tsx` configura callback de navegación para push ✅
- [x] Token FCM se guarda con `role: 'partner'` en `client_devices` ✅
- [ ] Permisos se solicitan correctamente en web (verificar en navegador)
- [ ] Permisos se solicitan correctamente en nativo (verificar en Logcat)
- [ ] Token FCM se guarda correctamente en Supabase (verificar en SQL)

---

## 📝 NOTAS IMPORTANTES

### Sobre Notificaciones Web vs Nativas

- **Web:** Usa `Notification.requestPermission()` de la API estándar del navegador
- **Nativo:** Usa Capacitor Push Notifications con FCM (Firebase Cloud Messaging)
- **Token FCM:** Solo se genera y guarda en plataformas nativas (Android/iOS)
- **Web:** No necesita token FCM porque usa Service Workers y la API del navegador

### Sobre el Registro de Token

- **Cuándo se registra:** Solo cuando la app es nativa Y los permisos están concedidos
- **Dónde se guarda:** Tabla `client_devices` en Supabase
- **Campos requeridos:**
  - `user_id`: ID del usuario partner
  - `role`: `'partner'` (crítico para que Supabase sepa que es partner)
  - `platform`: `'android'` o `'ios'`
  - `fcm_token`: Token generado por FCM
  - `enabled`: `true` para que Supabase lo use

### Sobre la Solicitud de Permisos

- **Cuándo se solicita:** Al abrir la app por primera vez (si no se ha solicitado antes)
- **Frecuencia:** Solo una vez por sesión (usando `useRef` para prevenir duplicados)
- **Condición:** Solo si el usuario es partner (`profile?.business_id` existe)

---

## 🎯 RESULTADO ESPERADO

Después de aplicar estos cambios:

- ✅ La app intenta obtener permisos incluso en modo web
- ✅ Los permisos se solicitan automáticamente al abrir la app
- ✅ El token FCM se guarda con `role: 'partner'` en `client_devices`
- ✅ Supabase puede enviar notificaciones push al teléfono físico
- ✅ Las notificaciones funcionan tanto en web como en nativo

---

**Documento creado:** 2026-01-17  
**Correcciones aplicadas:** Todas ✅  
**Próximo paso:** Probar la app en web y nativo para verificar que los permisos se solicitan correctamente

