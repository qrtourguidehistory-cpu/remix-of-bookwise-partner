# 🔍 AUDITORÍA COMPLETA - REGISTRO FCM TOKEN CLIENTE

## 🎯 OBJETIVO
Auditar el flujo completo de registro de tokens FCM en la **APP CLIENTE** para identificar por qué:
- ❌ No se solicitan permisos de notificaciones al reinstalar
- ❌ Los tokens no se registran o se registran incorrectamente
- ❌ Los tokens aparecen como inválidos en las Edge Functions

---

## 📋 TAREAS DE AUDITORÍA

### 1️⃣ SERVICIO DE PUSH NOTIFICATIONS

**Buscar y revisar:**
- ✅ ¿Existe un archivo de servicio de push notifications? (ej: `pushService.ts`, `clientPushService.ts`, `fcmService.ts`)
- ✅ ¿Dónde se inicializa el servicio de push?
- ✅ ¿Se solicitan permisos con `PushNotifications.requestPermissions()`?
- ✅ ¿Se llama `PushNotifications.register()`?
- ✅ ¿Hay un listener para el evento `'registration'`?
- ✅ ¿Se guarda el token en Supabase? ¿En qué tabla?
- ✅ ¿Se guarda con `role: 'client'`?

**Archivos a buscar:**
```
src/services/*push*.ts
src/lib/*push*.ts
src/utils/*push*.ts
src/hooks/*push*.ts
```

---

### 2️⃣ AUTH CONTEXT / INICIALIZACIÓN

**Buscar y revisar:**
- ✅ ¿Dónde se inicializa el servicio de push cuando el usuario inicia sesión?
- ✅ ¿Se llama al servicio cuando la app se abre con sesión existente?
- ✅ ¿Se llama al servicio después de `signIn` o `signUp`?
- ✅ ¿Hay algún `useEffect` que inicialice push notifications?

**Archivos a revisar:**
```
src/contexts/AuthContext.tsx
src/App.tsx
src/main.tsx
src/pages/auth/*.tsx
```

---

### 3️⃣ CAPACITOR CONFIGURACIÓN

**Verificar:**
- ✅ ¿Existe `capacitor.config.ts`?
- ✅ ¿Está configurado el plugin `PushNotifications`?
- ✅ ¿El `appId` es correcto para la app cliente?
- ✅ ¿Hay configuración de Firebase en `google-services.json` (Android) o `GoogleService-Info.plist` (iOS)?

**Archivos:**
```
capacitor.config.ts
android/app/google-services.json
ios/App/GoogleService-Info.plist
```

---

### 4️⃣ LISTENERS Y PERMISOS

**Buscar:**
- ✅ ¿Dónde se agregan los listeners de `PushNotifications`?
- ✅ ¿Se agrega el listener `'registration'` para recibir el token?
- ✅ ¿Se agrega el listener `'registrationError'` para errores?
- ✅ ¿Se verifica el estado de permisos antes de registrar?
- ✅ ¿Se maneja el caso cuando permisos están denegados?

**Código esperado:**
```typescript
// Debe existir algo como:
await PushNotifications.addListener('registration', async (token) => {
  // Guardar token en Supabase
});

await PushNotifications.addListener('registrationError', (error) => {
  // Manejar error
});
```

---

### 5️⃣ REGISTRO EN BASE DE DATOS

**Verificar:**
- ✅ ¿Se guarda el token en la tabla `client_devices`?
- ✅ ¿Se usa `role: 'client'` (no 'partner')?
- ✅ ¿Se usa `upsert` con `onConflict: 'fcm_token'`?
- ✅ ¿Se limpian tokens duplicados antes de guardar?
- ✅ ¿Se marca `is_active: true` y `enabled: true`?

**Código esperado:**
```typescript
await supabase
  .from('client_devices')
  .upsert({
    user_id: userId,
    role: 'client', // ✅ CRÍTICO: debe ser 'client'
    platform: 'android' | 'ios',
    fcm_token: token.value,
    is_active: true,
    enabled: true,
  }, {
    onConflict: 'fcm_token'
  });
```

