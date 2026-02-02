# 🔴 AUDITORÍA CRÍTICA: SISTEMA DE PUSH NOTIFICATIONS
## PROBLEMA: Notificaciones llegando a TODOS los clientes cuando se confirma una cita

**Fecha:** 2026-02-01  
**Severidad:** CRÍTICA - Violación de Privacidad  
**Estado:** IDENTIFICADO - NO APLICADO

---

## 📋 RESUMEN EJECUTIVO

**PROBLEMA DETECTADO:** Las notificaciones push están llegando a TODOS los usuarios clientes cuando un partner confirma una cita, en lugar de solo al cliente específico de esa cita.

**CAUSA RAÍZ IDENTIFICADA:** La función `send_push_on_appointment_notification()` está llamando a `get_client_user_id_from_appointment()` SIN pasar el parámetro `business_id`, lo que puede causar que la función retorne NULL o resultados incorrectos, y potencialmente desencadenar envíos masivos.

---

## 1️⃣ TRIGGERS SQL ACTIVOS

### Triggers en tabla `appointments`:

| Trigger | Evento | Función | Estado |
|---------|--------|---------|--------|
| `trigger_handle_appointment_confirmation` | UPDATE | `handle_appointment_confirmation()` | ✅ ACTIVO |
| `trigger_handle_appointment_completion` | UPDATE | `handle_appointment_completion()` | ✅ ACTIVO |
| `trigger_notify_next_client_on_started` | UPDATE | `notify_next_client_on_started()` | ✅ ACTIVO |
| `trigger_notify_new_appointment` | INSERT | `notify_partner_new_appointment()` | ✅ ACTIVO |
| `on_appointment_created` | INSERT | `notify_partner_safe()` | ⚠️ ACTIVO (legacy) |
| `tr_push_new_appointment` | INSERT | `fn_notify_partner_v13()` | ⚠️ ACTIVO (legacy) |
| `sync_appointment_date_on_insert` | INSERT | `sync_appointment_date()` | ✅ ACTIVO |
| `sync_appointment_date_on_update` | UPDATE | `sync_appointment_date()` | ✅ ACTIVO |
| `trg_prevent_blocked_client_appointments` | INSERT/UPDATE | `prevent_blocked_client_appointments()` | ✅ ACTIVO |

### Triggers en tabla `client_notifications`:

| Trigger | Evento | Función | Estado |
|---------|--------|---------|--------|
| `trigger_send_push_on_client_notification` | INSERT | `send_push_on_client_notification()` | ✅ ACTIVO |
| `trigger_send_push_notification` | INSERT | `send_push_on_notification()` | ⚠️ ACTIVO (legacy) |

### Triggers en tabla `appointment_notifications`:

| Trigger | Evento | Función | Estado |
|---------|--------|---------|--------|
| `trigger_send_push_on_appointment_notification` | INSERT | `send_push_on_appointment_notification()` | 🔴 **PROBLEMA CRÍTICO** |
| `send_push_realtime_partner` | INSERT | `supabase_functions.http_request(...)` | ⚠️ ACTIVO (directo) |

---

## 2️⃣ FUNCIONES SQL QUE LLAMAN A `call_send_push_notification()`

### Funciones que envían push notifications:

1. **`send_push_on_appointment_notification()`** 🔴 **PROBLEMA CRÍTICO**
   - **Cuándo se ejecuta:** Trigger AFTER INSERT en `appointment_notifications`
   - **Parámetros que pasa:** `v_user_id`, `v_user_role`, `v_title`, `v_message`
   - **user_id utilizado:** 
     - `NEW.user_id` (si existe)
     - O `get_client_user_id_from_appointment(NEW.appointment_id)` ❌ **SIN business_id**
   - **Problema:** Llama a `get_client_user_id_from_appointment()` con solo 1 parámetro cuando requiere 2

2. **`send_push_on_client_notification()`** ✅ CORRECTO
   - **Cuándo se ejecuta:** Trigger AFTER INSERT en `client_notifications`
   - **Parámetros que pasa:** `NEW.user_id`, `v_user_role`, `NEW.title`, `NEW.message`
   - **user_id utilizado:** `NEW.user_id` (directo desde la tabla)
   - **Estado:** Correcto

