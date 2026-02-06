# 🔧 ACTUALIZACIÓN DE SECRETS FIREBASE EN EDGE FUNCTIONS

**Fecha:** 2026-02-03  
**Objetivo:** Actualizar todas las Edge Functions para usar los secrets existentes correctos

---

## ✅ CAMBIOS REALIZADOS

### Secrets Actualizados

| Secret Antiguo | Secret Nuevo | Uso |
|----------------|--------------|-----|
| `FIREBASE_CLIENT_JSON` | `FIREBASE_SERVICE_ACCOUNT_CLIENT` | Notificaciones a clientes |
| `FIREBASE_PARTNER_JSON` | `FIREBASE_SERVICE_ACCOUNT_PARTNER` | Notificaciones a partners |

---

## 📋 ARCHIVOS MODIFICADOS

### 1. `supabase/functions/notify-appointment-confirmed/index.ts`
**Cambios:**
- ✅ Reemplazado `FIREBASE_CLIENT_JSON` → `FIREBASE_SERVICE_ACCOUNT_CLIENT`
- ✅ Agregados logs de inicialización:
  - `🔍 Buscando secret FIREBASE_SERVICE_ACCOUNT_CLIENT...`
  - `✅ Secret encontrado`
  - `✅ Secret parseado correctamente`
  - `🚀 Inicializando Firebase Admin...`
  - `✅ Firebase Admin inicializado exitosamente`

**Líneas modificadas:** ~154-176

---

### 2. `supabase/functions/notify-appointment-completed/index.ts`
**Cambios:**
- ✅ Reemplazado `FIREBASE_CLIENT_JSON` → `FIREBASE_SERVICE_ACCOUNT_CLIENT`
- ✅ Agregados logs de inicialización completos

**Líneas modificadas:** ~135-154

---

### 3. `supabase/functions/notify-appointment-cancelled/index.ts`
**Cambios:**
- ✅ Reemplazado `FIREBASE_CLIENT_JSON` → `FIREBASE_SERVICE_ACCOUNT_CLIENT`
- ✅ Agregados logs de inicialización completos

**Líneas modificadas:** ~154-176

---

### 4. `supabase/functions/notify-next-in-queue/index.ts`
**Cambios:**
- ✅ Reemplazado `FIREBASE_CLIENT_JSON` → `FIREBASE_SERVICE_ACCOUNT_CLIENT`
- ✅ Agregados logs de inicialización completos

**Líneas modificadas:** ~153-172

---

### 5. `supabase/functions/notify-new-appointment/index.ts`
**Cambios:**
- ✅ Reemplazado `FIREBASE_PARTNER_JSON` → `FIREBASE_SERVICE_ACCOUNT_PARTNER`
- ✅ Agregados logs de inicialización completos

**Líneas modificadas:** ~140-158

---

### 6. `supabase/functions/send-push-notification/index.ts`
**Cambios:**
- ✅ Actualizado mapeo de secrets:
  ```typescript
  const SECRETS: Record<string, string> = {
    partner: "FIREBASE_SERVICE_ACCOUNT_PARTNER",
    client: "FIREBASE_SERVICE_ACCOUNT_CLIENT",
  };
  ```
- ✅ Agregados logs mejorados de inicialización:
  - `🔍 Buscando secret: ${secretName} para role: ${finalRole}`
  - `✅ Secret encontrado: ${secretName}`
  - `🔍 Parseando secret ${secretName}...`
  - `✅ Secret parseado correctamente`
  - `🚀 Inicializando Firebase Admin para role: ${finalRole}...`
  - `✅ Firebase Admin inicializado exitosamente`
  - `✅ Proyecto Firebase cargado y listo para enviar push notifications`

**Líneas modificadas:** ~10-12, ~318-388

---

## 🔍 LOGS AGREGADOS

### Formato de Logs

Cada función ahora incluye logs claros en el siguiente orden:

1. **Búsqueda de secret:**
   ```
   🔍 [function-name] Buscando secret FIREBASE_SERVICE_ACCOUNT_XXX...
   ```

2. **Secret encontrado:**
   ```
   ✅ [function-name] Secret encontrado
   ```

3. **Parseo del secret:**
   ```
   ✅ [function-name] Secret parseado correctamente
   ```

