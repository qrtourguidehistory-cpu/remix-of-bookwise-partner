# 🧪 Testing Partner Push Notifications

## Prerequisitos
- [ ] App compilada en Android/iOS con Capacitor 7.x
- [ ] Firebase configurado (google-services.json / GoogleService-Info.plist)
- [ ] Supabase Edge Function `send_push_notification` desplegada
- [ ] Usuario partner creado en Supabase (role: 'partner')

---

## Test 1: Primera instalación (permisos desde cero)

### Pasos:
1. Desinstalar app completamente del dispositivo
2. Reinstalar app desde Android Studio / Xcode
3. Abrir app y hacer login como partner
4. **Verificar:** Aparece popup nativo solicitando permisos de notificaciones
5. **Acción:** Aceptar permisos
6. **Verificar logs:** Buscar en consola:
```
[PartnerPush] Requesting permissions...
[PartnerPush] Permission status: granted
[PartnerPush] Registering for push...
[PartnerPush] Token registered: <FCM_TOKEN>
```
7. **Verificar Supabase:** Ir a tabla `client_devices`, filtrar por user_id del partner
   - Debe existir 1 registro con:
     - role: 'partner'
     - platform: 'android' o 'ios'
     - fcm_token: <token generado>
     - enabled: true

### ✅ Resultado esperado:
- Permisos concedidos ✅
- Token registrado en Supabase ✅
- Logs sin errores ✅

---

## Test 2: Permisos denegados inicialmente

### Pasos:
1. Desinstalar app
2. Reinstalar app
3. Abrir app y hacer login como partner
4. **Acción:** DENEGAR permisos cuando aparezca el popup
5. **Verificar:** Aparece toast rojo con mensaje de error
6. **Verificar logs:**
```
[PartnerPush] Permission status: denied
```
7. **Verificar Supabase:** NO debe haber token registrado para este usuario

### Pasos adicionales (activar desde settings):
8. Ir a Settings del dispositivo → Apps → Mi Turnow Partner → Notificaciones → Activar
9. Volver a la app (NO cerrar, solo cambiar de app)
10. **Verificar logs:**
```
[PartnerPush] App resumed, checking permissions...
[PartnerPush] Permissions changed: denied → granted
[PartnerPush] Registering for push...
[PartnerPush] Token registered: <FCM_TOKEN>
```
11. **Verificar Supabase:** Ahora SÍ debe aparecer el token

### ✅ Resultado esperado:
- Detección automática de cambio de permisos ✅
- Token registrado después de activar desde settings ✅

---

## Test 3: Recibir notificación (app abierta - foreground)

### Pasos:
1. Asegurar que app está abierta y en foreground
2. Desde Supabase SQL Editor, ejecutar:

```sql
SELECT send_push_notification(
  '<USER_ID_PARTNER>'::uuid,
  'partner',
  'Prueba Foreground',
  'Esta es una notificación de prueba',
  '{"appointment_id": "test-123", "screen": "AppointmentDetails"}'::jsonb
);
```

3. **Verificar:** Aparece toast en app con título y mensaje
4. **Verificar logs:**
```
[PartnerPush] Foreground notification: { title: "Prueba Foreground", body: "..." }
```

### ✅ Resultado esperado:
- Toast visible en app ✅
- Logs registrados ✅
- NO navega automáticamente (foreground no navega) ✅

---

## Test 4: Recibir notificación (app en background)

### Pasos:
1. Minimizar app (Home o App Switcher)
2. Desde Supabase SQL Editor, ejecutar:

```sql
SELECT send_push_notification(
  '<USER_ID_PARTNER>'::uuid,
  'partner',
  'Nueva cita',
  'Tienes una cita pendiente',
  '{"appointment_id": "abc-456"}'::jsonb
);
```

3. **Verificar:** Notificación aparece en bandeja del sistema
4. **Acción:** Tocar la notificación
5. **Verificar:** App se abre y navega a `/appointments`
6. **Verificar logs:**
```
[PartnerPush] Notification tapped: { data: { appointment_id: "abc-456" } }
[PartnerPush] Navigating to: /appointments
```

### ✅ Resultado esperado:
- Notificación en bandeja ✅
- Tap abre la app ✅
- Navegación correcta ✅

---

## Test 5: Múltiples dispositivos (mismo usuario)

### Pasos:
1. Instalar app en 2 dispositivos diferentes
2. Hacer login con el mismo usuario partner en ambos
3. **Verificar Supabase:** Deben existir 2 registros en `client_devices` con mismo user_id pero diferentes fcm_token
4. Enviar notificación
5. **Verificar:** Ambos dispositivos la reciben

### ✅ Resultado esperado:
- 2 tokens registrados ✅
- Ambos dispositivos reciben notificación ✅

---

## Test 6: Logout y cleanup

### Pasos:
1. Con app abierta y token registrado
2. Hacer logout
3. **Verificar logs:**
```
[AuthContext] Cleaning up push notifications...
[PartnerPush] Cleanup completed
```
4. Enviar notificación al usuario (desde Supabase)
5. **Verificar:** NO debe recibirse (listeners removidos)

### ✅ Resultado esperado:
- Cleanup ejecutado sin errores ✅
- Notificaciones NO se reciben después de logout ✅

---

## 🐛 Troubleshooting

### Token no se registra en Supabase
- Verificar logs de errores en consola
- Revisar constraint UNIQUE en tabla
- Confirmar que userId es correcto
- Verificar que la tabla `profiles` tiene el campo `role` con valor 'partner'

### Notificaciones no llegan
- Verificar Edge Function desplegada
- Confirmar que fcm_token existe en tabla
- Revisar logs de Firebase Cloud Messaging
- Verificar que el token no está expirado

### App no navega al tocar notificación
- Verificar que data.appointment_id, business_id o screen existen en payload
- Revisar logs de navegación
- Confirmar que navigate() funciona en contexto React

### Permisos no se detectan al volver de Settings
- Verificar que App listener está registrado
- Revisar logs de appStateChange
- Confirmar que la app no se reinicia al volver de Settings

---

## 📝 Notas importantes

- **Foreground vs Background:** Las notificaciones se manejan diferente según el estado de la app
- **Navegación:** Solo ocurre cuando se toca la notificación, no cuando llega
- **Cleanup:** Es crucial para evitar memory leaks y notificaciones duplicadas
- **Role detection:** El sistema consulta `profiles.role` para determinar si es partner

---