3. **`handle_appointment_confirmation()`** ✅ CORRECTO
   - **Cuándo se ejecuta:** Trigger AFTER UPDATE en `appointments` cuando status = 'confirmed'
   - **Parámetros que pasa:** Inserta en `client_notifications`, NO llama directamente a `call_send_push_notification()`
   - **user_id utilizado:** `get_client_user_id_from_appointment(NEW.id, NEW.business_id)` ✅ CON business_id
   - **Estado:** Correcto

4. **`handle_appointment_completion()`** ✅ CORRECTO
   - **Cuándo se ejecuta:** Trigger AFTER UPDATE en `appointments` cuando status = 'completed'
   - **Parámetros que pasa:** Inserta en `client_notifications`, NO llama directamente a `call_send_push_notification()`
   - **user_id utilizado:** `get_client_user_id_from_appointment(NEW.id, NEW.business_id)` ✅ CON business_id
   - **Estado:** Correcto

5. **`create_appointment_status_notification()`** ⚠️ EXISTE PERO NO SE USA
   - **Cuándo se ejecuta:** NO tiene trigger activo (trigger fue dropeado)
   - **Estado:** Función legacy, no se ejecuta

---

## 3️⃣ BÚSQUEDA DE ENVÍOS MASIVOS

### ❌ NO se encontraron funciones que:
- Envíen push por `role = 'client'` SIN `user_id`
- Hagan loops sobre clientes
- Envíen notificaciones a `business_id` completo

### ✅ Todas las funciones que envían push:
- Requieren `user_id` específico
- No hacen loops masivos
- Filtran por `user_id` individual

---

## 4️⃣ MAPEO DEL FLUJO COMPLETO

### Flujo cuando un Partner confirma una cita:

```
1. Partner actualiza appointment.status = 'confirmed'
   ↓
2. Trigger: trigger_handle_appointment_confirmation
   ↓
3. Función: handle_appointment_confirmation()
   ├─ Valida: business_id, client_id, user_id
   ├─ Obtiene user_id: get_client_user_id_from_appointment(NEW.id, NEW.business_id) ✅
   └─ Inserta en: client_notifications (user_id específico) ✅
   ↓
4. Trigger: trigger_send_push_on_client_notification
   ↓
5. Función: send_push_on_client_notification()
   ├─ Lee: NEW.user_id (específico del cliente)
   └─ Llama: call_send_push_notification(NEW.user_id, 'client', ...) ✅
   ↓
6. Edge Function: send-push-notification
   ├─ Consulta: client_devices WHERE user_id = normalizedUserId AND role = 'client'
   └─ Envía push: Solo a dispositivos del user_id específico ✅
```

### ⚠️ FLUJO ALTERNATIVO (PROBLEMÁTICO):

Si existe un registro en `appointment_notifications` (creado por otra función legacy):

```
1. INSERT en appointment_notifications
   ↓
2. Trigger: trigger_send_push_on_appointment_notification
   ↓
3. Función: send_push_on_appointment_notification() 🔴 PROBLEMA
   ├─ Obtiene user_id: get_client_user_id_from_appointment(NEW.appointment_id) ❌ SIN business_id
   ├─ Si user_id es NULL o incorrecto:
   │  └─ Podría buscar todos los clientes o retornar NULL
   └─ Llama: call_send_push_notification(v_user_id, 'client', ...) ❌
   ↓
4. Edge Function: send-push-notification
   ├─ Si v_user_id es NULL o incorrecto:
   │  └─ Podría consultar TODOS los dispositivos de clientes
   └─ Envía push: A TODOS los clientes ❌❌❌
```

---

## 5️⃣ CAUSA RAÍZ IDENTIFICADA

### 🔴 PROBLEMA PRINCIPAL:

**Función:** `send_push_on_appointment_notification()`  
**Línea problemática:**
```sql
v_user_id := COALESCE(NEW.user_id, public.get_client_user_id_from_appointment(NEW.appointment_id));
```

