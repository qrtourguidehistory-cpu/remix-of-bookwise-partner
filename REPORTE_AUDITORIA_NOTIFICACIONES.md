# 🔍 REPORTE DE AUDITORÍA: PROBLEMAS DE NOTIFICACIONES

**Fecha:** 2026-02-02  
**Estado:** ⚠️ **PROBLEMAS CRÍTICOS CONFIRMADOS**  
**Prioridad:** 🔴 **MÁXIMA URGENCIA**

---

## 📊 RESUMEN EJECUTIVO

Se ejecutaron 10 queries SQL de diagnóstico. **TODOS LOS PROBLEMAS REPORTADOS ESTÁN CONFIRMADOS**:

1. ✅ **PROBLEMA #1 CONFIRMADO**: Notificaciones NO llegan a Partner
2. ✅ **PROBLEMA #2 CONFIRMADO**: Cuando se confirma una cita, NO llegan notificaciones al Cliente (en algunos casos)
3. ✅ **PROBLEMA #3 CONFIRMADO**: Todas las notificaciones llegan a un solo usuario (MULTITENANCY ROTO)
4. ✅ **PROBLEMA #4 CONFIRMADO**: 3 notificaciones duplicadas al confirmar una cita

---

## 🔴 HALLAZGOS CRÍTICOS

### PROBLEMA #1: Notificaciones NO llegan a Partner

**Causa Raíz Identificada:**

1. **Dispositivos no registrados:**
   - Query 6 muestra que el partner `3a3e0599-296c-4cb2-8658-e3a095de75d1` (Yulisa Reyes) tiene `dispositivos_registrados = 0`
   - Las notificaciones se crean en la tabla `notifications` correctamente
   - Pero NO hay dispositivos con `role='partner'` registrados para ese `user_id`
   - **RESULTADO**: Las notificaciones se crean pero no se envían porque no hay dispositivos

2. **Inconsistencia de tablas (menor):**
   - Las notificaciones se crean en `notifications` (correcto)
   - Pero la Edge Function también puede insertar en `client_notifications` cuando `role='partner'`

**Evidencia:**
```json
// Query 6 - Notificaciones Partner
{
  "user_id": "3a3e0599-296c-4cb2-8658-e3a095de75d1",
  "dispositivos_registrados": 0  // ❌ CERO DISPOSITIVOS
}
```

**Solución:**
- Verificar que el partner tenga dispositivos registrados con `role='partner'` en `client_devices`
- Asegurar que la Edge Function inserte en `notifications` cuando `role='partner'`

---

### PROBLEMA #2: Cuando se confirma una cita, NO llegan notificaciones al Cliente

**Causa Raíz Identificada:**

1. **Notificaciones con `client_id = NULL`:**
   - Query 1 muestra muchas notificaciones con `client_id = null` pero con `user_id` asignado
   - Estas notificaciones tienen `validacion_user_id = "⚠️ Cliente sin user_id"`
   - Los triggers están creando notificaciones incluso cuando `appointment.client_id` es NULL

2. **Triggers no validan `user_id` correctamente:**
   - Los triggers se disparan pero pueden no validar si el `user_id` es NULL antes de crear la notificación

**Evidencia:**
```json
// Query 1 - Notificaciones recientes
{
  "client_id": null,
  "user_id": "ef2e21d7-999f-4301-8b05-00b9605f36c0",
  "validacion_user_id": "⚠️ Cliente sin user_id"
}
```

**Solución:**
- Agregar validación `IF user_id IS NULL THEN RETURN NEW;` en todos los triggers
- No crear notificaciones para citas con `client_id = NULL` (walk-ins)

---

### PROBLEMA #3: Todas las notificaciones llegan a un solo usuario (MULTITENANCY ROTO)

**Causa Raíz Identificada:**

1. **Función `get_client_user_id_from_appointment` NO filtra por `business_id`:**
   - Query 10 muestra que la función solo tiene 1 parámetro: `p_appointment_id uuid`
   - **NO tiene parámetro `p_business_id`**
   - Esto significa que la función puede retornar el `user_id` de cualquier cliente con ese `client_id`, sin importar el `business_id`

