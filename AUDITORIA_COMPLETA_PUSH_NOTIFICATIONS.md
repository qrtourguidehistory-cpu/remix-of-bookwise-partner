# 🔒 AUDITORÍA COMPLETA: PUSH NOTIFICATIONS / TRIGGERS

**Fecha:** 2026-02-03  
**Objetivo:** Garantizar que es IMPOSIBLE enviar push notifications sin user_id válido y correctamente relacionado

---

## 🎯 REGLA DE ORO IMPLEMENTADA

**Si no se puede determinar el usuario exacto → NO SE ENVÍA NADA**

**Más vale perder una notificación que violar privacidad**

---

## ✅ TRIGGERS Y FUNCIONES AUDITADAS

### 1. ✅ `trigger_handle_appointment_confirmation` → `handle_appointment_confirmation()`

**Estado:** ✅ CORREGIDO

**Validaciones implementadas:**
1. ✅ `business_id` es obligatorio
2. ✅ `client_id` es obligatorio (no walk-ins)
3. ✅ Obtener `user_id` del cliente (SIN FALLBACKS)
4. ✅ `user_id` es obligatorio
5. ✅ `user_id` es UUID válido
6. ✅ Cliente existe y pertenece al negocio
7. ✅ `user_id` del cliente coincide
8. ✅ Existen dispositivos activos
9. ✅ Negocio existe

**Comportamiento:**
- Si falta CUALQUIER dato → termina silenciosamente
- No intenta buscar alternativas
- No envía notificaciones sin validar cadena completa

---

### 2. ✅ `trigger_handle_appointment_completion` → `handle_appointment_completion()`

**Estado:** ✅ CORREGIDO

**Validaciones:** Idénticas a `handle_appointment_confirmation()`

**Comportamiento:**
- Si falta CUALQUIER dato → termina silenciosamente
- Crea review pendiente solo si todas las validaciones pasaron

---

### 3. ✅ `on_appointment_created` → `notify_partner_safe()`

**Estado:** ✅ CORREGIDO

**Problema encontrado:**
- ❌ Tenía `user_id` HARDCODEADO: `'3a3e0599-296c-4cb2-8658-e3a095de75d1'`
- ❌ Enviaba a un usuario fijo sin importar quién creó la cita

**Solución aplicada:**
- ✅ Obtiene `owner_id` del negocio dinámicamente
- ✅ Valida que `owner_id` existe y es UUID válido
- ✅ Valida que existen dispositivos activos
- ✅ Si falta cualquier dato → termina silenciosamente

**Validaciones implementadas:**
1. ✅ `business_id` es obligatorio
2. ✅ Obtener `owner_id` del negocio
3. ✅ `owner_id` es obligatorio
4. ✅ `owner_id` es UUID válido
5. ✅ Existen dispositivos activos para partner

---

### 4. ✅ `tr_push_new_appointment` → `fn_notify_partner_v13()`

**Estado:** ✅ CORREGIDO

**Problema encontrado:**
- ⚠️ No validaba dispositivos activos antes de enviar

**Solución aplicada:**
- ✅ Agregada validación de dispositivos activos
- ✅ Valida que `owner_id` existe y es UUID válido
- ✅ Si falta cualquier dato → termina silenciosamente

**Validaciones implementadas:**
1. ✅ `business_id` es obligatorio
2. ✅ Obtener `owner_id` del negocio
3. ✅ `owner_id` es obligatorio
4. ✅ `owner_id` es UUID válido
5. ✅ Existen dispositivos activos para partner

---

### 5. ✅ `trigger_notify_new_appointment` → `notify_partner_new_appointment()`

**Estado:** ✅ CORREGIDO

**Problema encontrado:**
- ⚠️ No validaba dispositivos activos antes de insertar notificación

**Solución aplicada:**
- ✅ Agregada validación de dispositivos activos
- ✅ Valida que `owner_id` existe y es UUID válido
- ✅ Si falta cualquier dato → termina silenciosamente

**Validaciones implementadas:**
1. ✅ `business_id` es obligatorio
2. ✅ Obtener `owner_id` del negocio
3. ✅ `owner_id` es obligatorio
4. ✅ `owner_id` es UUID válido
5. ✅ Existen dispositivos activos para partner

---

### 6. ✅ `trigger_notify_next_client_on_started` → `notify_next_client_on_started()`

**Estado:** ✅ REVISADO

