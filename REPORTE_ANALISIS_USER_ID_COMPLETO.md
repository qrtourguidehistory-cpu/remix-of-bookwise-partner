# 🔍 REPORTE COMPLETO: ANÁLISIS DE USER_ID EN PUSH NOTIFICATIONS

**Fecha:** 2026-02-02  
**Problema:** Todas las notificaciones llegan al mismo usuario (jordanpremium15@gmail.com)

---

## 📋 RESUMEN EJECUTIVO

### ✅ Lo que está CORRECTO:

1. ✅ **Función `call_send_push_notification()`:**
   - Construye el payload correctamente con `'user_id', p_user_id::text`
   - NO usa `auth.uid()`, `current_user`, `owner_id`, ni valores hardcodeados
   - Envía el payload directamente a la Edge Function

2. ✅ **Función `send_push_on_client_notification()`:**
   - Pasa correctamente `NEW.user_id` a `call_send_push_notification()`

3. ✅ **Notificaciones en la BD:**
   - Tienen el `user_id` correcto

### ⚠️ PROBLEMA IDENTIFICADO:

**El problema está en cómo la Edge Function extrae el `user_id` del payload.**

**Código Actual:**
```typescript
const record = requestBody.record || requestBody;
const targetUserId = record.user_id || record.userId || record.clientId;
```

**Problema Potencial:**
- Si `requestBody.record` existe (aunque sea `{}` o tenga un `user_id` incorrecto), se usará en lugar de `requestBody`
- Esto podría causar que se use un `user_id` incorrecto si `requestBody.record.user_id` existe

---

## 🔧 SOLUCIÓN APLICADA: LOGS OBLIGATORIOS

Se agregaron logs detallados en la Edge Function para rastrear:

1. ✅ **Payload completo recibido**
2. ✅ **Record extraído**
3. ✅ **User ID extraído y su fuente**
4. ✅ **User ID normalizado (usado para buscar dispositivos)**
5. ✅ **Dispositivos encontrados y sus user_ids**

### Logs Agregados:

```typescript
// ✅ LOG OBLIGATORIO #1: Payload completo recibido
console.log("📥 [PAYLOAD] Request completo recibido:", JSON.stringify(requestBody, null, 2));
console.log("📥 [PAYLOAD] requestBody.record existe:", !!requestBody.record);
console.log("📥 [PAYLOAD] requestBody.record:", requestBody.record ? JSON.stringify(requestBody.record, null, 2) : "null/undefined");
console.log("📥 [PAYLOAD] requestBody.user_id:", requestBody.user_id);
console.log("📥 [PAYLOAD] requestBody.userId:", requestBody.userId);
console.log("📥 [PAYLOAD] requestBody.clientId:", requestBody.clientId);

// ✅ LOG OBLIGATORIO #2: Record extraído
console.log("📦 [RECORD] Record extraído:", JSON.stringify(record, null, 2));
console.log("📦 [RECORD] record.user_id:", record?.user_id);
console.log("📦 [RECORD] record.userId:", record?.userId);
console.log("📦 [RECORD] record.clientId:", record?.clientId);

// ✅ LOG OBLIGATORIO #3: User ID extraído
console.log("🎯 [USER_ID] targetUserId extraído:", targetUserId);
console.log("🎯 [USER_ID] Fuente: record.user_id=", record?.user_id, "| record.userId=", record?.userId, "| record.clientId=", record?.clientId);

// ✅ LOG OBLIGATORIO #4: User ID normalizado
console.log("🔄 [USER_ID] normalizedUserId (usado para buscar dispositivos):", normalizedUserId);

// ✅ LOG OBLIGATORIO #5: Dispositivos encontrados
console.log(`📱 [DEVICES] Dispositivos encontrados (raw):`, JSON.stringify(devices, null, 2));
console.log(`📱 [DEVICES] Cantidad de dispositivos:`, devices.length);
console.log(`📱 [DEVICES] User IDs únicos en dispositivos:`, Array.from(uniqueUserIds));
```

---

## 🎯 PRÓXIMOS PASOS

1. **Desplegar la Edge Function con los logs agregados**
2. **Probar confirmando una cita desde Partner**
3. **Revisar los logs en Supabase Dashboard**
4. **Identificar exactamente qué `user_id` se está usando**

---

## 🔍 ANÁLISIS DEL FLUJO ESPERADO

### Flujo Correcto:

1. **SQL Trigger:** `trigger_send_push_on_client_notification` → `send_push_on_client_notification()`
2. **SQL Function:** `send_push_on_client_notification()` llama a `call_send_push_notification(NEW.user_id, ...)`
3. **SQL Function:** `call_send_push_notification()` construye:
   ```json
   {
     "user_id": "ef2e21d7-999f-4301-8b05-00b9605f36c0",  // ✅ CORRECTO
     "title": "Cita confirmada",
     "body": "...",
     "role": "client",
     "data": {...}
   }
   ```
4. **Edge Function:** Recibe el payload y extrae:
   ```typescript
   requestBody = { user_id: "...", title: "...", ... }
   record = requestBody.record || requestBody;  // record = requestBody (porque record no existe)
   targetUserId = record.user_id;  // ✅ DEBERÍA SER CORRECTO
   ```

### Posible Problema:

Si `requestBody.record` existe pero tiene un `user_id` diferente o incorrecto, se usará ese en lugar del correcto.

---

## 📝 CONCLUSIÓN

Los logs agregados permitirán identificar exactamente:
1. Qué payload se recibe
2. Qué `user_id` se extrae
3. Qué `user_id` se usa para buscar dispositivos
4. Qué dispositivos se encuentran

**Con estos logs, podremos identificar el problema exacto y aplicar el fix necesario.**

---

**FIN DEL REPORTE**

