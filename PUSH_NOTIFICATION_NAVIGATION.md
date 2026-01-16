# 🔔 Navegación desde Notificaciones Push - Implementación Completa

## ✅ Estado: IMPLEMENTADO

## 📋 Resumen

Se ha implementado la funcionalidad completa para que cuando un usuario toque una notificación push, la aplicación navegue automáticamente a los detalles de la cita correspondiente.

---

## 🔄 Flujo Completo

```
1. Base de Datos (INSERT en client_notifications)
   ↓
2. Trigger SQL (send_push_on_notification)
   ↓
3. Edge Function (send-push-notification v48)
   ↓
4. Firebase Cloud Messaging
   ↓
5. Dispositivo del Usuario
   ↓
6. Listener de Push (partnerPushService.ts)
   ↓
7. Navegación Automática (AuthContext + React Router)
```

---

## 📁 Archivos Modificados

### 1. `supabase/functions/send-push-notification/index.ts` (v48)

**Cambios:**
- ✅ Validación estricta de roles (no valores por defecto)
- ✅ Selección dinámica de Firebase project por rol
- ✅ Pasa el objeto `data` con `appointment_id` a Firebase
- ✅ Usa `admin` namespace correctamente

**Código clave:**
```typescript
data: record.data || {},  // Contiene appointment_id, business_id, type, etc.
```

### 2. `src/services/partnerPushService.ts`

**Cambios:**
- ✅ Agregado `setNavigationCallback()` para configurar navegación
- ✅ Listener `pushNotificationActionPerformed` extrae `appointment_id`
- ✅ Navega automáticamente cuando se toca la notificación

**Código clave:**
```typescript
await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
  const appointmentId = action.notification.data?.appointment_id;
  
  if (appointmentId && navigationCallback) {
    navigationCallback(`/appointments/${appointmentId}`);
  }
});
```

### 3. `src/contexts/AuthContext.tsx`

**Cambios:**
- ✅ Importa `setNavigationCallback`
- ✅ Configura el callback con `navigate` de React Router
- ✅ Se ejecuta antes de `initializePartnerPush()`

**Código clave:**
```typescript
setNavigationCallback((path: string) => {
  console.log('[AuthContext] Navigating to:', path);
  navigate(path);
});
await initializePartnerPush(currentUser.id);
```

### 4. `supabase/migrations/20260114230015_add_push_notification_trigger.sql`

**Ya existente - NO MODIFICADO:**
```sql
'data', jsonb_build_object(
  'appointment_id', v_appointment_id,
  'business_id', v_business_id,
  'type', NEW.type,
  'notification_id', NEW.id
)
```

---

## 🧪 Prueba de Funcionamiento

### Paso 1: Insertar una notificación
```sql
INSERT INTO client_notifications (
  user_id, 
  title, 
  message, 
  type,
  appointment_id,
  business_id
) VALUES (
  'USER_ID_AQUI',
  'Nueva Cita Confirmada',
  'Tu cita para mañana está confirmada',
  'appointment_confirmed',
  'APPOINTMENT_ID_AQUI',
  'BUSINESS_ID_AQUI'
);
```

### Paso 2: Verificar en los logs de Edge Function
```
📥 Request recibido: {...}
📦 Record extraído: {...}
🔄 Procesando device ... (role: partner)
🔑 Usando secret: FIREBASE_SERVICE_ACCOUNT para rol: partner
✅ Service Account parseado - project_id: bookwise-partner
📤 Enviando notificación a partner...
✅ Notificación enviada exitosamente
```

### Paso 3: En el dispositivo
1. Usuario recibe la notificación push
2. Usuario toca la notificación
3. App abre y navega automáticamente a `/appointments/APPOINTMENT_ID`

### Paso 4: Verificar logs en consola
```
[PartnerPush] Notification tapped: {...}
[PartnerPush] Notification data: {appointment_id: "xxx", ...}
[PartnerPush] Navigating to appointment: xxx
[AuthContext] Navigating to: /appointments/xxx
```

---

## 🔑 Datos que se Pasan en la Notificación

El objeto `data` que se envía con cada notificación contiene:

```typescript
{
  appointment_id: string,    // ← PRINCIPAL para navegación
  business_id: string,
  type: string,              // ej: "appointment_confirmed"
  notification_id: string
}
```

---

## 🎯 Rutas de Navegación Disponibles

### Prioridad 1: Cita específica
```typescript
if (appointmentId) {
  navigate(`/appointments/${appointmentId}`);
}
```

### Prioridad 2: Negocio (fallback)
```typescript
else if (businessId) {
  navigate(`/businesses/${businessId}`);
}
```

---

## 📱 Compatibilidad

- ✅ **Android**: Completamente funcional
- ✅ **iOS**: Completamente funcional
- ⚠️ **Web**: No aplica (push notifications solo en nativo)

---

## 🔧 Configuración de Secrets en Supabase

Asegúrate de tener configurados:

1. **`FIREBASE_SERVICE_ACCOUNT`** (Partner - bookwise-partner)
2. **`FIREBASE_SERVICE_ACCOUNT_CLIENT`** (Cliente - mi-turnow-cliente)

Ambos deben contener el JSON completo del Service Account.

---

## 🐛 Troubleshooting

### Problema: No navega al tocar la notificación

**Solución:**
1. Verificar que el callback esté configurado:
   ```
   [PartnerPush] Navigation callback configured
   ```

2. Verificar que la notificación tenga `appointment_id`:
   ```
   [PartnerPush] Notification data: {appointment_id: "xxx"}
   ```

3. Verificar que el listener esté registrado:
   ```
   [PartnerPush] Notification tapped: {...}
   ```

### Problema: SenderId mismatch

**Solución:**
1. Verificar que el dispositivo tenga el rol correcto en `client_devices`
2. Verificar que los Secrets estén correctamente configurados
3. Desinstalar y reinstalar la app para regenerar el token

---

## 📊 Logs de Debug Útiles

```typescript
// En partnerPushService.ts
console.log('[PartnerPush] Notification data:', data);
console.log('[PartnerPush] Extracted:', { appointmentId, businessId });
console.log('[PartnerPush] Navigating to appointment:', appointmentId);

// En AuthContext.tsx
console.log('[AuthContext] Navigating to:', path);

// En Edge Function
console.log('📦 Record extraído:', JSON.stringify(record));
console.log('🔄 Procesando device', deviceId, '(role:', deviceRole, ')');
```

---

## ✨ Próximas Mejoras (Opcional)

1. **Deep linking más robusto**: Manejar estados de navegación complejos
2. **Animaciones**: Agregar transiciones suaves al navegar
3. **Badge count**: Actualizar el contador de notificaciones no leídas
4. **Notificaciones en foreground**: Mostrar modal en lugar de banner
5. **Historial de notificaciones**: Pantalla para ver todas las notificaciones

---

## 📝 Notas Finales

- El sistema está **completamente funcional** y **probado**
- La navegación funciona tanto cuando la app está **en background** como **cerrada**
- Los datos se pasan correctamente desde SQL → Edge Function → Firebase → App
- La validación de roles es **estricta** (no usa valores por defecto)

---

**Última actualización:** 15 de enero, 2026  
**Versión Edge Function:** v48  
**Estado:** ✅ PRODUCCIÓN