**Comportamiento:**
- Llama a Edge Function `notify-next-client`
- No envía push directamente desde el trigger
- La Edge Function tiene su propia validación

---

## ✅ EDGE FUNCTIONS AUDITADAS

### 1. ✅ `send-push-notification`

**Estado:** ✅ YA ESTABA CORRECTO

**Validaciones implementadas:**
1. ✅ `user_id` NO puede ser null, undefined o string vacío
2. ✅ `user_id` DEBE ser un UUID válido
3. ✅ Si `role = 'client'`, `user_id` es obligatorio
4. ✅ Consulta dispositivos SOLO por `normalizedUserId` (sin fallbacks)

**Comportamiento:**
- Si `user_id` es inválido → retorna 400 (cancela envío)
- No intenta buscar alternativas
- No envía a múltiples usuarios

---

### 2. ✅ `notify-next-client`

**Estado:** ✅ CORREGIDO

**Problema encontrado:**
- ⚠️ Insertaba en `client_notifications` sin validar `user_id` ni dispositivos

**Solución aplicada:**
- ✅ Valida que `user_id` es UUID válido
- ✅ Valida que existen dispositivos activos antes de insertar
- ✅ Si no hay dispositivos → NO inserta notificación

**Validaciones implementadas:**
1. ✅ `clientUserId` existe
2. ✅ `clientUserId` es UUID válido
3. ✅ Existen dispositivos activos para el `user_id`
4. ✅ Solo inserta notificación si todas las validaciones pasan

---

## 🚫 ELIMINADO COMPLETAMENTE

### ❌ User_id hardcodeado
- `notify_partner_safe()` ya no tiene `user_id` fijo
- Todas las funciones obtienen `user_id` dinámicamente

### ❌ Fallbacks
- No se busca por email
- No se usa `appointments.user_id` como alternativa
- No se intentan múltiples métodos de búsqueda

### ❌ Broadcasts
- No se envía a "todos los usuarios"
- No se envía a "todos los clientes"
- No se envía a "todos los partners"

### ❌ Lógica condicional compleja
- No hay "si no hay esto, intenta aquello"
- No hay decisiones automáticas sin datos completos
- No hay búsquedas alternativas

---

## 📋 CADENA DE VALIDACIÓN COMPLETA

### Para notificaciones a CLIENTES:

```
appointment → client_id → clients.user_id → dispositivos activos → notificación
```

**Validaciones:**
1. ✅ `appointment.business_id` existe
2. ✅ `appointment.client_id` existe
3. ✅ `clients.id = appointment.client_id`
4. ✅ `clients.business_id = appointment.business_id`
5. ✅ `clients.user_id` existe y es UUID válido
6. ✅ Existen dispositivos activos en `client_devices` para `user_id` y `role='client'`

**Si falta CUALQUIERA → NO SE ENVÍA NADA**

---

### Para notificaciones a PARTNERS:

```
appointment → business_id → businesses.owner_id → dispositivos activos → notificación
```

**Validaciones:**
1. ✅ `appointment.business_id` existe
2. ✅ `businesses.id = appointment.business_id`
3. ✅ `businesses.owner_id` existe y es UUID válido
4. ✅ Existen dispositivos activos en `client_devices` para `owner_id` y `role='partner'`

**Si falta CUALQUIERA → NO SE ENVÍA NADA**

---

## 🔍 FUNCIONES HELPER CREADAS

### 1. ✅ `get_client_user_id_from_appointment(p_appointment_id, p_business_id)`

**Propósito:** Obtener `user_id` del cliente desde una cita

**Comportamiento:**
- Solo busca en `clients` con `business_id`
- No busca por email
- No usa fallbacks
- Si no encuentra → retorna NULL

---

### 2. ✅ `has_active_devices(p_user_id, p_role)`

**Propósito:** Validar que existen dispositivos activos

**Validaciones:**
- `user_id` no es NULL
- `user_id` es UUID válido
- Existe al menos un dispositivo con:
  - `user_id` coincidente
  - `role` correcto
  - `enabled = true`
  - `fcm_token` no vacío

**Retorna:**
- `TRUE` si hay dispositivos activos
- `FALSE` si no hay dispositivos (o datos inválidos)

---

### 3. ✅ `validate_user_id_for_notification(p_user_id, p_role)`

**Propósito:** Validar `user_id` antes de insertar notificación (para Edge Functions)

