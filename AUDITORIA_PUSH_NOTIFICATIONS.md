# 🔍 AUDITORÍA COMPLETA: PROBLEMAS DE NOTIFICACIONES PUSH

**Fecha:** 2026-02-02  
**Contexto:** Sistema refactorizado recientemente, triggers legacy eliminados, solo 2 triggers centralizados (confirmed y completed)

---

## 📊 RESUMEN EJECUTIVO

Se identificaron **3 problemas críticos** que impiden que las notificaciones push lleguen correctamente:

1. ❌ **CRÍTICO:** Valores NO-STRING en el campo `data` enviado a Firebase
2. ❌ **CRÍTICO:** Dispositivos del Partner con `is_active = false`
3. ⚠️ **MENOR:** Filtros correctos pero dispositivos inactivos

---

## 🔴 PROBLEMA #1: VALORES NO-STRING EN CAMPO `data` (CRÍTICO)

### Descripción
Firebase Cloud Messaging (FCM) **requiere que TODOS los valores en el campo `data` sean strings**. Actualmente, el sistema está enviando valores booleanos (como `consolidated: true`), lo que causa el error:

```
messaging/invalid-payload: data must only contain string values
```

### Ubicación del Problema

**Archivo:** `supabase/functions/send-push-notification/index.ts`  
**Línea:** 378

```typescript
data: record.data || {},
```

**Función SQL:** `send_push_on_client_notification()`  
**Línea problemática:**
```sql
IF NEW.meta IS NOT NULL AND jsonb_typeof(NEW.meta) = 'object' THEN
  v_data := v_data || NEW.meta;  -- ❌ PROBLEMA: NEW.meta contiene valores booleanos
END IF;
```

### Evidencia

**Query de Auditoría #10:**
```json
{
  "id": "921cd0f4-3823-4442-9e75-be151c7ef435",
  "type": "confirmation",
  "meta": {
    "type": "confirmation",
    "business_id": "9e7daf16-7c47-4df3-9566-aadf09184dfa",
    "consolidated": true,  // ❌ BOOLEAN, NO STRING
    "business_name": "SALON YULISA",
    "appointment_date": "2026-02-03",
    "appointment_time": "09:30:00"
  },
  "consolidated_type": "boolean"  // ❌ CONFIRMADO: Es boolean
}
```

**Flujo del Problema:**
1. `handle_appointment_confirmation()` crea `client_notification` con `meta` que incluye `consolidated: true` (boolean)
2. `send_push_on_client_notification()` hace `v_data := v_data || NEW.meta`
3. `call_send_push_notification()` envía `p_data` (que contiene `consolidated: true`) a la Edge Function
4. La Edge Function pasa `record.data` directamente a Firebase: `data: record.data || {}`
5. Firebase rechaza el payload porque `consolidated: true` no es un string

### Impacto
- ❌ **100% de las notificaciones fallan** cuando `meta` contiene valores booleanos
- ❌ Error visible en logs: `messaging/invalid-payload: data must only contain string values`
- ❌ Las notificaciones no llegan a ningún dispositivo

---

## 🔴 PROBLEMA #2: DISPOSITIVOS DEL PARTNER CON `is_active = false` (CRÍTICO)

### Descripción
El partner `3a3e0599-296c-4cb2-8658-e3a095de75d1` (Yulisa Reyes) tiene **3 dispositivos registrados**, pero **TODOS tienen `is_active = false`**.

### Evidencia