4. **Inicialización de Firebase:**
   ```
   🚀 [function-name] Inicializando Firebase Admin...
   ```

5. **Inicialización exitosa:**
   ```
   ✅ [function-name] Firebase Admin inicializado exitosamente
   ```

---

## ✅ VERIFICACIONES

### Secrets Eliminados
- ❌ `FIREBASE_CLIENT_JSON` - **ELIMINADO** de todas las funciones
- ❌ `FIREBASE_PARTNER_JSON` - **ELIMINADO** de todas las funciones

### Secrets Nuevos
- ✅ `FIREBASE_SERVICE_ACCOUNT_CLIENT` - **IMPLEMENTADO** en funciones de cliente
- ✅ `FIREBASE_SERVICE_ACCOUNT_PARTNER` - **IMPLEMENTADO** en funciones de partner

### Funciones Actualizadas

| Función | Secret Usado | Estado |
|---------|--------------|--------|
| `notify-appointment-confirmed` | `FIREBASE_SERVICE_ACCOUNT_CLIENT` | ✅ Actualizado |
| `notify-appointment-completed` | `FIREBASE_SERVICE_ACCOUNT_CLIENT` | ✅ Actualizado |
| `notify-appointment-cancelled` | `FIREBASE_SERVICE_ACCOUNT_CLIENT` | ✅ Actualizado |
| `notify-next-in-queue` | `FIREBASE_SERVICE_ACCOUNT_CLIENT` | ✅ Actualizado |
| `notify-new-appointment` | `FIREBASE_SERVICE_ACCOUNT_PARTNER` | ✅ Actualizado |
| `send-push-notification` | Dinámico (según role) | ✅ Actualizado |

---

## 🚀 PRÓXIMOS PASOS

### Para Desplegar

1. **Desplegar todas las funciones actualizadas:**
   ```bash
   npx supabase functions deploy notify-appointment-confirmed
   npx supabase functions deploy notify-appointment-completed
   npx supabase functions deploy notify-appointment-cancelled
   npx supabase functions deploy notify-next-in-queue
   npx supabase functions deploy notify-new-appointment
   npx supabase functions deploy send-push-notification
   ```

2. **Verificar logs después del despliegue:**
   - Los logs deberían mostrar `✅ Secret encontrado`
   - Los logs deberían mostrar `✅ Firebase Admin inicializado exitosamente`
   - **NO** deberían aparecer errores de `FIREBASE_CLIENT_JSON no configurado`

---

## 📊 RESUMEN

- ✅ **6 archivos modificados**
- ✅ **0 referencias a secrets antiguos**
- ✅ **Logs de inicialización agregados en todas las funciones**
- ✅ **Firebase Admin se inicializa una sola vez** (verificado en código)
- ✅ **No hay múltiples `initializeApp`** (usando patrón de singleton con nombres únicos)

---

## ✅ RESULTADO ESPERADO

Después del despliegue:

1. ✅ El error `FIREBASE_CLIENT_JSON no configurado` desaparecerá
2. ✅ Las funciones usarán `FIREBASE_SERVICE_ACCOUNT_CLIENT` y `FIREBASE_SERVICE_ACCOUNT_PARTNER`
3. ✅ Los logs mostrarán claramente el proceso de inicialización
4. ✅ Las push notifications se enviarán correctamente

---

## 🔍 VERIFICACIÓN POST-DESPLIEGUE

### Logs Esperados (Éxito)

```
🔍 [notify-appointment-confirmed] Buscando secret FIREBASE_SERVICE_ACCOUNT_CLIENT...
✅ [notify-appointment-confirmed] Secret encontrado
✅ [notify-appointment-confirmed] Secret parseado correctamente
🚀 [notify-appointment-confirmed] Inicializando Firebase Admin...
✅ [notify-appointment-confirmed] Firebase Admin inicializado exitosamente
```

### Logs de Error (Si el secret no existe)

```
🔍 [notify-appointment-confirmed] Buscando secret FIREBASE_SERVICE_ACCOUNT_CLIENT...
❌ [notify-appointment-confirmed] FIREBASE_SERVICE_ACCOUNT_CLIENT no configurado
```

---

**Estado:** ✅ COMPLETADO - Listo para desplegar