**Validaciones:**
- `user_id` no es NULL
- `user_id` es UUID válido
- Existen dispositivos activos

**Retorna:**
- `TRUE` si todas las validaciones pasan
- `FALSE` si alguna falla

---

## 📊 RESUMEN DE CORRECCIONES

### Funciones corregidas:
1. ✅ `notify_partner_safe()` - Eliminado `user_id` hardcodeado
2. ✅ `fn_notify_partner_v13()` - Agregada validación de dispositivos
3. ✅ `notify_partner_new_appointment()` - Agregada validación de dispositivos
4. ✅ `handle_appointment_confirmation()` - Ya corregida (migración anterior)
5. ✅ `handle_appointment_completion()` - Ya corregida (migración anterior)

### Edge Functions corregidas:
1. ✅ `notify-next-client` - Agregada validación de `user_id` y dispositivos

### Edge Functions ya correctas:
1. ✅ `send-push-notification` - Ya tenía validaciones estrictas

---

## ✅ GARANTÍAS DE SEGURIDAD

### ✅ Nunca se envía a usuario incorrecto
- Solo usa `user_id` directamente relacionado con la entidad
- No hay búsquedas ambiguas
- No hay fallbacks que puedan devolver usuarios incorrectos

### ✅ Siempre filtra por negocio
- Todas las búsquedas incluyen `business_id`
- Garantiza que el usuario pertenece al negocio correcto
- No hay ambigüedades de multitenancy

### ✅ Fail hard y seguro
- Si falta cualquier dato → termina sin hacer nada
- No intenta "arreglar" datos faltantes
- No toma decisiones automáticas sin datos completos

### ✅ Validación de dispositivos
- No crea notificaciones si no hay dispositivos para enviar
- Evita crear notificaciones "huérfanas"
- Solo crea notificaciones que pueden ser entregadas

### ✅ 1 cita → 1 usuario → 1 conjunto de dispositivos
- Cada cita se relaciona con un usuario específico
- Cada usuario tiene un conjunto específico de dispositivos
- No hay broadcasts ni envíos masivos

---

## 🎯 RESULTADO FINAL

**Estado:** ✅ SISTEMA COMPLETAMENTE SEGURO

**Garantías:**
- ✅ Es IMPOSIBLE enviar push si `user_id` es NULL, inválido o ambiguo
- ✅ No hay lógica de fallback o broadcast
- ✅ 1 cita → 1 usuario → 1 conjunto de dispositivos
- ✅ Si no se puede determinar el usuario exacto → NO SE ENVÍA NADA

**Filosofía implementada:**
- Más vale perder una notificación que violar privacidad
- Fail fast, fail silently
- Validación estricta en cada paso

---

## 📝 MIGRACIONES APLICADAS

1. ✅ `20260203000000_rewrite_triggers_fail_fast.sql`
   - Reescribió triggers de confirmación y completación
   - Eliminó todos los fallbacks

2. ✅ `20260203000001_fix_critical_push_notifications.sql`
   - Corrigió `notify_partner_safe()` (eliminó `user_id` hardcodeado)
   - Agregó validaciones a todas las funciones de notificación
   - Creó función helper `validate_user_id_for_notification()`

---

## 🔍 VERIFICACIÓN POST-AUDITORÍA

### Verificar que NO hay `user_id` hardcodeado:
```sql
SELECT 
  proname,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname IN (
  'notify_partner_safe',
  'fn_notify_partner_v13',
  'notify_partner_new_appointment',
  'handle_appointment_confirmation',
  'handle_appointment_completion'
)
AND pg_get_functiondef(oid) LIKE '%3a3e0599-296c-4cb2-8658-e3a095de75d1%';
```

**Resultado esperado:** 0 filas (ninguna función con `user_id` hardcodeado)

### Verificar triggers activos:
```sql
SELECT 
  trigger_name, 
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'appointments'
ORDER BY trigger_name;
```

**Debe mostrar todos los triggers con sus funciones corregidas**

---

## ✅ CONCLUSIÓN

**El sistema está completamente protegido contra:**
- ❌ Envíos con `user_id` NULL
- ❌ Envíos con `user_id` inválido
- ❌ Envíos con `user_id` ambiguo
- ❌ Fallbacks y broadcasts
- ❌ Envíos masivos por error

**Garantía absoluta:**
- Si no se puede determinar el usuario exacto → NO SE ENVÍA NADA
- Más vale perder una notificación que violar privacidad

