# ✅ CHECKLIST DE IMPLEMENTACIÓN - PARTNER PUSH NOTIFICATIONS

## 📋 VERIFICACIÓN RÁPIDA

### ✅ CÓDIGO IMPLEMENTADO

- [x] **`src/lib/partnerPushService.ts`** creado (600 líneas)
- [x] **`src/lib/pushNotificationService.ts`** eliminado (servicio viejo)
- [x] **`src/contexts/AuthContext.tsx`** actualizado con nueva integración
- [x] Sin errores de linting
- [x] Sin imports rotos

### ✅ FUNCIONALIDADES IMPLEMENTADAS

#### 1️⃣ Solicitud de permisos
- [x] Se solicita **cada vez** que inicia la app
- [x] Maneja estado `granted` → registra token
- [x] Maneja estado `denied` → inicia monitoreo
- [x] Maneja estado `prompt` → muestra solicitud
- [x] Monitoreo cada 10s detecta activación desde Settings

#### 2️⃣ Registro en Supabase
- [x] Usa tabla `client_devices`
- [x] Campo `role = 'partner'`
- [x] Usa `upsert` (no duplica)
- [x] NO borra tokens viejos
- [x] Logs con prefijo `[PartnerPush]`

#### 3️⃣ Canal Android
- [x] Canal único `'default'`
- [x] Se inicializa al arrancar
- [x] Máxima prioridad (importance: 5)

#### 4️⃣ Recepción de notificaciones
- [x] Foreground → toast + log
- [x] Background → navega según payload
- [x] App cerrada → abre y navega
- [x] Logs claros para debug

#### 5️⃣ Integración AuthContext
- [x] Llama `initializePartnerPush(userId)` al login
- [x] Llama `initializePartnerPush(userId)` al arrancar con sesión
- [x] Llama `cleanupPartnerPush()` al logout

#### 6️⃣ Limpieza
- [x] Código legacy eliminado
- [x] Sin duplicados
- [x] Solo `@capacitor/push-notifications`

---

## 🧪 TESTING PRE-DEPLOY

### Antes de compilar:

- [ ] Verificar `@capacitor/push-notifications` instalado
- [ ] Verificar `google-services.json` en `android/app/`
- [ ] Run `npm run build`
- [ ] Run `npx cap sync`

### Testing en dispositivo:

- [ ] **Escenario 1**: Primera instalación + aceptar permisos
  - [ ] Aparece ventana de permisos
  - [ ] Token aparece en BD
  - [ ] Logs `[PartnerPush]` correctos

- [ ] **Escenario 2**: Rechazar permisos + activar desde Settings
  - [ ] Monitoreo detecta cambio
  - [ ] Token se registra automáticamente

- [ ] **Escenario 3**: Reinstalar app
  - [ ] Nuevo token generado
  - [ ] Solo 1 registro en BD (upsert)

- [ ] **Escenario 4**: Cerrar y abrir app
  - [ ] Verifica permisos cada vez
  - [ ] Logs aparecen al arrancar

- [ ] **Escenario 5**: Notificación foreground
  - [ ] Toast aparece
  - [ ] Log del payload

- [ ] **Escenario 6**: Notificación background
  - [ ] Navega correctamente
  - [ ] Log de acción

- [ ] **Escenario 7**: Logout
  - [ ] Token marcado `enabled=false`
  - [ ] Listeners removidos

---

## 🔍 VERIFICACIÓN EN BD

```sql
-- Debe retornar el token del usuario
SELECT * FROM client_devices 
WHERE user_id = 'TU_USER_ID' 
  AND role = 'partner';
```

**Verificar:**
- [ ] `fcm_token` tiene valor
- [ ] `platform` = 'android' o 'ios'
- [ ] `role` = 'partner'
- [ ] `enabled` = true

---

## 📱 VERIFICACIÓN DE LOGS

### Logs esperados al iniciar app:

```
[PartnerPush] 🚀 Iniciando servicio...
[PartnerPush] 📢 Creando canal Android...
[PartnerPush] 🔐 Verificando permisos...
[PartnerPush] ✅ Permisos ya otorgados (o 📱 Solicitando permisos...)
[PartnerPush] 📝 Registrando para notificaciones...
[PartnerPush] 🎧 Configurando listeners...
[PartnerPush] 🎫 Token FCM recibido: eyJ...
[PartnerPush] 💾 Guardando token en Supabase...
[PartnerPush] ✅ Token guardado exitosamente
[PartnerPush] ✅ Servicio inicializado correctamente
```

**Verificar:**
- [ ] Todos los logs aparecen en orden
- [ ] No hay errores `❌`
- [ ] Token se guarda exitosamente

---

## 🚀 DESPLIEGUE

### Pre-deploy checklist:

- [ ] Código testeado en dispositivo real
- [ ] Todos los escenarios funcionan
- [ ] Token se registra correctamente
- [ ] Notificaciones llegan
- [ ] Edge Function `send_push_notification` funciona
- [ ] Firebase configurado correctamente

### Post-deploy checklist:

- [ ] Monitorear logs en producción
- [ ] Verificar tokens en BD
- [ ] Enviar notificaciones de prueba
- [ ] Confirmar que usuarios reciben notificaciones

---

## 📚 DOCUMENTACIÓN DISPONIBLE

- [x] **`IMPLEMENTACION_PARTNER_PUSH.md`** - Arquitectura completa
- [x] **`TESTING_PARTNER_PUSH.md`** - Guía de testing detallada
- [x] **`RESUMEN_IMPLEMENTACION_FINAL.md`** - Resumen ejecutivo
- [x] **`CHECKLIST_IMPLEMENTACION.md`** - Este archivo

---

## 🆘 TROUBLESHOOTING RÁPIDO

### Token no se guarda:
1. Verificar RLS policies en `client_devices`
2. Verificar que `user_id` es correcto
3. Ver logs: debe aparecer `✅ Token guardado`

### Permisos siempre denied:
1. Desinstalar app
2. Reinstalar
3. Aceptar permisos en primera solicitud

### Notificaciones no llegan:
1. Verificar `enabled = true` en BD
2. Probar desde Firebase Console
3. Verificar Edge Function

### App crashea:
1. Verificar `google-services.json`
2. Run `npx cap sync`
3. Limpiar build: `cd android && ./gradlew clean`

---

## ✅ CONFIRMACIÓN FINAL

**Marca cuando esté completo:**

- [ ] Código implementado y testeado
- [ ] Token se registra en BD
- [ ] Permisos se solicitan correctamente
- [ ] Notificaciones llegan en todos los estados
- [ ] Documentación revisada
- [ ] Listo para producción

---

## 🎉 RESULTADO

**Si todos los checkboxes están marcados:**

✅ **Implementación completa**  
✅ **Testing exitoso**  
✅ **Listo para desplegar**

**🚀 ¡A producción!**