---

### 6️⃣ PLATAFORMA NATIVA

**Verificar:**
- ✅ ¿Se verifica si es plataforma nativa antes de inicializar?
- ✅ ¿Se usa `Capacitor.isNativePlatform()`?
- ✅ ¿Hay lógica diferente para web vs nativo?

**Código esperado:**
```typescript
const isNative = Capacitor.isNativePlatform();
if (!isNative) {
  // Web: solo permisos básicos
  return;
}
// Native: flujo completo FCM
```

---

### 7️⃣ LOGS Y DEBUGGING

**Buscar:**
- ✅ ¿Hay `console.log` que muestren el flujo de registro?
- ✅ ¿Se loguea cuando se recibe el token?
- ✅ ¿Se loguea cuando se guarda en Supabase?
- ✅ ¿Se loguean errores de registro?

**Logs esperados:**
```
[ClientPush] Iniciando servicio...
[ClientPush] Permisos otorgados
[ClientPush] Token FCM recibido: ...
[ClientPush] Token guardado en Supabase
```

---

## 🔍 CHECKLIST DE VERIFICACIÓN

### ✅ Debe existir:
- [ ] Servicio de push notifications (`pushService.ts` o similar)
- [ ] Función `initializeClientPush(userId)` o similar
- [ ] Llamada a `PushNotifications.requestPermissions()`
- [ ] Llamada a `PushNotifications.register()`
- [ ] Listener `'registration'` que guarda el token
- [ ] Guardado en `client_devices` con `role: 'client'`
- [ ] Inicialización en `AuthContext` o `App.tsx`
- [ ] Verificación de plataforma nativa

### ❌ Problemas comunes a buscar:
- [ ] Servicio no existe o no se inicializa
- [ ] Permisos no se solicitan
- [ ] `PushNotifications.register()` nunca se llama
- [ ] Listener `'registration'` no está configurado
- [ ] Token se guarda con `role: 'partner'` en lugar de `'client'`
- [ ] Token no se guarda en Supabase
- [ ] Inicialización solo ocurre en web, no en nativo
- [ ] Servicio se inicializa pero falla silenciosamente

---

## 📤 FORMATO DE RESPUESTA

Para cada hallazgo, reportar:

### ✅ Lo que EXISTE:
```
Archivo: src/services/clientPushService.ts
Línea: 45
Código: await PushNotifications.register();
Estado: ✅ Existe y se llama correctamente
```

### ❌ Lo que FALTA:
```
Archivo: src/contexts/AuthContext.tsx
Problema: No se llama initializeClientPush después de signIn
Línea esperada: ~150 (después de signIn exitoso)
```

### ⚠️ Lo que está MAL:
```
Archivo: src/services/clientPushService.ts
Línea: 78
Problema: Token se guarda con role: 'partner' en lugar de 'client'
Código actual: role: 'partner'
Código correcto: role: 'client'
```

---

## 🎯 RESULTADO ESPERADO

Un reporte completo que identifique:
1. ✅ Qué componentes existen y funcionan
2. ❌ Qué componentes faltan
3. ⚠️ Qué componentes tienen errores
4. 📌 Recomendaciones específicas para arreglar

---

## 🔧 PRUEBAS SUGERIDAS

Después de la auditoría, verificar:
1. Abrir la app cliente → ¿Se solicitan permisos?
2. Aceptar permisos → ¿Se recibe token FCM?
3. Verificar en Supabase → ¿Existe registro en `client_devices` con `role: 'client'`?
4. Verificar logs de consola → ¿Hay logs de `[ClientPush]` o similar?

---

## 📝 NOTAS IMPORTANTES

- Esta es la **APP CLIENTE**, no la app Partner
- El `appId` en `capacitor.config.ts` debe ser diferente al Partner
- Los tokens deben guardarse con `role: 'client'`
- La app cliente puede tener una estructura diferente a la Partner