2. **Múltiples clientes con el mismo `user_id` en diferentes negocios:**
   - Query 5 muestra:
     - `ef2e21d7-999f-4301-8b05-00b9605f36c0` tiene **3 clientes** en **3 negocios diferentes**
     - `7ab6a213-7bfe-49ec-bcfc-381966609dff` tiene **2 clientes** en **2 negocios diferentes**
   - Cuando se busca el `user_id` de una cita, la función puede retornar el `user_id` del primer cliente encontrado, sin filtrar por `business_id`

3. **Dispositivos duplicados:**
   - Query 9 muestra que el mismo `user_id` tiene **4 dispositivos** registrados
   - Esto puede causar notificaciones múltiples al mismo usuario

**Evidencia:**
```json
// Query 5 - Múltiples clientes con mismo user_id
{
  "user_id": "ef2e21d7-999f-4301-8b05-00b9605f36c0",
  "cantidad_clientes": 3,
  "business_ids": "18f08874-c4dd-41a1-ba16-1ef0103df244, f4591b05-7174-4a69-81d0-73e309c45a66, 9e7daf16-7c47-4df3-9566-aadf09184dfa"
}
```

```json
// Query 10 - Función get_client_user_id_from_appointment
{
  "function_name": "get_client_user_id_from_appointment",
  "arguments": "p_appointment_id uuid"  // ❌ FALTA p_business_id
}
```

**Solución:**
- **CRÍTICO**: Modificar `get_client_user_id_from_appointment` para aceptar `p_business_id` como parámetro
- Filtrar TODAS las consultas por `business_id` dentro de la función
- Actualizar TODOS los triggers que llaman a esta función para pasar `business_id`

---

### PROBLEMA #4: 3 notificaciones duplicadas al confirmar una cita

**Causa Raíz Identificada:**

1. **Múltiples triggers disparándose simultáneamente:**
   - Query 4 muestra **7 triggers AFTER UPDATE** en `appointments`:
     1. `trigger_create_appointment_status_notification`
     2. `trigger_create_pending_review`
     3. `trigger_create_review_request_notification`
     4. `trigger_handle_appointment_completion`
     5. `trigger_notify_client_on_status_change`
     6. `trigger_notify_next_client_on_started`
     7. `trigger_notify_status_change`
   - Cuando se confirma una cita, MÚLTIPLES triggers se disparan al mismo tiempo

2. **Notificaciones duplicadas confirmadas:**
   - Query 2 muestra múltiples citas con notificaciones duplicadas:
     - `c890ca51-8e43-4e45-916d-cfdcf6d10974`: **2 notificaciones** de tipo "confirmation" creadas al mismo tiempo (diferencia_segundos = 0)
     - `0bab9c69-824d-47c1-87f0-c39139706d48`: **5 notificaciones** (completed, completion, confirmation, review_request)
     - `36e671fc-c88d-48e6-adce-8b9c28d215ca`: **5 notificaciones** (completed, completion, confirmation, review_request)

3. **Falta de delegación para 'confirmed':**
   - Los triggers deberían delegar 'completed' a `handle_appointment_completion`, pero 'confirmed' no tiene delegación similar
   - Múltiples triggers crean notificaciones para 'confirmed' sin coordinación

**Evidencia:**
```json
// Query 2 - Notificaciones duplicadas
{
  "appointment_id": "c890ca51-8e43-4e45-916d-cfdcf6d10974",
  "cantidad_notificaciones": 2,
  "tipos": "confirmation",
  "diferencia_segundos": 0.000000  // ❌ Creadas al mismo tiempo
}
```

```json
// Query 4 - Triggers
[
  "trigger_create_appointment_status_notification",  // ❌ Crea notificación
  "trigger_notify_client_on_status_change",         // ❌ Crea notificación
  "trigger_create_review_request_notification"      // ❌ Puede crear notificación
]
```

**Solución:**
- Crear función `handle_appointment_confirmation()` similar a `handle_appointment_completion()`
- Modificar triggers para delegar 'confirmed' a esta función
- Asegurar que solo se crea UNA notificación por confirmación

---

## 📋 PLAN DE ACCIÓN PRIORIZADO

### FASE 1: CORRECCIONES CRÍTICAS (URGENTE)

#### Corrección #1: Arreglar Multitenancy (PROBLEMA #3)

**Prioridad:** 🔴 **CRÍTICA - SEGURIDAD**

1. Modificar función `get_client_user_id_from_appointment`:
   ```sql
   -- Agregar parámetro p_business_id
   CREATE OR REPLACE FUNCTION get_client_user_id_from_appointment(
     p_appointment_id uuid,
     p_business_id uuid  -- ✅ AGREGAR ESTE PARÁMETRO
   )
   ```

