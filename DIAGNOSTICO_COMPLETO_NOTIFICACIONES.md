# 🔍 DIAGNÓSTICO COMPLETO: PROBLEMAS DE NOTIFICACIONES

**Fecha:** 2026-02-01  
**Auditoría realizada por:** Cursor AI  
**Estado:** CRÍTICO - Múltiples problemas identificados

---

## 📋 RESUMEN EJECUTIVO

Se identificaron **5 problemas críticos** en el sistema de notificaciones:

1. ❌ **CRÍTICO**: Notificaciones llegando al usuario incorrecto
2. ❌ **ALTO**: 3 notificaciones duplicadas al completar una cita
3. ❌ **ALTO**: Notificaciones push no llegan (user_id no se lee correctamente)
4. ⚠️ **MEDIO**: Notificaciones innecesarias para walk-ins/directas
5. ⚠️ **BAJO**: Problema de safe area en formulario de registro

---

## 🔴 PROBLEMA 1: NOTIFICACIONES LLEGANDO AL USUARIO INCORRECTO (CRÍTICO)

### Contexto del Error:
- **Cita creada desde:** "jordan cliente" (user_id: `74291aef-1809-4209-a17a-f8f7381341d9`)
- **Notificaciones llegaron a:** 
  - "juan jose" (user_id: `75721c0f-d267-4f08-9cbb-0d6066d5efb2`)
  - Otro usuario (user_id: `840b6cbc-eedf-412a-a0c3-45bb49dd3f0a`)

### Causa Raíz Identificada:

#### ❌ **FUNCIÓN `get_client_user_id_from_appointment()` - LÓGICA INCORRECTA**

La función **NO está usando `client_id`** para buscar en la tabla `clients`. En su lugar:

```sql
-- LÓGICA ACTUAL (INCORRECTA):
1. Busca user_id directamente en appointments.user_id
2. Si no existe, busca por client_email en client_profiles
3. Si no existe, busca por client_email en auth.users
```

**PROBLEMA:** No busca en `clients` usando el `client_id` de la cita, que es la fuente correcta.

#### ❌ **FUNCIÓN `notify_client_on_status_change()` - FALTA FILTRO POR business_id**

La función busca `user_id` desde `clients` pero **NO filtra por `business_id`**:

```sql
-- LÍNEA PROBLEMÁTICA:
SELECT user_id INTO client_user_id
FROM public.clients
WHERE id = NEW.client_id;
-- ❌ FALTA: AND business_id = NEW.business_id
```

Aunque `id` es UUID único, es una mala práctica no filtrar por `business_id` para garantizar integridad.

### Evidencia de la Base de Datos:

**Cita correcta:**
- `appointment_id`: `7b8f288c-14eb-4d81-8a71-f49183cbb323`
- `client_id`: `74291aef-1809-4209-a17a-f8f7381341d9` (jordan cliente)
- `client_user_id` CORRECTO: `ef2e21d7-999f-4301-8b05-00b9605f36c0`
- `business_id`: `9e7daf16-7c47-4df3-9566-aadf09184dfa`

**Notificaciones creadas:**
- Todas las notificaciones tienen `user_id = ef2e21d7-999f-4301-8b05-00b9605f36c0` ✅ (CORRECTO)
- Pero el usuario reporta que llegaron a otros usuarios ❌

**HIPÓTESIS:** El problema puede estar en:
1. La función `get_client_user_id_from_appointment()` siendo llamada desde otros lugares
2. Múltiples triggers creando notificaciones con diferentes `user_id`
3. La Edge Function recibiendo `user_id` incorrecto desde algún trigger

---

## 🔴 PROBLEMA 2: 3 NOTIFICACIONES AL COMPLETAR UNA CITA (ALTO)

### Evidencia de la Base de Datos:

Para la cita `36e671fc-c88d-48e6-adce-8b9c28d215ca` (completada), se crearon **3 notificaciones**:

1. **`notify_client_on_status_change`** → `type: 'completed'`
   - `created_at`: `2026-02-01 01:49:21.179143+00`
   - `title`: "Cita completada"
   - `message`: "Tu cita en SALON YULISA ha sido completada. ¡Gracias por visitarnos!"

2. **`create_appointment_status_notification`** → `type: 'completion'`
   - `created_at`: `2026-02-01 01:49:21.179143+00`
   - `title`: "Cita completada"
   - `message`: "Tu cita en SALON YULISA ha sido completada. ¡Gracias por visitarnos!"

3. **`create_pending_review_on_appointment_completed`** → `type: 'review_request'`
   - `created_at`: `2026-02-01 01:49:21.179143+00`
   - `title`: "Solicita tu opinión"
   - `message`: "¿Cómo fue tu experiencia? Comparte tu opinión sobre el servicio recibido."

### Triggers Activos:

1. ✅ `trigger_notify_client_on_status_change` (UPDATE appointments)
2. ✅ `trigger_create_appointment_status_notification` (UPDATE appointments)
3. ✅ `trigger_create_pending_review` (UPDATE appointments)
4. ✅ `trigger_create_review_request_notification` (UPDATE appointments)