**Query de Auditoría #11:**
```json
[
  {
    "id": "146d147d-5e69-44ea-8083-86e816edfb89",
    "user_id": "3a3e0599-296c-4cb2-8658-e3a095de75d1",
    "role": "partner",
    "platform": "android",
    "is_active": false,  // ❌ INACTIVO
    "tiene_token": true,
    "longitud_token": 142,
    "created_at": "2026-02-01 01:14:13.595181+00",
    "updated_at": "2026-02-01 01:14:13.595181+00"
  },
  {
    "id": "3269f874-a114-4693-9b90-accc3b8f42a6",
    "user_id": "3a3e0599-296c-4cb2-8658-e3a095de75d1",
    "role": "partner",
    "platform": "android",
    "is_active": false,  // ❌ INACTIVO
    "tiene_token": true,
    "longitud_token": 142,
    "created_at": "2026-01-31 19:18:50.861715+00",
    "updated_at": "2026-01-31 19:18:50.861715+00"
  },
  {
    "id": "45bb49e4-d09f-49e6-ade4-10ab876098d4",
    "user_id": "3a3e0599-296c-4cb2-8658-e3a095de75d1",
    "role": "partner",
    "platform": "android",
    "is_active": false,  // ❌ INACTIVO
    "tiene_token": true,
    "longitud_token": 142,
    "created_at": "2026-01-30 03:39:42.199297+00",
    "updated_at": "2026-01-30 03:39:42.199297+00"
  }
]
```

**Logs de Edge Function:**
```
⚠️ No se encontraron dispositivos para user_id: 3a3e0599-296c-4cb2-8658-e3a095de75d1, role: client
⚠️ No se encontraron dispositivos para user_id: 3a3e0599-296c-4cb2-8658-e3a095de75d1, role: partner
```

### Ubicación del Problema

**Archivo:** `supabase/functions/send-push-notification/index.ts`  
**Línea:** 205

```typescript
const devicesUrl = `${supabaseUrl}/rest/v1/client_devices?user_id=eq.${normalizedUserId}&is_active=eq.true${roleFilter}&select=id,user_id,fcm_token,role,platform`;
```

✅ **El filtro es correcto:** `is_active=eq.true`  
❌ **El problema:** Los dispositivos del partner están inactivos

### Causa Raíz
El código de registro de tokens en `src/services/partnerPushService.ts` (línea 55) establece `is_active: true` al registrar, pero:
- Los dispositivos pueden haberse desactivado manualmente
- Puede haber un proceso que desactiva dispositivos antiguos
- El partner necesita volver a registrar su dispositivo

### Impacto
- ❌ **El partner no recibe notificaciones** porque no tiene dispositivos activos
- ⚠️ Los logs muestran "No se encontraron dispositivos" aunque existen dispositivos registrados

---

## ⚠️ PROBLEMA #3: FILTROS CORRECTOS PERO DISPOSITIVOS INACTIVOS (MENOR)

### Descripción
Los filtros en la Edge Function son correctos, pero los dispositivos están inactivos.

### Verificación

**Query de Auditoría #1:**
- ✅ Todos los dispositivos tienen `fcm_token` válido
- ✅ Todos los dispositivos tienen `user_id` válido (UUID)
- ✅ Todos los dispositivos tienen `role` válido ('client' o 'partner')
- ❌ Algunos dispositivos tienen `is_active = false`

**Query de Auditoría #4:**
- ✅ Las notificaciones tienen `user_id` válido
- ✅ Hay dispositivos activos para clientes (4 dispositivos para `ef2e21d7-999f-4301-8b05-00b9605f36c0`)
- ❌ No hay dispositivos activos para el partner (`3a3e0599-296c-4cb2-8658-e3a095de75d1`)

### Conclusión
Los filtros funcionan correctamente, pero el problema es que los dispositivos están inactivos.

---

## 📋 ANÁLISIS DETALLADO DEL FLUJO

### Flujo Actual (Con Problemas)

1. **SQL Trigger:** `trigger_handle_appointment_confirmation` → `handle_appointment_confirmation()`
2. **SQL Function:** `handle_appointment_confirmation()` crea `client_notification` con:
   ```sql
   meta: jsonb_build_object(
     'type', 'confirmation',
     'business_id', _business_id,
     'business_name', _business_name,
     'appointment_date', _appointment_date::text,
     'appointment_time', _appointment_time::text,
     'consolidated', true  -- ❌ BOOLEAN
   )
   ```
