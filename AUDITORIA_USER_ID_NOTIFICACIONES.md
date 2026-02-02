# 🔍 AUDITORÍA COMPLETA: USER_ID INCORRECTO EN NOTIFICACIONES

**Fecha:** 2026-02-02  
**Problema Reportado:** Todas las notificaciones de confirmación llegan al mismo usuario (jordanpremium15@gmail.com), incluso cuando la cita pertenece a clientes distintos.

---

## 📊 RESUMEN EJECUTIVO

### ✅ Hallazgos Principales

1. **Las notificaciones en la BD tienen el `user_id` CORRECTO** ✅
2. **La función `get_client_user_id_from_appointment()` devuelve el `user_id` CORRECTO** ✅
3. **El problema NO está en la creación de notificaciones** ✅
4. **El problema está en el ENVÍO de push notifications** ❌

### 🔴 Problema Identificado

**Las notificaciones se crean correctamente en la BD, pero el problema está en:**
- La Edge Function `send-push-notification` podría estar usando un `user_id` fijo
- O los dispositivos registrados están todos asociados al mismo `user_id`
- O hay un problema en cómo se pasa el `user_id` desde el trigger a la Edge Function

---

## 📋 AUDITORÍA DETALLADA

### ✅ Auditoría #1: Función `get_client_user_id_from_appointment()`

**Resultado:** ✅ **FUNCIÓN CORRECTA**

La función:
- ✅ Filtra correctamente por `business_id`
- ✅ Busca primero por `client_id` (PRIORIDAD 1)
- ✅ Luego por `client_email` (FALLBACK)
- ✅ Finalmente por `appointments.user_id` (ÚLTIMO RECURSO)

**Código Verificado:**
```sql
-- ✅ PASO 2: Si hay client_id, buscar user_id en clients (PRIORIDAD 1)
IF v_client_id IS NOT NULL THEN
  SELECT user_id INTO v_user_id
  FROM public.clients
  WHERE id = v_client_id
    AND business_id = p_business_id  -- ✅ FILTRA POR BUSINESS_ID
  LIMIT 1;
```

**Conclusión:** La función está correctamente implementada y filtra por `business_id`.

---

### ✅ Auditoría #2: Función `handle_appointment_confirmation()`

**Resultado:** ✅ **FUNCIÓN CORRECTA**

La función:
- ✅ Llama a `get_client_user_id_from_appointment(NEW.id, NEW.business_id)` correctamente
- ✅ Valida que `_client_user_id` no sea NULL
- ✅ Inserta la notificación con el `user_id` correcto

**Código Verificado:**
```sql
_client_user_id := public.get_client_user_id_from_appointment(NEW.id, NEW.business_id);

INSERT INTO public.client_notifications (
  user_id,  -- ✅ USA _client_user_id (correcto)
  client_id,
  appointment_id,
  business_id,
  ...
) VALUES (
  _client_user_id,  -- ✅ USER_ID CORRECTO
  ...
);
```

**Conclusión:** La función crea las notificaciones con el `user_id` correcto.

---

### ✅ Auditoría #3: Notificaciones Recientes en la BD

**Resultado:** ✅ **NOTIFICACIONES CORRECTAS EN LA BD**

**Ejemplos de Notificaciones Recientes:**

1. **Notificación #1:**
   - `appointment_id`: `9a4a8205-2f8e-40b7-96ef-66ce1ea80a70`
   - `client_id`: `74291aef-1809-4209-a17a-f8f7381341d9`
   - `client_name`: "Tity"
   - `notification_user_id`: `ef2e21d7-999f-4301-8b05-00b9605f36c0` ✅
   - `correct_client_user_id`: `ef2e21d7-999f-4301-8b05-00b9605f36c0` ✅
   - `validacion_user_id`: ✅ **CORRECTO**

2. **Notificación #2:**
   - `appointment_id`: `cc25b440-9acc-48dd-a6af-9d4bf2f1ecce`
   - `client_id`: `75721c0f-d267-4f08-9cbb-0d6066d5efb2`
   - `client_name`: "Kika"
   - `notification_user_id`: `7ab6a213-7bfe-49ec-bcfc-381966609dff` ✅
   - `correct_client_user_id`: `7ab6a213-7bfe-49ec-bcfc-381966609dff` ✅
   - `validacion_user_id`: ✅ **CORRECTO**

**Conclusión:** Las notificaciones en la BD tienen el `user_id` CORRECTO.

---

### ✅ Auditoría #4: Prueba de `get_client_user_id_from_appointment()`

**Resultado:** ✅ **FUNCIÓN DEVUELVE USER_ID CORRECTO**

**Ejemplos:**

1. **Cita #1:**
   - `appointment_id`: `9a4a8205-2f8e-40b7-96ef-66ce1ea80a70`
   - `client_id`: `74291aef-1809-4209-a17a-f8f7381341d9`
   - `function_user_id`: `ef2e21d7-999f-4301-8b05-00b9605f36c0` ✅
   - `correct_client_user_id`: `ef2e21d7-999f-4301-8b05-00b9605f36c0` ✅
   - `validacion`: ✅ **CORRECTO**

