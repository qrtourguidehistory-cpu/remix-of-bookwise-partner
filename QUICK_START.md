# ⚡ QUICK START - PARTNER PUSH NOTIFICATIONS

> Guía ultra-rápida para verificar y testear la implementación

---

## ✅ VERIFICACIÓN EN 30 SEGUNDOS

```bash
# 1. Verificar archivos
ls src/lib/partnerPushService.ts        # ✅ Debe existir
ls src/lib/pushNotificationService.ts   # ❌ NO debe existir

# 2. Verificar dependencias
npm list @capacitor/push-notifications  # ✅ Debe estar instalado

# 3. Build y sync
npm run build && npx cap sync

# 4. Abrir en Android Studio
npx cap open android
```

---

## 🧪 TESTING EN 5 MINUTOS

### 1. Compilar y ejecutar
- Conectar dispositivo Android real
- Run desde Android Studio
- Esperar que abra la app

### 2. Login
- Iniciar sesión con usuario partner
- **Debe aparecer ventana de permisos**
- Aceptar permisos

### 3. Verificar logs
```bash
adb logcat | grep "PartnerPush"
```

**Debe aparecer:**
```
[PartnerPush] 🚀 Iniciando servicio...
[PartnerPush] ✅ Permisos otorgados
[PartnerPush] 🎫 Token FCM recibido
[PartnerPush] ✅ Token guardado exitosamente
```

### 4. Verificar BD
```sql
SELECT fcm_token, platform, role, enabled 
FROM client_devices 
WHERE role = 'partner' 
ORDER BY updated_at DESC 
LIMIT 1;
```

**Debe retornar:** 1 fila con `enabled = true`

### 5. Enviar notificación de prueba
- Ir a Firebase Console
- Cloud Messaging → Send test message
- Pegar token de la BD
- Enviar

**Debe llegar la notificación** 🎉

---

## 🔍 CHECKLIST MÍNIMO

- [ ] `partnerPushService.ts` existe
- [ ] `pushNotificationService.ts` NO existe
- [ ] Build sin errores
- [ ] App solicita permisos al login
- [ ] Token aparece en BD con `role='partner'`
- [ ] Notificación de prueba llega

---

## 🆘 PROBLEMAS COMUNES

| Problema | Solución |
|----------|----------|
| Token no se guarda | Verificar RLS policies |
| Permisos denied | Desinstalar y reinstalar |
| Notificación no llega | Verificar Firebase config |
| App crashea | `./gradlew clean` y rebuild |

---

## 📚 DOCUMENTACIÓN COMPLETA

- **Arquitectura**: `IMPLEMENTACION_PARTNER_PUSH.md`
- **Testing detallado**: `TESTING_PARTNER_PUSH.md`
- **Resumen ejecutivo**: `RESUMEN_IMPLEMENTACION_FINAL.md`
- **Checklist completo**: `CHECKLIST_IMPLEMENTACION.md`
- **Código para copiar**: `CODIGO_PARA_COPIAR.md`
- **Overview**: `README_PARTNER_PUSH.md`

---

## 🚀 RESULTADO ESPERADO

Si todo funciona:

✅ Token registrado en BD  
✅ Notificaciones llegan  
✅ Navegación funciona  
✅ Logs claros  

**→ LISTO PARA PRODUCCIÓN 🎉**

---

**⏱️ Tiempo total: ~5 minutos**

**🎯 Siguiente paso: Desplegar a producción**