3. **SQL Trigger:** `trigger_send_push_on_client_notification` → `send_push_on_client_notification()`
4. **SQL Function:** `send_push_on_client_notification()` construye `v_data`:
   ```sql
   v_data := jsonb_build_object(
     'type', COALESCE(NEW.type, 'appointment'),
     'notification_id', NEW.id::text
   );
   
   IF NEW.meta IS NOT NULL AND jsonb_typeof(NEW.meta) = 'object' THEN
     v_data := v_data || NEW.meta;  -- ❌ PROBLEMA: Mezcla valores booleanos
   END IF;
   ```
5. **SQL Function:** `call_send_push_notification()` envía:
   ```sql
   v_request_body := jsonb_build_object(
     'user_id', p_user_id::text,
     'title', p_title,
     'body', p_body,
     'role', v_normalized_role,
     'data', COALESCE(p_data, '{}'::jsonb),  -- ❌ Contiene valores booleanos
     'notification_id', CASE WHEN p_notification_id IS NOT NULL THEN p_notification_id::text ELSE NULL END
   );
   ```
6. **Edge Function:** `send-push-notification/index.ts` recibe el payload y envía:
   ```typescript
   data: record.data || {},  // ❌ Contiene { consolidated: true } (boolean)
   ```
7. **Firebase:** Rechaza el payload con error:
   ```
   messaging/invalid-payload: data must only contain string values
   ```

---

## 🔧 SOLUCIONES PROPUESTAS

### Solución #1: Convertir Valores NO-STRING a STRING en SQL

**Archivo:** `supabase/migrations/XXXXXX_fix_push_notification_data_types.sql`

**Modificar:** `send_push_on_client_notification()`

```sql
-- ✅ CONVERTIR TODOS LOS VALORES A STRING
IF NEW.meta IS NOT NULL AND jsonb_typeof(NEW.meta) = 'object' THEN
  -- Convertir cada valor del meta a string
  FOR key, value IN SELECT * FROM jsonb_each(NEW.meta) LOOP
    v_data := v_data || jsonb_build_object(
      key,
      CASE 
        WHEN jsonb_typeof(value) = 'boolean' THEN value::text
        WHEN jsonb_typeof(value) = 'number' THEN value::text
        WHEN jsonb_typeof(value) = 'null' THEN 'null'
        WHEN jsonb_typeof(value) = 'object' THEN value::text  -- JSON stringificado
        WHEN jsonb_typeof(value) = 'array' THEN value::text  -- JSON stringificado
        ELSE value::text  -- Ya es string
      END
    );
  END LOOP;
END IF;
```

**Alternativa más simple:**
```sql
-- ✅ CONVERTIR TODO EL META A STRING DE UNA VEZ
IF NEW.meta IS NOT NULL AND jsonb_typeof(NEW.meta) = 'object' THEN
  -- Convertir cada valor a string usando jsonb_each_text
  SELECT jsonb_object_agg(key, value::text)
  INTO v_meta_stringified
  FROM jsonb_each_text(NEW.meta);
  
  v_data := v_data || v_meta_stringified;
END IF;
```

### Solución #2: Convertir Valores NO-STRING a STRING en Edge Function

**Archivo:** `supabase/functions/send-push-notification/index.ts`  
**Línea:** 378

**Modificar:**
```typescript
// ✅ CONVERTIR TODOS LOS VALORES A STRING
const sanitizeData = (data: Record<string, any>): Record<string, string> => {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      sanitized[key] = '';
    } else if (typeof value === 'boolean') {
      sanitized[key] = value ? 'true' : 'false';
    } else if (typeof value === 'number') {
      sanitized[key] = value.toString();
    } else if (typeof value === 'object') {
      sanitized[key] = JSON.stringify(value);
    } else {
      sanitized[key] = String(value);
    }
  }
  return sanitized;
};

// En el código de envío:
data: sanitizeData(record.data || {}),
```