2. **Cita #2:**
   - `appointment_id`: `cc25b440-9acc-48dd-a6af-9d4bf2f1ecce`
   - `client_id`: `75721c0f-d267-4f08-9cbb-0d6066d5efb2`
   - `function_user_id`: `7ab6a213-7bfe-49ec-bcfc-381966609dff` ✅
   - `correct_client_user_id`: `7ab6a213-7bfe-49ec-bcfc-381966609dff` ✅
   - `validacion`: ✅ **CORRECTO**

**Conclusión:** La función devuelve el `user_id` CORRECTO para cada cita.

---

### ⚠️ Auditoría #5: Usuario jordanpremium15@gmail.com

**Resultado:** ⚠️ **USUARIO TIENE MÚLTIPLES CLIENTES**

**Hallazgos:**
- `user_id`: `7ab6a213-7bfe-49ec-bcfc-381966609dff`
- `email`: `jordanpremium15@gmail.com`
- `profile_name`: "noelia perez"
- **Total de clientes asociados:** 2
  - Cliente #1: `75721c0f-d267-4f08-9cbb-0d6066d5efb2` (business: `9e7daf16-7c47-4df3-9566-aadf09184dfa`)
  - Cliente #2: `840b6cbc-eedf-412a-a0c3-45bb49dd3f0a` (business: `f4591b05-7174-4a69-81d0-73e309c45a66`)

**Conclusión:** El usuario tiene múltiples clientes en diferentes businesses, pero esto es normal y no debería causar el problema.

---

### ⚠️ Auditoría #6: Múltiples Clientes con el Mismo `user_id`

**Resultado:** ⚠️ **HAY MÚLTIPLES CLIENTES CON EL MISMO USER_ID**

**Hallazgos:**

1. **User ID:** `ef2e21d7-999f-4301-8b05-00b9605f36c0`
   - **Businesses distintos:** 3
   - **Total clientes:** 3
   - **Business IDs:** `18f08874-c4dd-41a1-ba16-1ef0103df244`, `9e7daf16-7c47-4df3-9566-aadf09184dfa`, `f4591b05-7174-4a69-81d0-73e309c45a66`

2. **User ID:** `7ab6a213-7bfe-49ec-bcfc-381966609dff` (jordanpremium15@gmail.com)
   - **Businesses distintos:** 2
   - **Total clientes:** 2
   - **Business IDs:** `9e7daf16-7c47-4df3-9566-aadf09184dfa`, `f4591b05-7174-4a69-81d0-73e309c45a66`

**Conclusión:** Hay múltiples clientes con el mismo `user_id` en diferentes businesses, pero la función `get_client_user_id_from_appointment()` filtra correctamente por `business_id`.

---

### 🔴 PROBLEMA IDENTIFICADO: DISPOSITIVOS REGISTRADOS

**Sospecha Principal:** El problema está en los **dispositivos registrados** o en cómo la **Edge Function consulta los dispositivos**.

**Posibles Causas:**
1. Todos los dispositivos están registrados con el mismo `user_id` (jordanpremium15@gmail.com)
2. La Edge Function está usando un `user_id` fijo en lugar del `user_id` de la notificación
3. Hay un problema en cómo se pasa el `user_id` desde el trigger a la Edge Function

---

## 🔍 PRÓXIMOS PASOS DE INVESTIGACIÓN

### 1. Verificar Dispositivos Registrados
- ✅ Verificar qué `user_id` tienen los dispositivos activos
- ✅ Verificar si todos los dispositivos están asociados al mismo `user_id`

### 2. Verificar Edge Function
- ⚠️ Revisar cómo la Edge Function obtiene el `user_id` del payload
- ⚠️ Verificar si está usando el `user_id` de la notificación o un valor fijo

### 3. Verificar Trigger `send_push_on_client_notification`
- ⚠️ Revisar cómo se construye el payload que se envía a la Edge Function
- ⚠️ Verificar si el `user_id` se pasa correctamente

---

## 📝 CONCLUSIÓN TEMPORAL

### ✅ Lo que está CORRECTO:
1. ✅ Función `get_client_user_id_from_appointment()` funciona correctamente
2. ✅ Función `handle_appointment_confirmation()` crea notificaciones con `user_id` correcto
3. ✅ Las notificaciones en la BD tienen el `user_id` correcto
4. ✅ El filtrado por `business_id` funciona correctamente

### ❌ Lo que está INCORRECTO (SOSPECHAS):
1. ❌ **Los dispositivos registrados podrían estar todos asociados al mismo `user_id`**
2. ❌ **La Edge Function podría estar usando un `user_id` fijo**
3. ❌ **El trigger `send_push_on_client_notification` podría no estar pasando el `user_id` correcto**

### 🎯 Próxima Acción:
**Verificar los dispositivos registrados y el flujo de envío de push notifications desde el trigger hasta la Edge Function.**

---

**FIN DE LA AUDITORÍA INICIAL**

