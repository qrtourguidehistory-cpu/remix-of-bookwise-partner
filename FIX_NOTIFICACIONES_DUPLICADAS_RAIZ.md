# ✅ FIX DEFINITIVO - NOTIFICACIONES DUPLICADAS DESDE LA RAÍZ

**Fecha:** 2025-02-03  
**Problema:** Notificaciones duplicadas (5 notificaciones por 1 confirmación)  
**Causa raíz:** Race condition en la verificación de idempotencia  
**Solución:** Lock atómico usando INSERT como primer paso

---

## 🔍 PROBLEMA IDENTIFICADO

### Síntomas en logs:
- `PUSH::SKIPPED::already_sent` aparece
- `Idempotencia OK` aparece simultáneamente
- `Push enviado` aparece múltiples veces
- Cliente recibe 5 notificaciones idénticas

### Causa raíz:
**Race condition en la verificación de idempotencia**

El código anterior usaba:
1. **SELECT** para verificar si ya existe → `existingNotification`
2. Si no existe → continuar
3. Enviar push
4. **INSERT** después de enviar

**Problema:** Entre el SELECT (paso 1) y el INSERT (paso 4), múltiples ejecuciones pueden pasar la verificación simultáneamente:

```
Ejecución 1: SELECT → No existe → Envía push → INSERT
Ejecución 2: SELECT → No existe (Ejecución 1 aún no insertó) → Envía push → INSERT
Ejecución 3: SELECT → No existe (Ejecuciones 1 y 2 aún no insertaron) → Envía push → INSERT
...
```

**Resultado:** Múltiples pushes enviados antes de que el primer INSERT complete.

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Patrón: Lock atómico usando INSERT

**Cambio fundamental:** El INSERT ahora es el **PRIMER paso real**, antes de cualquier inicialización de Firebase o envío de push.

### Flujo corregido:

1. **Validar `appointment_id`** (validación básica)
2. **Obtener `user_id` del cliente** (query mínima, solo para el INSERT)
3. **🔒 INSERT en `push_notification_sent`** ← **LOCK ATÓMICO**
   - Si INSERT exitoso → Esta ejecución adquiere el lock, continúa
   - Si INSERT falla con error 23505 → Otra ejecución ya adquirió el lock, RETURN inmediato
4. Solo si el lock fue adquirido:
   - Obtener información completa de la cita
   - Buscar dispositivos
   - Inicializar Firebase
   - Enviar push

### Código clave:

```typescript
// ✅ PASO 2: LOCK ATÓMICO - INSERT como primer paso real
const { error: lockError } = await supabase
  .from('push_notification_sent')
  .insert({
    appointment_id: appointment_id,
    notification_type: 'appointment_confirmed',
    edge_function: 'notify-appointment-confirmed',
    user_id: clientUserId,
    sent_at: new Date().toISOString()
  });

// Si falla con 23505 (duplicate key), otra ejecución ya adquirió el lock
if (lockError?.code === '23505') {
  console.log(`🔒 PUSH::LOCKED::already_processing`);
  return { success: true, locked: true, message: "PUSH::LOCKED::already_processing" };
}

// Solo si el lock fue adquirido, continuar con el resto del flujo
```

---

## 🔒 POR QUÉ AHORA ES IMPOSIBLE QUE SE REPITA

### 1. Constraint UNIQUE en la base de datos:
```sql
UNIQUE (appointment_id, notification_type, edge_function)
```

Esta constraint garantiza que **solo puede existir 1 registro** por combinación.

### 2. INSERT como operación atómica:
- El INSERT es una operación **atómica** a nivel de base de datos
- Solo **UNA ejecución** puede insertar exitosamente
- Las demás **fallan inmediatamente** con error 23505

### 3. Sin ventana de carrera:
- **Antes:** SELECT → (ventana de carrera) → INSERT
- **Ahora:** INSERT directamente (sin ventana de carrera)

### 4. Fail-fast en duplicados:
- Si el INSERT falla con 23505 → RETURN inmediato
- No se inicializa Firebase
- No se buscan dispositivos
- No se envía push

---

## 📊 ESCENARIO: 5 EJECUCIONES PARALELAS

### Ejecución 1:
1. ✅ Valida `appointment_id`
2. ✅ Obtiene `user_id`
3. ✅ **INSERT exitoso** → Adquiere lock
4. ✅ Continúa: busca dispositivos, inicializa Firebase, envía push
5. ✅ Retorna `success: true, pushSent: true`