### Solución #3: Activar Dispositivos del Partner

**Opción A: Activar manualmente en SQL**
```sql
UPDATE client_devices
SET is_active = true,
    updated_at = NOW()
WHERE user_id = '3a3e0599-296c-4cb2-8658-e3a095de75d1'
  AND role = 'partner'
  AND fcm_token IS NOT NULL;
```

**Opción B: Corregir el código de registro**
- Verificar que `partnerPushService.ts` siempre establezca `is_active: true`
- Asegurar que el upsert no desactive dispositivos existentes

---

## 📊 PRIORIZACIÓN DE FIXES

### 🔴 CRÍTICO (Aplicar Inmediatamente)
1. **Solución #1 o #2:** Convertir valores NO-STRING a STRING
   - **Impacto:** Resuelve el 100% de los errores de Firebase
   - **Esfuerzo:** Bajo (1 función SQL o 1 función TypeScript)
   - **Recomendación:** Aplicar **Solución #2** (Edge Function) porque es más robusta y centralizada

### 🟡 IMPORTANTE (Aplicar Pronto)
2. **Solución #3:** Activar dispositivos del partner
   - **Impacto:** Permite que el partner reciba notificaciones
   - **Esfuerzo:** Muy bajo (1 query SQL o corrección en código)
   - **Recomendación:** Activar manualmente primero, luego corregir código

---

## ✅ VERIFICACIÓN POST-FIX

### Queries de Verificación

**1. Verificar que `data` solo contiene strings:**
```sql
-- Simular el payload que se enviaría a Firebase
SELECT 
  cn.id,
  cn.meta,
  -- Convertir meta a strings
  jsonb_object_agg(key, value::text) as data_sanitized
FROM client_notifications cn,
     jsonb_each(cn.meta) as meta_entry
WHERE cn.created_at >= NOW() - INTERVAL '1 hour'
GROUP BY cn.id, cn.meta;
```

**2. Verificar dispositivos activos del partner:**
```sql
SELECT 
  cd.user_id,
  cd.role,
  COUNT(*) as dispositivos_activos
FROM client_devices cd
WHERE cd.is_active = true
  AND cd.role = 'partner'
GROUP BY cd.user_id, cd.role;
```

**3. Probar notificación de prueba:**
```sql
-- Insertar notificación de prueba
INSERT INTO client_notifications (
  user_id,
  title,
  message,
  type,
  role,
  meta
) VALUES (
  'ef2e21d7-999f-4301-8b05-00b9605f36c0',  -- Cliente con dispositivos activos
  'Prueba',
  'Mensaje de prueba',
  'test',
  'client',
  jsonb_build_object(
    'type', 'test',
    'consolidated', true,  -- Boolean que debe convertirse a string
    'appointment_id', '123e4567-e89b-12d3-a456-426614174000'
  )
);
```

---

## 📝 CONCLUSIÓN

### Problemas Identificados
1. ✅ **PROBLEMA #1:** Valores booleanos en `data` → Firebase rechaza payload
2. ✅ **PROBLEMA #2:** Dispositivos del partner inactivos → No se encuentran dispositivos
3. ✅ **PROBLEMA #3:** Filtros correctos pero dispositivos inactivos → Confirmado

### Soluciones Propuestas
1. ✅ **Solución #2 (Recomendada):** Sanitizar `data` en Edge Function (convertir todos los valores a string)
2. ✅ **Solución #3:** Activar dispositivos del partner manualmente o corregir código de registro

### Próximos Pasos
1. Aplicar **Solución #2** en `send-push-notification/index.ts`
2. Activar dispositivos del partner manualmente
3. Ejecutar queries de verificación
4. Probar notificación de prueba
5. Monitorear logs de Edge Function

---

**FIN DE LA AUDITORÍA**

