# 🔒 REESCRITURA COMPLETA DE TRIGGERS - ENFOQUE FAIL-FAST

**Fecha:** 2026-02-03  
**Objetivo:** Hacer IMPOSIBLE enviar una notificación sin la cadena completa de datos válidos

---

## 🎯 REGLA DE ORO

**Si no existe la cadena completa:**
```
appointment → client → user_id → dispositivos
```

**El trigger DEBE TERMINAR SIN HACER NADA (silenciosamente)**

**Filosofía:** Preferimos perder 100 notificaciones antes que enviar 1 incorrecta

---

## ✅ CAMBIOS IMPLEMENTADOS

### 1. Función `get_client_user_id_from_appointment()` - SIMPLIFICADA

**ANTES (con fallbacks):**
- ❌ Buscaba por email en `client_profiles`
- ❌ Buscaba por email en `auth.users`
- ❌ Usaba `appointments.user_id` como fallback
- ❌ Múltiples intentos de búsqueda

**AHORA (sin fallbacks):**
- ✅ Solo busca en `clients` con `business_id`
- ✅ Solo retorna `user_id` si existe y es válido
- ✅ Si no encuentra → retorna NULL (sin intentar alternativas)
- ✅ CERO búsquedas por email
- ✅ CERO uso de `appointments.user_id`

**Código:**
```sql
-- Solo un paso: buscar en clients
SELECT user_id INTO v_user_id
FROM public.clients
WHERE id = v_client_id
  AND business_id = p_business_id
  AND user_id IS NOT NULL  -- Solo si tiene user_id
LIMIT 1;
```

---

### 2. Nueva Función `has_active_devices()` - VALIDACIÓN DE DISPOSITIVOS

**Propósito:** Validar que el `user_id` tenga al menos un dispositivo activo antes de crear notificaciones

**Validaciones:**
- ✅ `user_id` no es NULL
- ✅ `user_id` es UUID válido
- ✅ Existe al menos un dispositivo en `client_devices` con:
  - `user_id` coincidente
  - `role` correcto ('client')
  - `enabled = true`
  - `fcm_token` no vacío

**Retorna:**
- `TRUE` si hay dispositivos activos
- `FALSE` si no hay dispositivos (o datos inválidos)

---

### 3. Función `handle_appointment_confirmation()` - REESCRITA

**Validaciones en orden (fail-fast):**

1. ✅ `business_id` no es NULL
2. ✅ `client_id` no es NULL (no walk-ins)
3. ✅ Obtener `user_id` (sin fallbacks)
4. ✅ `user_id` no es NULL
5. ✅ `user_id` es UUID válido
6. ✅ Cliente existe y pertenece al negocio
7. ✅ `user_id` del cliente coincide con el obtenido
8. ✅ Existen dispositivos activos
9. ✅ Negocio existe

**Si CUALQUIERA falla → terminar silenciosamente (RETURN NEW)**

**Comportamiento:**
- ✅ No lanza excepciones visibles
- ✅ No registra warnings innecesarios
- ✅ Termina sin hacer nada si falta cualquier dato

---

### 4. Función `handle_appointment_completion()` - REESCRITA

**Validaciones idénticas a `handle_appointment_confirmation()`**

**Adicional:**
- ✅ Crea review pendiente solo si todas las validaciones pasaron
- ✅ Si falla la creación de review → terminar silenciosamente

---

## 🚫 ELIMINADO COMPLETAMENTE

### ❌ Búsquedas por email
- No se busca en `client_profiles` por email
- No se busca en `auth.users` por email
- No se usa `client_email` para identificar usuarios

### ❌ Fallbacks
- No se usa `appointments.user_id` como alternativa
- No se intentan múltiples métodos de búsqueda
- No se "intenta" encontrar el usuario de otra forma

### ❌ Lógica condicional compleja
- No hay "si no hay esto, intenta aquello"
- No hay decisiones automáticas sin datos completos
- No hay búsquedas alternativas

### ❌ Uso de `client_device` para decidir identidad
- No se usa `client_devices` para identificar usuarios
- Solo se usa para validar que existen dispositivos activos

---

## 📋 FLUJO COMPLETO (Paso a Paso)

### Escenario: Partner confirma una cita

1. **Trigger se dispara:**
   - `trigger_handle_appointment_confirmation` se ejecuta
   - Llama a `handle_appointment_confirmation()`

2. **Validación 1-2: Datos básicos**
   - ✅ `NEW.business_id` existe? → Si no → TERMINAR
   - ✅ `NEW.client_id` existe? → Si no → TERMINAR

3. **Validación 3-5: Obtener y validar user_id**
   - Llama a `get_client_user_id_from_appointment(NEW.id, NEW.business_id)`
   - ✅ Retorna `user_id`? → Si no → TERMINAR
   - ✅ `user_id` es UUID válido? → Si no → TERMINAR

4. **Validación 6: Cliente existe y pertenece al negocio**
   - Busca en `clients` con `id = client_id` y `business_id = business_id`
   - ✅ Cliente existe? → Si no → TERMINAR
   - ✅ `clients.user_id` coincide con el obtenido? → Si no → TERMINAR

5. **Validación 7: Dispositivos activos**
   - Llama a `has_active_devices(user_id, 'client')`
   - ✅ Hay dispositivos activos? → Si no → TERMINAR

