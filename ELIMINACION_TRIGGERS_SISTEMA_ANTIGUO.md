# 🗑️ ELIMINACIÓN DE TRIGGERS Y FUNCIONES DEL SISTEMA ANTIGUO (Stripe/PayPal)

**Fecha:** 2026-02-20  
**Migración:** `remove_old_stripe_paypal_triggers_and_functions`  
**Estado:** ✅ COMPLETADO

---

## 📋 RESUMEN

Se eliminaron todos los triggers y funciones del sistema antiguo de Stripe/PayPal que modificaban `is_public` o `is_active` en la tabla `businesses`. El sistema nuevo (RevenueCat/Google Play) ahora controla estas columnas exclusivamente a través de `sync_business_is_premium_trigger`.

---

## 🗑️ TRIGGERS ELIMINADOS

### 1. `trigger_sync_business_visibility` (INSERT)
- **Tabla:** `business_subscriptions`
- **Evento:** `AFTER INSERT`
- **Función:** `sync_business_visibility_from_subscription()`
- **Acción:** Actualizaba `is_public` en `businesses` basado en el estado de la suscripción

### 2. `trigger_sync_business_visibility` (UPDATE)
- **Tabla:** `business_subscriptions`
- **Evento:** `AFTER UPDATE`
- **Función:** `sync_business_visibility_from_subscription()`
- **Acción:** Actualizaba `is_public` en `businesses` cuando cambiaba el estado de la suscripción

### 3. `trigger_sync_business_status_on_insert`
- **Tabla:** `business_subscriptions`
- **Evento:** `AFTER INSERT`
- **Función:** `sync_business_status_with_subscription()`
- **Acción:** Actualizaba `is_active` e `is_public` en `businesses` al crear una suscripción

### 4. `trigger_sync_business_status_with_subscription`
- **Tabla:** `business_subscriptions`
- **Evento:** `AFTER UPDATE`
- **Función:** `sync_business_status_with_subscription()`
- **Acción:** Actualizaba `is_active` e `is_public` en `businesses` cuando cambiaba el estado de la suscripción

### 5. `trigger_sync_business_visibility_on_delete`
- **Tabla:** `business_subscriptions`
- **Evento:** `AFTER DELETE`
- **Función:** `sync_business_visibility_on_delete()`
- **Acción:** Ponía `is_public = false` en `businesses` al eliminar una suscripción

---

## 🗑️ FUNCIONES ELIMINADAS

### 1. `sync_business_visibility_from_subscription()`
- **Tipo:** `TRIGGER FUNCTION`
- **Descripción:** Actualizaba `is_public` en `businesses` basado en el estado de `business_subscriptions`
- **Lógica:** Si `status IN ('active', 'trialing')` → `is_public = true`, sino → `is_public = false`

### 2. `sync_business_status_with_subscription()`
- **Tipo:** `TRIGGER FUNCTION`
- **Descripción:** Actualizaba `is_active` e `is_public` en `businesses` basado en el estado de `business_subscriptions`
- **Lógica:** 
  - `status = 'active'` → `is_active = true`, `is_public = true`
  - `status IN ('suspended', 'cancelled', 'past_due')` → `is_active = false`, `is_public = false`
  - `status = 'trialing'` → `is_active = true`, `is_public = true`
  - `status = 'inactive'` → `is_active = false`, `is_public = false`

### 3. `sync_business_visibility_on_delete()`
- **Tipo:** `TRIGGER FUNCTION`
- **Descripción:** Ponía `is_public = false` en `businesses` al eliminar una suscripción
- **Lógica:** `UPDATE businesses SET is_public = false WHERE id = OLD.business_id`

### 4. `force_update_business_visibility(UUID)`
- **Tipo:** `FUNCTION`
- **Descripción:** Función manual para forzar actualización de `is_public` basado en suscripciones
- **Lógica:** Actualizaba `is_public` para un negocio específico basado en sus suscripciones activas

### 5. `sync_all_business_visibility()`
- **Tipo:** `FUNCTION`
- **Descripción:** Función manual para sincronizar `is_public` de todos los negocios con suscripciones
- **Lógica:** Actualizaba `is_public` para todos los negocios que tienen suscripciones

---

## ✅ TRIGGERS Y FUNCIONES MANTENIDOS