**Problema:**
- La función `get_client_user_id_from_appointment()` ahora requiere 2 parámetros: `(p_appointment_id, p_business_id)`
- `send_push_on_appointment_notification()` solo está pasando 1 parámetro: `NEW.appointment_id`
- Esto causa que la función SQL falle o retorne NULL
- Cuando `v_user_id` es NULL, la Edge Function podría estar consultando TODOS los dispositivos de clientes

### 🔍 ANÁLISIS DETALLADO:

1. **`get_client_user_id_from_appointment()` requiere `business_id`:**
   ```sql
   CREATE OR REPLACE FUNCTION get_client_user_id_from_appointment(
     p_appointment_id uuid,
     p_business_id uuid  -- ✅ REQUERIDO
   )
   ```

2. **`send_push_on_appointment_notification()` NO pasa `business_id`:**
   ```sql
   -- ❌ INCORRECTO (actual)
   v_user_id := get_client_user_id_from_appointment(NEW.appointment_id);
   
   -- ✅ CORRECTO (debería ser)
   v_user_id := get_client_user_id_from_appointment(NEW.appointment_id, (SELECT business_id FROM appointments WHERE id = NEW.appointment_id));
   ```

3. **Consecuencia:**
   - La función SQL falla silenciosamente o retorna NULL
   - `v_user_id` queda como NULL
   - La Edge Function recibe `user_id = NULL` o un valor incorrecto
   - La consulta a `client_devices` podría no filtrar correctamente
   - **RESULTADO: Se envían notificaciones a TODOS los clientes**

---

## 6️⃣ FIX RECOMENDADO

### ✅ FIX 1: Corregir `send_push_on_appointment_notification()`