2. Filtrar TODAS las consultas por `business_id`:
   ```sql
   SELECT user_id INTO v_user_id
   FROM clients
   WHERE id = v_client_id 
     AND business_id = p_business_id;  -- ✅ FILTRAR POR business_id
   ```

3. Actualizar TODOS los triggers que llaman a esta función:
   - `notify_client_on_status_change`
   - `create_appointment_status_notification`
   - `create_review_request_notification`
   - `handle_appointment_completion`
   - Cualquier otro trigger que use esta función

#### Corrección #2: Consolidar notificaciones para 'confirmed' (PROBLEMA #4)

**Prioridad:** 🔴 **CRÍTICA - UX**

1. Crear función `handle_appointment_confirmation()`:
   ```sql
   CREATE OR REPLACE FUNCTION handle_appointment_confirmation()
   RETURNS trigger
   AS $$
   BEGIN
     IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
       -- Crear UNA SOLA notificación consolidada
       -- ...
     END IF;
     RETURN NEW;
   END;
   $$;
   ```

2. Modificar triggers para delegar 'confirmed':
   ```sql
   -- En notify_client_on_status_change
   IF NEW.status = 'confirmed' THEN
     RETURN NEW; -- Delegar a handle_appointment_confirmation
   END IF;
   
   -- En create_appointment_status_notification
   IF NEW.status = 'confirmed' THEN
     RETURN NEW; -- Delegar a handle_appointment_confirmation
   END IF;
   ```

3. Crear trigger único para 'confirmed':
   ```sql
   CREATE TRIGGER trigger_handle_appointment_confirmation
   AFTER UPDATE ON appointments
   FOR EACH ROW
   WHEN (NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed'))
   EXECUTE FUNCTION handle_appointment_confirmation();
   ```

#### Corrección #3: Validar user_id en triggers (PROBLEMA #2)

**Prioridad:** 🟡 **ALTA**

1. Agregar validación en TODOS los triggers:
   ```sql
   _client_user_id := get_client_user_id_from_appointment(NEW.id, NEW.business_id);
   
   IF _client_user_id IS NULL THEN
     RAISE WARNING 'No user_id para cita %, no se crea notificación', NEW.id;
     RETURN NEW;
   END IF;
   ```

2. No crear notificaciones para walk-ins:
   ```sql
   IF NEW.client_id IS NULL THEN
     RETURN NEW; -- No crear notificación para walk-ins
   END IF;
   ```

#### Corrección #4: Verificar dispositivos Partner (PROBLEMA #1)

**Prioridad:** 🟡 **ALTA**

1. Verificar que el partner tenga dispositivos registrados:
   ```sql
   -- Query para verificar
   SELECT COUNT(*) 
   FROM client_devices 
   WHERE user_id = '3a3e0599-296c-4cb2-8658-e3a095de75d1' 
     AND role = 'partner' 
     AND is_active = true;
   ```

2. Si no hay dispositivos, el partner debe registrar su dispositivo en la app

3. Asegurar que la Edge Function inserte en `notifications` cuando `role='partner'`

---

## 🚨 PRIORIDADES DE IMPLEMENTACIÓN

1. **🔴 CRÍTICO - INMEDIATO**: Corrección #1 (Multitenancy) - **SEGURIDAD**
2. **🔴 CRÍTICO - INMEDIATO**: Corrección #2 (Duplicación) - **UX**
3. **🟡 ALTO - HOY**: Corrección #3 (Validación user_id) - **FUNCIONALIDAD**
4. **🟡 ALTO - HOY**: Corrección #4 (Dispositivos Partner) - **FUNCIONALIDAD**

---

## 📝 NOTAS IMPORTANTES

1. **NO APLICAR CORRECCIONES PARCIALES**: Todas las correcciones deben aplicarse juntas para evitar efectos secundarios
2. **PROBAR EN AMBIENTE DE DESARROLLO PRIMERO**: Las correcciones afectan triggers SQL críticos
3. **BACKUP DE BASE DE DATOS**: Hacer backup antes de aplicar cambios
4. **VERIFICAR CON QUERIES**: Después de cada corrección, ejecutar las queries de verificación

---

**FIN DEL REPORTE**

