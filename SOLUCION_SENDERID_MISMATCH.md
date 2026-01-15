# 🔧 Solución: Error "SenderId mismatch" (403 PERMISSION_DENIED)

## 📋 Problema Identificado

El error **"SenderId mismatch"** ocurre cuando:
- El token FCM fue registrado usando un proyecto Firebase (con su SenderId/Project Number)
- Pero intentas enviar la notificación usando credenciales de un proyecto Firebase diferente

### Diagnóstico Actual

✅ **Usuario y dispositivo configurados correctamente:**
- Usuario: `87ab3dcf-33f6-448e-9abe-1be34faee800`
- Rol en `profiles`: `partner` ✅
- Rol en `client_devices`: `partner` ✅
- `google-services.json`: Configurado con `bookwise-partner` (project_number: `766564879842`) ✅

❌ **Problema:**
- El token FCM fue registrado con un proyecto Firebase diferente (probablemente `mi-turnow-cliente`)
- La función está intentando enviar usando `bookwise-partner`
- Resultado: **403 SenderId mismatch**

## 🔍 Verificación

### 1. Verificar el token FCM actual

```sql
SELECT 
  cd.id,
  cd.user_id,
  cd.role as device_role,
  cd.platform,
  cd.fcm_token,
  p.role as user_role
FROM client_devices cd
LEFT JOIN profiles p ON p.id = cd.user_id
WHERE cd.user_id = '87ab3dcf-33f6-448e-9abe-1be34faee800';
```

### 2. Verificar logs de la Edge Function

En Supabase Dashboard → Edge Functions → `send-push-notification` → Logs, busca:
- `👤 ROL FINAL DETERMINADO: partner`
- `🔥 Credenciales Firebase seleccionadas:`
- `⚠️ SENDERID MISMATCH DETECTADO:`

## ✅ Solución

### Opción 1: Regenerar el token FCM en la app (Recomendado)

El token FCM necesita ser regenerado usando el proyecto Firebase correcto:

1. **Verificar que la app use el `google-services.json` correcto:**
   - ✅ Ya está configurado: `android/app/google-services.json` con `bookwise-partner`

2. **Regenerar el token FCM:**
   - Desinstalar y reinstalar la app en el dispositivo
   - O limpiar datos de la app y volver a iniciar sesión
   - Esto forzará a Firebase a generar un nuevo token con el proyecto correcto

3. **Verificar que el nuevo token se registre:**
   ```sql
   SELECT * FROM client_devices 
   WHERE user_id = '87ab3dcf-33f6-448e-9abe-1be34faee800'
   ORDER BY created_at DESC;
   ```

### Opción 2: Limpiar tokens antiguos y forzar re-registro

Si la app tiene lógica para registrar tokens, puedes:

1. **Eliminar el token antiguo de la base de datos:**
   ```sql
   UPDATE client_devices 
   SET enabled = false 
   WHERE id = 'd8c0f991-6d28-4d8e-8fd6-726ab5b4aa61';
   ```

2. **Forzar re-registro en la app:**
   - La app debería detectar que no hay token y generar uno nuevo
   - El nuevo token se registrará con el proyecto correcto (`bookwise-partner`)

### Opción 3: Verificar inicialización de Firebase en la app

Asegúrate de que la app esté inicializando Firebase correctamente:

```typescript
// En tu código de la app
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';

// Debe usar el google-services.json de bookwise-partner
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Obtener token
const token = await getToken(messaging, {
  vapidKey: 'YOUR_VAPID_KEY' // Debe ser del proyecto bookwise-partner
});
```

## 🔧 Mejoras Implementadas en la Edge Function

La versión 37 ahora incluye:

1. **Logs detallados de detección de rol:**
   - Muestra si el rol viene en el request o se consulta desde `profiles`
   - Muestra el rol final determinado

2. **Logs de credenciales Firebase:**
   - Muestra qué proyecto se está usando
   - Muestra el SenderId esperado (Project Number)

3. **Detección específica de SenderId mismatch:**
   - Detecta el error 403 con mensaje "SenderId mismatch"
   - Muestra información detallada del problema
   - Sugiere la solución en los logs

## 📊 Próximos Pasos

1. **Regenerar el token FCM:**
   - Desinstalar/reinstalar la app o limpiar datos
   - Verificar que el nuevo token se registre en `client_devices`

2. **Probar nuevamente:**
   ```sql
   INSERT INTO client_notifications (user_id, title, message, type)
   VALUES (
     '87ab3dcf-33f6-448e-9abe-1be34faee800',
     'Prueba después de regenerar token',
     'Verificando que funcione con el nuevo token',
     'test'
   );
   ```

3. **Verificar logs:**
   - Revisar que el rol se detecte correctamente
   - Verificar que use el proyecto `bookwise-partner`
   - Confirmar que el envío sea exitoso

## 🐛 Troubleshooting

### Si el error persiste después de regenerar el token:

1. **Verificar que el `google-services.json` esté en el lugar correcto:**
   - `android/app/google-services.json`
   - Debe tener `project_id: "bookwise-partner"`
   - Debe tener `project_number: "766564879842"`

2. **Verificar que la app esté usando el archivo correcto:**
   - Rebuild de la app Android
   - Verificar en `android/build.gradle` que el plugin de Google Services esté habilitado

3. **Verificar credenciales en Supabase Secrets:**
   - `FIREBASE_PARTNER_PROJECT_ID` = `bookwise-partner`
   - `FIREBASE_PARTNER_CLIENT_EMAIL` = correcto
   - `FIREBASE_PARTNER_PRIVATE_KEY` = correcto (del proyecto bookwise-partner)

## 📝 Notas Importantes

- **SenderId = Project Number** en Firebase
- Cada proyecto Firebase tiene un Project Number único
- Los tokens FCM están vinculados al Project Number con el que se registraron
- No puedes usar un token de un proyecto para enviar desde otro proyecto

## ✅ Checklist

- [ ] Verificar que `google-services.json` tenga `bookwise-partner`
- [ ] Regenerar token FCM en la app (desinstalar/reinstalar)
- [ ] Verificar que el nuevo token se registre en `client_devices`
- [ ] Probar envío de notificación
- [ ] Verificar logs de Edge Function
- [ ] Confirmar que el envío sea exitoso