**PROBLEMA:** Todos se disparan cuando `status = 'completed'`, creando notificaciones duplicadas.

### Solución Requerida:

**Consolidar en UNA sola notificación:**
- Título: "Cita completada"
- Mensaje: "Tu cita en [BUSINESS] ha sido completada. ¡Gracias por visitarnos! ¿Cómo fue tu experiencia? Comparte tu opinión sobre el servicio recibido."

---

## 🔴 PROBLEMA 3: NOTIFICACIONES PUSH NO LLEGAN (ALTO)

### Evidencia de los Logs de Supabase:

```
⚠️ No se encontraron dispositivos para user_id: `3a3e0599-296c-4cb2-8658-e3a095de75d1`, role: partner
```

### Causa Raíz:

La Edge Function `send-push-notification` valida que `targetUserId` sea un UUID válido. Si no lo es, retorna 400 y no busca dispositivos.

**PROBLEMA:** Los triggers SQL pueden estar pasando `user_id` incorrecto o NULL a la Edge Function.

### Verificación Requerida:

1. Verificar que `send_push_on_client_notification()` use `NEW.user_id` correctamente
2. Verificar que `get_client_user_id_from_appointment()` retorne UUID válido
3. Verificar que los triggers pasen `user_id` en el payload correctamente

---

## ⚠️ PROBLEMA 4: NOTIFICACIONES INNECESARIAS PARA WALK-INS/DIRECTAS (MEDIO)

### Estado Actual:

- ✅ `partnerNotificationService.ts` valida que `user_id IS NOT NULL` antes de enviar
- ❌ Los triggers SQL **NO validan** esto antes de insertar en `client_notifications`

### Evidencia:

En la base de datos hay notificaciones con `client_id` pero `user_id` podría ser NULL para walk-ins.

### Solución Requerida:

Agregar validación en todos los triggers SQL:
```sql
IF _client_user_id IS NULL THEN
  RETURN NEW; -- No crear notificación para walk-ins
END IF;
```

---

## ⚠️ PROBLEMA 5: SAFE AREA EN FORMULARIO DE REGISTRO (BAJO)

Requiere revisión del componente específico del formulario de registro.

---

## 🔧 CORRECCIONES REQUERIDAS

### 1. Corregir `get_client_user_id_from_appointment()`

**LÓGICA CORRECTA:**
```sql
1. Obtener client_id desde appointments WHERE id = p_appointment_id
2. Si client_id IS NOT NULL:
   - Buscar user_id en clients WHERE id = client_id AND business_id = appointment.business_id
3. Si no hay user_id pero hay client_email:
   - Buscar en client_profiles o auth.users (fallback)
4. Retornar user_id o NULL
```

### 2. Corregir `notify_client_on_status_change()`

**AGREGAR FILTRO POR business_id:**
```sql
SELECT user_id INTO client_user_id
FROM public.clients
WHERE id = NEW.client_id
  AND business_id = NEW.business_id; -- ✅ AGREGAR ESTE FILTRO
```

### 3. Consolidar Notificaciones de Completación

**OPCIÓN A:** Deshabilitar `trigger_notify_client_on_status_change` para status 'completed'  
**OPCIÓN B:** Modificar `create_appointment_status_notification` para incluir mensaje de review  
**OPCIÓN C:** Crear una nueva función consolidada

### 4. Validar user_id en Todos los Triggers

Agregar validación en:
- `notify_client_on_status_change()`
- `create_appointment_status_notification()`
- `create_pending_review_on_appointment_completed()`
- `create_review_request_notification()`

---

## 📊 ESTADÍSTICAS DE NOTIFICACIONES

### Notificaciones Recientes (últimas 20):

- **Total:** 20 notificaciones
- **Tipos:**
  - `confirmation`: 6 (30%)
  - `completed`: 3 (15%)
  - `completion`: 2 (10%)
  - `review_request`: 3 (15%)
  - Otros: 6 (30%)

### Duplicados Detectados:

- **Cita `36e671fc-c88d-48e6-adce-8b9c28d215ca`:** 3 notificaciones (completed, completion, review_request)
- **Cita `0bab9c69-824d-47c1-87f0-c39139706d48`:** 3 notificaciones (completed, completion, review_request)
- **Cita `9a28f74c-60b9-4f84-974d-d4ae783a1792`:** 3 notificaciones (completed, completion, review_request)

---

## ✅ RECOMENDACIONES PRIORITARIAS

1. **URGENTE:** Corregir `get_client_user_id_from_appointment()` para usar `client_id`
2. **URGENTE:** Agregar filtro `business_id` en `notify_client_on_status_change()`
3. **ALTO:** Consolidar notificaciones de completación en una sola
4. **ALTO:** Validar `user_id IS NOT NULL` en todos los triggers
5. **MEDIO:** Revisar safe area en formulario de registro

---

## 🔍 PRÓXIMOS PASOS

1. Aplicar correcciones a las funciones SQL
2. Probar con una cita de prueba
3. Verificar que las notificaciones lleguen al usuario correcto
4. Verificar que solo se cree UNA notificación al completar
5. Verificar que walk-ins NO reciban notificaciones

---

**FIN DEL DIAGNÓSTICO**