6. **Validación 8: Negocio existe**
   - Busca en `businesses` con `id = business_id`
   - ✅ Negocio existe? → Si no → TERMINAR

7. **TODAS LAS VALIDACIONES PASARON:**
   - ✅ Crear notificación en `client_notifications`
   - ✅ Si hay error al insertar → TERMINAR silenciosamente

---

## 🔍 CASOS DE USO

### ✅ Caso 1: Cita con cliente válido y dispositivos
- `business_id`: ✅ Existe
- `client_id`: ✅ Existe
- `clients.user_id`: ✅ Existe y es válido
- `client_devices`: ✅ Hay al menos 1 dispositivo activo
- **Resultado:** ✅ Notificación creada y enviada

### ❌ Caso 2: Walk-in (sin client_id)
- `business_id`: ✅ Existe
- `client_id`: ❌ NULL
- **Resultado:** ❌ Termina sin hacer nada (correcto)

### ❌ Caso 3: Cliente sin user_id
- `business_id`: ✅ Existe
- `client_id`: ✅ Existe
- `clients.user_id`: ❌ NULL
- **Resultado:** ❌ Termina sin hacer nada (correcto)

### ❌ Caso 4: Cliente sin dispositivos
- `business_id`: ✅ Existe
- `client_id`: ✅ Existe
- `clients.user_id`: ✅ Existe y es válido
- `client_devices`: ❌ No hay dispositivos activos
- **Resultado:** ❌ Termina sin hacer nada (correcto)

### ❌ Caso 5: Cliente de otro negocio
- `business_id`: ✅ Existe
- `client_id`: ✅ Existe
- `clients.business_id`: ❌ Diferente al de la cita
- **Resultado:** ❌ Termina sin hacer nada (correcto)

---

## 🛡️ GARANTÍAS DE SEGURIDAD

### ✅ Nunca se envía a usuario incorrecto
- Solo usa `clients.user_id` que está directamente relacionado
- No hay búsquedas ambiguas
- No hay fallbacks que puedan devolver usuarios incorrectos

### ✅ Siempre filtra por negocio
- Todas las búsquedas incluyen `business_id`
- Garantiza que el cliente pertenece al negocio correcto
- No hay ambigüedades de multitenancy

### ✅ Fail hard y seguro
- Si falta cualquier dato → termina sin hacer nada
- No intenta "arreglar" datos faltantes
- No toma decisiones automáticas sin datos completos

### ✅ Validación de dispositivos
- No crea notificaciones si no hay dispositivos para enviar
- Evita crear notificaciones "huérfanas"
- Solo crea notificaciones que pueden ser entregadas

---

## 📊 IMPACTO ESPERADO

### Citas que SÍ se pueden notificar:
- Citas con `client_id` válido
- Cliente tiene `user_id` válido
- Cliente pertenece al negocio correcto
- Cliente tiene al menos 1 dispositivo activo

### Citas que NO se pueden notificar (comportamiento correcto):
- Walk-ins (sin `client_id`)
- Clientes sin `user_id`
- Clientes sin dispositivos activos
- Clientes de otro negocio
- Datos inconsistentes o inválidos

**Filosofía:** Es mejor no notificar que notificar incorrectamente

---

## 🔄 MIGRACIÓN

**Archivo:** `supabase/migrations/20260203000000_rewrite_triggers_fail_fast.sql`

**Pasos:**
1. Elimina triggers y funciones existentes
2. Crea función `get_client_user_id_from_appointment()` simplificada
3. Crea función `has_active_devices()` nueva
4. Reescribe `handle_appointment_confirmation()`
5. Reescribe `handle_appointment_completion()`
6. Crea triggers nuevos

**Para aplicar:**
```bash
supabase migration up
```

---

## ✅ VERIFICACIÓN POST-MIGRACIÓN

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

**Debe mostrar solo 2 triggers:**
1. `trigger_handle_appointment_confirmation` (UPDATE, AFTER)
2. `trigger_handle_appointment_completion` (UPDATE, AFTER)

### Verificar funciones:
```sql
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN (
  'get_client_user_id_from_appointment',
  'has_active_devices',
  'handle_appointment_confirmation',
  'handle_appointment_completion'
)
ORDER BY proname;
```

---

## 🎯 RESUMEN

### ✅ Lo que SÍ hace:
- Valida cadena completa: appointment → client → user_id → dispositivos
- Termina silenciosamente si falta cualquier dato
- Solo crea notificaciones con datos completos y válidos
- Filtra siempre por `business_id` para multitenancy
- Valida que existen dispositivos antes de crear notificaciones

### ❌ Lo que NO hace:
- No busca por email
- No usa fallbacks
- No intenta "arreglar" datos faltantes
- No toma decisiones automáticas sin datos completos
- No usa `client_device` para decidir identidad
- No envía notificaciones sin validar dispositivos

---

## 🔒 PRIVACIDAD CRÍTICA

**Este enfoque trata la privacidad como crítica:**

- ✅ Nunca se envía a usuarios incorrectos
- ✅ Nunca se envía sin validar la cadena completa
- ✅ Nunca se toma decisiones automáticas sin datos completos
- ✅ Preferimos perder notificaciones antes que enviar incorrectamente

**Resultado:** Sistema seguro, predecible y mantenible