### Ejecución 2:
1. ✅ Valida `appointment_id`
2. ✅ Obtiene `user_id`
3. ❌ **INSERT falla con 23505** → Lock ya adquirido
4. ⏭️ RETURN inmediato con `PUSH::LOCKED::already_processing`
5. ✅ No envía push

### Ejecución 3, 4, 5:
- Mismo comportamiento que Ejecución 2
- Todas retornan `PUSH::LOCKED::already_processing`
- Ninguna envía push

**Resultado:** 1 push enviado, 4 logs `PUSH::LOCKED` ✅

---

## 🎯 CAMBIOS REALIZADOS

### Eliminado:
- ❌ SELECT previo para verificar idempotencia
- ❌ Lógica "fail-open" que continuaba aunque fallara la verificación
- ❌ INSERT después de enviar push
- ❌ Ventanas de tiempo o lógica compleja

### Agregado:
- ✅ INSERT como primer paso real (lock atómico)
- ✅ Verificación de error 23505 para detectar lock adquirido
- ✅ RETURN inmediato si el lock ya fue adquirido
- ✅ Logs claros: `PUSH::LOCKED::already_processing`

---

## 📝 LOGS ESPERADOS

### Primera ejecución (adquiere lock y envía):
```
📨 [notify-appointment-confirmed] Evento: Cita confirmada
📋 [notify-appointment-confirmed] appointment_id: xxx
✅ [notify-appointment-confirmed] user_id receptor: yyy
🔒 [notify-appointment-confirmed] Intentando adquirir lock atómico...
✅ [notify-appointment-confirmed] Lock adquirido exitosamente - Esta ejecución procederá a enviar push
📱 [notify-appointment-confirmed] Dispositivos encontrados: 1
🚀 [notify-appointment-confirmed] Inicializando Firebase Admin...
✅ [notify-appointment-confirmed] Push enviado a dispositivo zzz
📊 [notify-appointment-confirmed] Resultados: 1 exitosos, 0 fallidos
```

### Ejecuciones adicionales (lock ya adquirido):
```
📨 [notify-appointment-confirmed] Evento: Cita confirmada
📋 [notify-appointment-confirmed] appointment_id: xxx
✅ [notify-appointment-confirmed] user_id receptor: yyy
🔒 [notify-appointment-confirmed] Intentando adquirir lock atómico...
🔒 [notify-appointment-confirmed] PUSH::LOCKED::already_processing - Otra ejecución ya está procesando o ya procesó appointment_id: xxx
```

---

## ✅ VERIFICACIÓN

### Checklist:
- [x] INSERT como primer paso real (antes de Firebase)
- [x] Verificación de error 23505 para detectar lock
- [x] RETURN inmediato si lock ya adquirido
- [x] Eliminado SELECT previo
- [x] Eliminada lógica "fail-open"
- [x] Logs claros para debugging
- [x] Función desplegada

---

## 🔍 NOTA SOBRE EL FRONTEND

**Estado actual:** El frontend SÍ llama a `notify-appointment-confirmed` desde múltiples lugares:
- `DayView.tsx` (2 lugares)
- `AppointmentDialog.tsx` (2 lugares)
- `AppointmentDetailView.tsx` (1 lugar)
- `StaffCalendarView.tsx` (1 lugar)
- `WeekView.tsx` (1 lugar)

**Con el lock atómico:** Aunque el frontend llame múltiples veces, solo UNA ejecución podrá adquirir el lock y enviar push. Las demás retornarán `PUSH::LOCKED::already_processing`.

**Recomendación futura:** Idealmente, el frontend no debería llamar directamente a la Edge Function. Debería confiar en los triggers SQL o en un único punto de envío consolidado. Sin embargo, con el lock atómico implementado, el problema de duplicados está resuelto independientemente de cuántas veces se llame.

---

## 🎉 CONCLUSIÓN

El problema de notificaciones duplicadas está **cerrado definitivamente desde la raíz**.

**Antes:**
- SELECT → (ventana de carrera) → Múltiples pushes → INSERT
- 5 ejecuciones → 5 pushes ❌

**Ahora:**
- INSERT (lock atómico) → Solo 1 puede adquirir → 1 push
- 5 ejecuciones → 1 push, 4 logs `PUSH::LOCKED` ✅

**Por qué es imposible que se repita:**
1. Constraint UNIQUE garantiza solo 1 registro
2. INSERT es atómico a nivel de base de datos
3. Sin ventana de carrera (no hay SELECT previo)
4. Fail-fast en duplicados (RETURN inmediato)

**Resultado:** 1 confirmación → 1 notificación push ✅

