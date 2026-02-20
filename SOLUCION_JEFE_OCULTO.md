# ✅ SOLUCIÓN: "JEFE OCULTO" ELIMINADO

**Fecha:** 2026-02-20  
**Problema:** Edge Function `sync-business-visibility` estaba revirtiendo cambios  
**Estado:** ✅ RESUELTO

---

## 🎯 CULPABLE IDENTIFICADO Y CORREGIDO

### Edge Function: `sync-business-visibility`

**Problema:**
- Actualizaba `is_public` basado en `business_subscriptions` (sistema antiguo)
- **Ignoraba completamente `is_premium`** (sistema nuevo)
- Se ejecutaba constantemente desde webhooks de PayPal

**Solución Aplicada:**
- ✅ Modificada para **respetar `is_premium`**
- ✅ Solo actualiza negocios que **NO tienen `is_premium = true`**
- ✅ Los negocios premium están protegidos (controlados por `sync_business_is_premium_trigger`)

---

## 🔧 CAMBIOS REALIZADOS

### 1. Edge Function `sync-business-visibility` Modificada

**Antes:**
```typescript
// Actualizaba TODOS los negocios con suscripciones activas
UPDATE businesses SET is_public = true WHERE business_id IN (...)
```

**Después:**
```typescript
// Verifica is_premium ANTES de actualizar
// Solo actualiza negocios que NO tienen is_premium = true
const nonPremiumVisible = Array.from(shouldBeVisible).filter((businessId: string) => {
  const business = businessesWithSubs?.find((b: any) => b.id === businessId);
  if (business?.is_premium === true) {
    return false; // NO tocar negocios premium
  }
  return true; // Solo actualizar negocios NO premium
});
```

**Resultado:**
- ✅ Negocios premium (`is_premium = true`) → **NO se tocan**
- ✅ Negocios NO premium → Se actualizan según `business_subscriptions` (sistema antiguo)

---

### 2. Trigger `handle_approval_request_status_change` Modificado

**Antes:**
```sql
-- Cuando se aprueba, siempre ponía is_public = true
UPDATE businesses SET is_public = true WHERE id = NEW.business_id;
```

**Después:**
```sql
-- Verifica is_premium antes de actualizar
SELECT is_premium INTO v_is_premium FROM businesses WHERE id = NEW.business_id;

UPDATE businesses SET 
  is_public = CASE 
    WHEN v_is_premium = true THEN is_public  -- Mantener (controlado por sistema nuevo)
    ELSE true  -- Solo poner true si NO es premium
  END
WHERE id = NEW.business_id;
```

**Resultado:**
- ✅ Negocios premium → `is_public` no se modifica (controlado por sistema nuevo)
- ✅ Negocios NO premium → `is_public = true` al aprobar

---

### 3. Sincronización Final de Datos

**Comandos Ejecutados:**
```sql
-- Sincronizar negocios premium
UPDATE businesses
SET is_premium = true, is_public = true, is_active = true
WHERE owner_id IN (SELECT id FROM profiles WHERE is_premium = true);

-- Ocultar negocios NO premium
UPDATE businesses
SET is_public = false
WHERE is_premium = false AND is_public = true;
```

**Resultado:**
- ✅ **2 negocios premium** son públicos: SALON YULISA, Mí Turnow Example
- ✅ **0 negocios NO premium** son públicos
- ✅ **16 negocios NO premium** están ocultos

---

## ✅ VERIFICACIÓN FINAL

### Estado de SALON YULISA:
```
✅ is_premium = true
✅ is_public = true
✅ is_active = true
✅ approval_status = 'approved'
✅ profile_is_premium = true
```

### Estado General:
```
premium_publicos: 2 ✅ (SALON YULISA, Mí Turnow Example)
no_premium_publicos: 0 ✅ (NINGUNO - perfecto)
premium_no_publicos: 0 ✅ (todos los premium son públicos)
no_premium_no_publicos: 16 ✅ (todos los no-premium están ocultos)
```

---

## 🔒 PROTECCIÓN FUTURA

### Sistema Unificado:
1. **Negocios Premium (RevenueCat/Google Play):**
   - Controlados por `sync_business_is_premium_trigger`
   - `is_public` se actualiza automáticamente cuando `profiles.is_premium` cambia
   - **Protegidos** de `sync-business-visibility` (no se tocan)

2. **Negocios NO Premium (Sistema Antiguo):**
   - Controlados por `sync-business-visibility` (si tienen `business_subscriptions`)
   - Solo se actualizan si `is_premium = false`

3. **Aprobación de Negocios:**
   - `handle_approval_request_status_change` verifica `is_premium` antes de actualizar `is_public`
   - Negocios premium no se afectan

---

## 📊 FLUJO ACTUALIZADO

### Flujo para Negocios Premium:
```
1. Usuario paga en Google Play
   ↓
2. RevenueCat Webhook → profiles.is_premium = true ✅
   ↓
3. sync_business_is_premium_trigger se dispara
   → businesses.is_premium = true
   → businesses.is_public = true ✅
   → businesses.is_active = true ✅
   ↓
4. sync-business-visibility se ejecuta (desde webhook PayPal)
   → Verifica is_premium = true
   → ⚠️ IGNORA el negocio (no lo toca) ✅
   ↓
5. Negocio permanece público ✅
```

### Flujo para Negocios NO Premium:
```
1. Usuario paga con PayPal/Stripe
   ↓
2. Webhook actualiza business_subscriptions.status = 'active'
   ↓
3. sync-business-visibility se ejecuta
   → Verifica is_premium = false
   → Actualiza is_public = true ✅
   ↓
4. Negocio se vuelve público ✅
```

---

## ✅ CONCLUSIÓN

**El "Jefe Oculto" ha sido eliminado:**

1. ✅ `sync-business-visibility` ahora respeta `is_premium`
2. ✅ `handle_approval_request_status_change` verifica `is_premium`
3. ✅ Solo negocios premium son públicos (SALON YULISA, Mí Turnow Example)
4. ✅ Negocios NO premium están ocultos
5. ✅ Los cambios ya no se revierten automáticamente

**SALON YULISA ahora debería aparecer en la App Cliente correctamente.**

---

## 📝 NOTAS ADICIONALES

- La función `sync-business-visibility` sigue activa pero ahora es **segura** (respeta `is_premium`)
- Las llamadas desde webhooks antiguos ya no causan problemas
- El sistema está completamente unificado con `is_premium` como fuente única de verdad para negocios premium

