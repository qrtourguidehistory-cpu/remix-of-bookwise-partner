# 🔍 DIAGNÓSTICO: "JEFE OCULTO" REVIRTIENDO CAMBIOS

**Fecha:** 2026-02-20  
**Problema:** Los cambios en `is_public` desaparecen solos. Negocios premium se ocultan y no-premium aparecen.

---

## 🎯 CULPABLE IDENTIFICADO

### Edge Function: `sync-business-visibility`

**Ubicación:** `supabase/functions/sync-business-visibility/index.ts`

**Problema:**
Esta función está actualizando `is_public` basado en `business_subscriptions` (sistema antiguo), **ignorando completamente `is_premium`** (sistema nuevo).

**Lógica Actual (INCORRECTA):**
```typescript
// Lee business_subscriptions (sistema antiguo)
const { data: activeSubscriptions } = await supabase
  .from('business_subscriptions')
  .select('business_id, status')
  .in('status', ['active', 'trialing']);

// Si tiene suscripción activa → is_public = true
// Si NO tiene suscripción activa → is_public = false
```

**Resultado:**
- ✅ Negocios con `business_subscriptions.status = 'active'` → `is_public = true` (aunque NO sean premium)
- ❌ Negocios premium SIN suscripción activa en `business_subscriptions` → `is_public = false`

---

## 📊 EVIDENCIA

### Estado Actual de la Base de Datos:
```
SALON YULISA:
  is_premium = true ✅
  is_public = false ❌ (debería ser true)
  business_subscriptions.status = 'cancelled' (sistema antiguo)

Mí Turnow Example:
  is_premium = true ✅
  is_public = false ❌ (debería ser true)
  business_subscriptions.status = 'cancelled' (sistema antiguo)

Centro de Uñas Lisbet:
  is_premium = false ❌
  is_public = true ✅ (pero NO debería ser público sin premium)
  business_subscriptions.status = 'active' (sistema antiguo)

Lucia Nail:
  is_premium = false ❌
  is_public = true ✅ (pero NO debería ser público sin premium)
  business_subscriptions.status = 'active' (sistema antiguo)
```

### Logs de Ejecución:
- Última ejecución: `1771548065463000` (hace ~30 minutos)
- Se ejecuta constantemente desde múltiples fuentes:
  - `paypal-webhook` → llama `sync-business-visibility`
  - `process-paypal-return` → llama `sync-business-visibility`
  - Probablemente otros webhooks también

---

## 🔍 OTROS HALLAZGOS

### 1. pg_cron Job
- **Job:** `cleanup-old-notifications`
- **Schedule:** `0 2 * * *` (diario a las 2 AM)
- **Función:** `scheduled-cleanup`
- **Impacto:** ✅ NO afecta `is_public` (solo limpia notificaciones)

### 2. Trigger: `handle_approval_request_status_change`
- **Tabla:** `business_approval_requests`
- **Problema:** Cuando se aprueba un negocio, pone `is_public = true` **sin verificar `is_premium`**
- **Impacto:** ⚠️ Puede hacer públicos negocios no-premium

### 3. Trigger: `prevent_partner_approval_changes`
- **Tabla:** `businesses`
- **Función:** Previene que partners cambien `is_public` manualmente
- **Impacto:** ✅ Correcto, no es el problema

### 4. Trigger: `sync_business_is_premium_trigger`
- **Tabla:** `profiles`
- **Función:** Sincroniza `is_premium` → `is_public`
- **Impacto:** ✅ Correcto, pero es sobrescrito por `sync-business-visibility`

---

## 🔧 SOLUCIÓN REQUERIDA

### Opción 1: Modificar `sync-business-visibility` (RECOMENDADO)
Modificar la función para que **respete `is_premium`** antes de actualizar `is_public`:

```typescript
// ANTES de actualizar is_public, verificar is_premium
// Si is_premium = true, NO tocar is_public (ya está controlado por sync_business_is_premium_trigger)
// Solo actualizar is_public si NO es premium (sistema antiguo)
```

### Opción 2: Desactivar/Eliminar `sync-business-visibility`
Como ya no usamos el sistema antiguo (Stripe/PayPal), podemos eliminar esta función completamente.

### Opción 3: Modificar llamadas a `sync-business-visibility`
Eliminar todas las llamadas a esta función desde:
- `paypal-webhook`
- `process-paypal-return`
- Cualquier otro lugar

---

## 📋 ACCIONES INMEDIATAS

1. **Modificar `sync-business-visibility`** para respetar `is_premium`
2. **Modificar `handle_approval_request_status_change`** para verificar `is_premium` antes de poner `is_public = true`
3. **Eliminar llamadas** a `sync-business-visibility` desde webhooks antiguos
4. **Sincronizar datos** nuevamente después de los cambios

---

## ⚠️ CONFLICTO DE SISTEMAS

**Sistema Nuevo (RevenueCat/Google Play):**
- Controla `is_public` vía `profiles.is_premium` → `businesses.is_premium/is_public`
- Trigger: `sync_business_is_premium_trigger`

**Sistema Antiguo (Stripe/PayPal):**
- Controla `is_public` vía `business_subscriptions.status`
- Edge Function: `sync-business-visibility`

**Resultado:** El sistema antiguo está **ganando** y revirtiendo los cambios del sistema nuevo.

---

## ✅ CONCLUSIÓN

**El "Jefe Oculto" es la Edge Function `sync-business-visibility`** que está siendo llamada constantemente y actualizando `is_public` basado en `business_subscriptions` (sistema antiguo), ignorando completamente `is_premium` (sistema nuevo).

**Solución:** Modificar o eliminar esta función para que respete `is_premium` como fuente única de verdad.