### Trigger Mantenido:
- **`update_business_subscriptions_updated_at`**
  - **Tabla:** `business_subscriptions`
  - **Evento:** `BEFORE UPDATE`
  - **Función:** `update_updated_at_column()`
  - **Razón:** Solo actualiza `updated_at`, no modifica `is_public` ni `is_active`

### Triggers de Sistema (PostgreSQL):
- **`RI_ConstraintTrigger_*`** (Foreign Key constraints)
  - **Razón:** Triggers automáticos de PostgreSQL para integridad referencial

---

## 🔄 SISTEMA NUEVO (RevenueCat/Google Play)

El control de `is_premium`, `is_public` e `is_active` ahora se realiza exclusivamente a través de:

### Trigger Principal:
- **`sync_business_is_premium_trigger`**
  - **Tabla:** `profiles`
  - **Evento:** `AFTER UPDATE OF is_premium`
  - **Función:** `sync_business_is_premium()`
  - **Lógica:**
    - Si `is_premium = true` → `is_public = true`, `is_active = true`
    - Si `is_premium = false` → `is_public = false` (mantiene `is_active`)

### Flujo:
```
1. Usuario paga en Google Play
   ↓
2. RevenueCat Webhook → profiles.is_premium = true
   ↓
3. sync_business_is_premium_trigger se dispara
   ↓
4. businesses.is_premium = true
   businesses.is_public = true
   businesses.is_active = true
```

---

## ✅ VERIFICACIÓN POST-ELIMINACIÓN

### Triggers Restantes en `business_subscriptions`:
```sql
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'business_subscriptions';
```

**Resultado:**
- ✅ Solo queda `update_business_subscriptions_updated_at` (correcto)
- ✅ No quedan triggers que modifiquen `is_public` o `is_active`

### Funciones Eliminadas:
```sql
SELECT proname FROM pg_proc
WHERE proname IN (
  'sync_business_visibility_from_subscription',
  'sync_business_status_with_subscription',
  'sync_business_visibility_on_delete',
  'force_update_business_visibility',
  'sync_all_business_visibility'
);
```

**Resultado:**
- ✅ Todas las funciones fueron eliminadas correctamente

### Funciones que Modifican `is_public`/`is_active` desde `business_subscriptions`:
```sql
SELECT proname FROM pg_proc
WHERE prosrc LIKE '%business_subscriptions%'
  AND (prosrc LIKE '%is_public%' OR prosrc LIKE '%is_active%')
  AND proname NOT LIKE '%is_premium%';
```

**Resultado:**
- ✅ No quedan funciones que modifiquen `is_public` o `is_active` desde `business_subscriptions`

---

## 🎯 IMPACTO

### ✅ Beneficios:
1. **Eliminación de Conflictos:** Ya no hay triggers que compitan con el sistema nuevo
2. **Código Más Limpio:** Eliminación de código obsoleto y redundante
3. **Fuente Única de Verdad:** Solo `sync_business_is_premium_trigger` controla `is_public` e `is_active`
4. **Mantenibilidad:** Menos código = menos bugs potenciales

### ⚠️ Consideraciones:
1. **Negocios con Suscripciones Antiguas:** Los negocios que aún tienen suscripciones en `business_subscriptions` (Stripe/PayPal) ya no se actualizarán automáticamente. Si necesitan visibilidad, deben migrar a RevenueCat/Google Play.

2. **Datos Históricos:** La tabla `business_subscriptions` se mantiene para datos históricos, pero ya no afecta la visibilidad de los negocios.

---

## 📝 NOTAS ADICIONALES

- La migración se ejecutó con `CASCADE` para eliminar todas las dependencias
- Los triggers de Foreign Key (PostgreSQL) se mantienen intactos
- El trigger `update_business_subscriptions_updated_at` se mantiene porque solo actualiza `updated_at`
- No se afectaron otras tablas o funciones relacionadas con el sistema de aprobación

---

## ✅ CONCLUSIÓN

**Estado:** ✅ COMPLETADO EXITOSAMENTE

Todos los triggers y funciones del sistema antiguo de Stripe/PayPal que modificaban `is_public` o `is_active` han sido eliminados. El sistema ahora funciona exclusivamente con RevenueCat/Google Play a través de `sync_business_is_premium_trigger`.

**Próximos Pasos Recomendados:**
1. Monitorear que no haya errores en los logs relacionados con estas funciones eliminadas
2. Considerar migrar negocios con suscripciones antiguas a RevenueCat/Google Play
3. Documentar que `business_subscriptions` ya no controla la visibilidad de negocios