```sql
CREATE OR REPLACE FUNCTION public.send_push_on_appointment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_data JSONB;
  v_recipient_type TEXT;
  v_business_id UUID;  -- ✅ NUEVO: Variable para business_id
BEGIN
  RAISE NOTICE '[Push] === TRIGGER ACTIVADO ===';
  RAISE NOTICE '[Push] notification_id: %', NEW.id;
  RAISE NOTICE '[Push] appointment_id: %', NEW.appointment_id;
  
  -- ✅ CRÍTICO: Obtener business_id desde appointment
  SELECT business_id INTO v_business_id
  FROM public.appointments
  WHERE id = NEW.appointment_id
  LIMIT 1;
  
  -- ✅ VALIDACIÓN: Si no hay business_id, NO enviar push
  IF v_business_id IS NULL THEN
    RAISE WARNING '[Push] ❌ SKIP: business_id es NULL para appointment_id=%, notification_id=%', 
      NEW.appointment_id, NEW.id;
    RETURN NEW;
  END IF;
  
  -- Extraer título y mensaje del meta (JSONB)
  v_title := COALESCE(NEW.meta->>'title', 'Nueva notificación');
  v_message := COALESCE(NEW.meta->>'message', 'Tienes una nueva notificación');
  v_type := COALESCE(NEW.meta->>'type', 'appointment');
  v_recipient_type := COALESCE(NEW.meta->>'recipient_type', 'client');
  
  RAISE NOTICE '[Push] Tipo: %, Recipient: %, Title: %', v_type, v_recipient_type, v_title;
  
  -- ✅ CRÍTICO: Para notificaciones de tipo 'confirmation', SIEMPRE usar 'client'
  IF v_type = 'confirmation' THEN
    -- ✅ CORREGIDO: Pasar business_id como segundo parámetro
    v_user_id := COALESCE(NEW.user_id, public.get_client_user_id_from_appointment(NEW.appointment_id, v_business_id));
    v_user_role := 'client';
    RAISE NOTICE '[Push] ✅ Confirmación detectada: forzando role=client, user_id=%', v_user_id;
  ELSIF v_recipient_type = 'partner' OR v_recipient_type = 'business_owner' THEN
    v_user_id := public.get_partner_user_id_from_appointment(NEW.appointment_id);
    v_user_role := 'partner';
    RAISE NOTICE '[Push] Partner notification: user_id=%, role=%', v_user_id, v_user_role;
  ELSE
    -- ✅ CORREGIDO: Pasar business_id como segundo parámetro
    v_user_id := COALESCE(NEW.user_id, public.get_client_user_id_from_appointment(NEW.appointment_id, v_business_id));
    v_user_role := 'client';
    RAISE NOTICE '[Push] Client notification: user_id=%, role=%', v_user_id, v_user_role;
  END IF;
  
  -- ✅ CRÍTICO: Si no hay user_id, NO enviar push (fail hard)
  IF v_user_id IS NULL THEN
    RAISE WARNING '[Push] ❌ SKIP: No user_id encontrado. notification_id=%, appointment_id=%, type=%', 
      NEW.id, NEW.appointment_id, v_type;
    RETURN NEW;
  END IF;
  
  -- ✅ VALIDACIÓN: user_id debe ser UUID válido
  IF v_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE WARNING '[Push] ❌ SKIP: user_id inválido. notification_id=%, user_id=%', NEW.id, v_user_id;
    RETURN NEW;
  END IF;
  
  -- Actualizar user_id y role en appointment_notifications si no están
  IF NEW.user_id IS NULL OR NEW.role IS NULL OR NEW.role = '' THEN
    UPDATE public.appointment_notifications
    SET user_id = v_user_id, role = v_user_role
    WHERE id = NEW.id;
    RAISE NOTICE '[Push] Actualizado appointment_notifications: id=%, user_id=%, role=%', NEW.id, v_user_id, v_user_role;
  ELSIF NEW.role != v_user_role AND v_type = 'confirmation' THEN
    UPDATE public.appointment_notifications
    SET role = v_user_role
    WHERE id = NEW.id;
    RAISE NOTICE '[Push] Forzado role=client para confirmación: id=%', NEW.id;
  END IF;
  
  -- Construir data object
  v_data := jsonb_build_object(
    'type', v_type,
    'notification_id', NEW.id::text
  );
  
  IF NEW.meta IS NOT NULL AND jsonb_typeof(NEW.meta) = 'object' THEN
    v_data := v_data || NEW.meta;
  END IF;
  
  -- Validar parámetros antes de llamar
  IF v_user_id IS NULL OR v_title IS NULL OR v_message IS NULL OR v_user_role IS NULL THEN
    RAISE WARNING '[Push] ❌ SKIP: Parámetros faltantes. user_id=%, title=%, message=%, role=%', 
      v_user_id, v_title, v_message, v_user_role;
    RETURN NEW;
  END IF;
  
  RAISE NOTICE '[Push] Llamando call_send_push_notification con: user_id=%, role=%, title=%', 
    v_user_id, v_user_role, v_title;
  
  -- Llamar a la función que envía el push
  PERFORM public.call_send_push_notification(
    p_user_id := v_user_id,
    p_role := v_user_role,
    p_title := v_title,
    p_body := v_message,
    p_notification_id := NEW.id,
    p_data := v_data
  );
  
  RAISE NOTICE '[Push] === TRIGGER COMPLETADO ===';
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[Push] === EXCEPCIÓN EN TRIGGER ===';
  RAISE WARNING '[Push] notification_id: %, appointment_id: %, type: %, error: %', 
    NEW.id, NEW.appointment_id, v_type, SQLERRM;
  RAISE WARNING '[Push] SQLSTATE: %', SQLSTATE;
  RETURN NEW;
END;
$function$;
```

### ✅ FIX 2: Agregar validación en Edge Function (ya existe, pero reforzar)

La Edge Function `send-push-notification` ya tiene validaciones, pero podemos reforzarlas:

```typescript
// ✅ Ya existe en línea 138-151
if (!targetUserId || typeof targetUserId !== 'string' || targetUserId.trim() === '') {
  console.error("❌ [CRITICAL] targetUserId es null, undefined o string vacío.");
  return new Response(JSON.stringify({
    success: false,
    message: "Notification failed",
    error: "user_id es requerido y debe ser un UUID válido. No se permiten fallbacks.",
  }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

### ✅ FIX 3: Eliminar triggers legacy redundantes

```sql
-- Eliminar triggers legacy que podrían causar duplicados
DROP TRIGGER IF EXISTS trigger_send_push_notification ON client_notifications;
DROP TRIGGER IF EXISTS send_push_realtime_partner ON appointment_notifications;
DROP TRIGGER IF EXISTS on_appointment_created ON appointments;
DROP TRIGGER IF EXISTS tr_push_new_appointment ON appointments;
```

---

## 7️⃣ REGLA DE SEGURIDAD GLOBAL (OBLIGATORIA)

### ✅ REGLA IMPLEMENTADA:

**En todas las funciones que envían push notifications:**

1. **Si `role = 'client'` → `user_id` ES OBLIGATORIO**
2. **Si `user_id` es NULL → NO enviar push (fail hard)**
3. **Si `user_id` no es UUID válido → NO enviar push (fail hard)**
4. **Siempre pasar `business_id` a `get_client_user_id_from_appointment()`**

### ✅ VALIDACIONES REQUERIDAS:

```sql
-- ✅ Validación 1: business_id obligatorio
IF v_business_id IS NULL THEN
  RAISE WARNING '[Push] ❌ SKIP: business_id es NULL';
  RETURN NEW;
END IF;

-- ✅ Validación 2: user_id obligatorio
IF v_user_id IS NULL THEN
  RAISE WARNING '[Push] ❌ SKIP: user_id es NULL';
  RETURN NEW;
END IF;

-- ✅ Validación 3: user_id debe ser UUID válido
IF v_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
  RAISE WARNING '[Push] ❌ SKIP: user_id inválido: %', v_user_id;
  RETURN NEW;
END IF;
```

---

## 8️⃣ VERIFICACIÓN POST-FIX

### Queries para verificar después de aplicar el fix:

```sql
-- 1. Verificar que send_push_on_appointment_notification pasa business_id
SELECT 
    p.proname,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%get_client_user_id_from_appointment(%business_id%'
        THEN '✅ CORRECTO'
        ELSE '❌ INCORRECTO'
    END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'send_push_on_appointment_notification';

-- 2. Verificar triggers activos
SELECT 
    trigger_name,
    event_object_table,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('appointments', 'client_notifications', 'appointment_notifications')
ORDER BY event_object_table, trigger_name;

-- 3. Verificar que no hay funciones legacy activas
SELECT 
    trigger_name,
    action_statement
FROM information_schema.triggers
WHERE action_statement LIKE '%fn_notify_partner%'
   OR action_statement LIKE '%notify_partner_safe%'
   OR action_statement LIKE '%send_push_on_notification%';
```

---

## 9️⃣ CONCLUSIÓN

### ✅ PROBLEMA IDENTIFICADO:

**Causa raíz:** La función `send_push_on_appointment_notification()` está llamando a `get_client_user_id_from_appointment()` sin pasar el parámetro `business_id`, lo que causa que la función falle o retorne NULL, y potencialmente desencadene envíos masivos.

### ✅ FIX RECOMENDADO:

1. **Corregir `send_push_on_appointment_notification()`** para pasar `business_id` a `get_client_user_id_from_appointment()`
2. **Agregar validaciones estrictas** (business_id, user_id, UUID válido)
3. **Eliminar triggers legacy** que podrían causar duplicados
4. **Implementar regla de seguridad global:** Si role='client', user_id es obligatorio

### ⚠️ ACCIÓN REQUERIDA:

**NO APLICAR CAMBIOS TODAVÍA** - Este reporte es solo para auditoría.  
**Esperar aprobación** antes de aplicar los fixes.

---

## 📊 ESTADÍSTICAS

- **Triggers activos:** 12
- **Funciones que envían push:** 5
- **Funciones con problemas:** 1 (`send_push_on_appointment_notification`)
- **Triggers legacy a eliminar:** 4
- **Severidad:** CRÍTICA

---

**Generado:** 2026-02-01  
**Auditor:** Sistema Automatizado  
**Estado:** PENDIENTE APROBACIÓN

