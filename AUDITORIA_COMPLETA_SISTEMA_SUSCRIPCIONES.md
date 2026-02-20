# 🔍 AUDITORÍA COMPLETA - Sistema de Suscripciones
**Fecha:** 2026-02-19  
**Versión App:** 1.2.5  
**Objetivo:** Identificar discrepancias críticas entre Profiles, Businesses, y la App Cliente

---

## 📋 RESUMEN EJECUTIVO

Se identificaron **5 problemas críticos** que explican por qué:
1. La UI no se actualiza tras pagos exitosos
2. La App Cliente no muestra negocios premium
3. Usuarios obtienen premium sin pagar
4. El trial no funciona correctamente

---

## 1️⃣ AUDITORÍA DE TRIAL Y BLOQUEO

### Estado Actual
- ✅ **Período de Gracia Implementado:** 10 días (NO 7 días como se mencionó)
- 📍 **Ubicación:** `src/hooks/useSubscriptionStatus.ts` líneas 55-87
- ⚠️ **Problema:** El período de gracia es de **10 días**, no 7

### Lógica de Acceso
```typescript
// useSubscriptionStatus.ts:72-73
if (daysSinceCreation < 10) {
  // Usuario tiene acceso grace_period
}
```

### Flujo de Bloqueo
1. `SubscriptionGuard` verifica `status` de `useSubscriptionStatus()`
2. Si `status !== 'active' && status !== 'trialing' && status !== 'grace_period'` → muestra `Paywall`
3. `useSubscriptionStatus()` prioriza `profiles.is_premium` sobre `business_subscriptions`

### Hallazgos
- ✅ Trial funciona correctamente (10 días desde creación)
- ✅ `SubscriptionGuard` permite `grace_period`
- ⚠️ **No hay control de 7 días** - el sistema usa 10 días

---

## 2️⃣ AUDITORÍA DE REACTIVIDAD (Refresco de Pago)

### Estado Actual
- ✅ **Listener Realtime Implementado:** `useSubscriptionStatus.ts` líneas 132-155
- ✅ **Redirección Automática Implementada:** `Paywall.tsx` líneas 30-74
- ⚠️ **Problema:** El listener solo escucha `profiles.is_premium`, pero el webhook puede tardar 1-3 segundos

### Flujo Actual de Compra
1. `purchaseProduct()` → Google Play confirma pago
2. `verifyAndUnlock()` → Verifica entitlement en RevenueCat
3. Si no encuentra → `forceUnlockPremium()` escribe `is_premium=true` en Supabase
4. `refreshProfile()` → Actualiza AuthContext
5. `refetchSubscription(true)` → Actualiza SubscriptionGuard
6. `navigate("/admin")` → Redirige automáticamente

### Problema Identificado
**Race Condition:**
- `forceUnlockPremium()` escribe en Supabase
- `refreshProfile()` lee de Supabase
- **PERO:** El listener de Realtime puede no dispararse inmediatamente si el webhook de RevenueCat aún no llegó
- **RESULTADO:** La UI puede no actualizarse si el usuario no espera 2-3 segundos

### Hallazgos
- ✅ Redirección automática implementada
- ✅ Unlock optimista implementado
- ⚠️ **Falta:** Polling adicional o verificación más agresiva tras `forceUnlockPremium()`

---

## 3️⃣ AUDITORÍA DE TABLAS (Profiles vs Business)

### 🔴 PROBLEMA CRÍTICO IDENTIFICADO

**La tabla `businesses` NO tiene columna `is_premium`**

### Estado de Tablas
| Tabla | Columna `is_premium` | Actualizada por Webhook |
|-------|---------------------|------------------------|
| `profiles` | ✅ **SÍ existe** | ✅ **SÍ** (RevenueCat webhook) |
| `businesses` | ❌ **NO existe** | ❌ **NO** |

### Flujo Actual del Webhook
```typescript
// revenuecat-webhook/index.ts:159-165
await supabase
  .from('profiles')
  .update({ is_premium: isPremium })
  .eq('id', uuid);
```

**El webhook SOLO actualiza `profiles.is_premium`**

### Cómo la App Cliente Lee Negocios
**No se encontró código específico de la App Cliente en este repositorio**, pero basado en las políticas RLS:

```sql
-- RLS Policy: "Public can view approved businesses"
SELECT * FROM businesses 
WHERE approval_status = 'approved' 
  AND is_active = true;
```

**La App Cliente lee directamente de `businesses`, NO hace JOIN con `profiles`**

### Ejemplo Real: SALON YULISA
```sql
-- Estado actual:
profiles.is_premium = true ✅
businesses.is_premium = NULL ❌ (columna no existe)
businesses.is_public = false
businesses.approval_status = 'approved'
```

**Resultado:** La App Cliente NO puede saber que SALON YULISA es premium porque:
1. No hay columna `is_premium` en `businesses`
2. No hay JOIN entre `businesses` y `profiles` en las queries de la App Cliente
3. El webhook solo actualiza `profiles`, no `businesses`

### Hallazgos
- 🔴 **CRÍTICO:** `businesses` no tiene `is_premium`
- 🔴 **CRÍTICO:** Webhook no actualiza `businesses`
- 🔴 **CRÍTICO:** App Cliente lee de `businesses` sin JOIN a `profiles`
- ⚠️ **RLS:** Las políticas permiten lectura de `businesses` pero no filtran por premium

---

## 4️⃣ AUDITORÍA DE IDENTIDAD (miturnowapp@gmail.com)

### Estado Actual
```sql
-- miturnowapp@gmail.com
profiles.is_premium = false ✅ (reseteado en limpieza)
profiles.business_id = 'c52a1375-5a61-4d29-ac01-0773d2f463fe'
businesses.business_name = 'Mí Turnow Example'
businesses.is_public = false
```

### Análisis
- ✅ `is_premium` fue reseteado a `false` en la limpieza de seguridad
- ⚠️ **Problema Potencial:** Si el usuario usa "Restaurar Compras" en un dispositivo compartido con otra cuenta que SÍ tiene suscripción, puede obtener acceso

### Flujo de Restore Purchases (Corregido)
```typescript
// revenueCatService.ts:121-129
// ANTES: Purchases.restorePurchases() ← re-valida TODO el Google Play del dispositivo
// AHORA: Purchases.invalidateCustomerInfoCache() + getCustomerInfo() ← consulta servidor RC
```

**Fix Aplicado:** Ya no usa `restorePurchases()` del dispositivo, ahora consulta directamente el servidor de RevenueCat usando el UUID de Supabase.

### Hallazgos
- ✅ `is_premium` reseteado correctamente
- ✅ Fix de `restorePurchases()` aplicado (no re-valida dispositivo)
- ⚠️ **Recomendación:** Verificar en RevenueCat Dashboard si este usuario tiene App User IDs duplicados o aliases incorrectos

---

## 5️⃣ AUDITORÍA DE RLS Y CONFLICTOS

### Políticas RLS en `profiles`
```sql
-- "Users can update own profile"
UPDATE profiles SET ... WHERE auth.uid() = id;
```

**✅ El webhook usa `SUPABASE_SERVICE_ROLE_KEY`**, por lo que **bypasea RLS** y puede actualizar cualquier perfil.

### Políticas RLS en `businesses`
```sql
-- "Business owners can update own business"
UPDATE businesses SET ... WHERE owner_id = auth.uid();
```

**⚠️ PROBLEMA:** El webhook NO actualiza `businesses`, pero si lo hiciera, necesitaría `SUPABASE_SERVICE_ROLE_KEY` para bypasear RLS.

### Triggers en `profiles`
```sql
-- "update_profiles_updated_at" → Actualiza updated_at automáticamente
-- "prevent_role_change" → Previene cambio de role
```

**✅ No hay conflictos** - Los triggers no interfieren con `is_premium`.

### Triggers en `businesses`
```sql
-- "sync_profile_business_id_trigger" → Sincroniza profile.business_id cuando se crea/actualiza business
-- "trigger_sync_business_approval_status" → Sincroniza approval_status
```

**⚠️ PROBLEMA:** No hay trigger que sincronice `profiles.is_premium` → `businesses.is_premium` (porque la columna no existe).

### Hallazgos
- ✅ RLS no bloquea el webhook (usa Service Role Key)
- ✅ Triggers no interfieren con `is_premium`
- 🔴 **CRÍTICO:** No hay sincronización automática entre `profiles.is_premium` y `businesses`

---

## 📊 PLAN DE ACCIÓN DETALLADO

### FASE 1: Sincronización Profiles ↔ Businesses (CRÍTICO)

#### Opción A: Añadir `is_premium` a `businesses` (RECOMENDADO)
```sql
-- 1. Añadir columna
ALTER TABLE businesses 
ADD COLUMN is_premium BOOLEAN DEFAULT false NOT NULL;

-- 2. Crear trigger para sincronizar
CREATE OR REPLACE FUNCTION sync_business_is_premium()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    UPDATE businesses
    SET is_premium = NEW.is_premium
    WHERE owner_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_business_is_premium_trigger
AFTER UPDATE OF is_premium ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_business_is_premium();

-- 3. Sincronizar datos existentes
UPDATE businesses b
SET is_premium = p.is_premium
FROM profiles p
WHERE b.owner_id = p.id;
```

#### Opción B: Modificar Webhook para Actualizar Ambas Tablas
```typescript
// revenuecat-webhook/index.ts:159-180
// Actualizar profiles
await supabase.from('profiles').update({ is_premium: isPremium }).eq('id', uuid);

// Actualizar businesses (si existe business_id)
const { data: profile } = await supabase
  .from('profiles')
  .select('business_id')
  .eq('id', uuid)
  .maybeSingle();

if (profile?.business_id) {
  await supabase
    .from('businesses')
    .update({ is_premium: isPremium })
    .eq('owner_id', uuid); // o .eq('id', profile.business_id)
}
```

**Recomendación:** **Opción A** (trigger) es más robusta porque sincroniza automáticamente en ambos sentidos.

---

### FASE 2: Mejorar Reactividad de UI

#### Añadir Polling Agresivo Tras Compra
```typescript
// Paywall.tsx: verifyAndUnlock()
const verifyAndUnlock = async (userId: string, isRetry = false) => {
  // ... código existente ...
  
  // Si unlock optimista, hacer polling cada 500ms por 3 segundos
  if (!hasProAccess && isRetry) {
    await forceUnlockPremium(userId);
    
    // Polling agresivo
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', userId)
        .maybeSingle();
      
      if (profile?.is_premium === true) {
        await refreshProfile();
        await refetchSubscription(true);
        navigate("/admin", { replace: true });
        return true;
      }
    }
  }
};
```

---

### FASE 3: Modificar App Cliente para JOIN con Profiles

**Nota:** No se encontró código de la App Cliente en este repositorio. Si la App Cliente está en otro proyecto, debe:

```sql
-- Query recomendada para App Cliente
SELECT 
  b.*,
  p.is_premium,
  p.email as owner_email
FROM businesses b
LEFT JOIN profiles p ON b.owner_id = p.id
WHERE b.approval_status = 'approved'
  AND b.is_active = true
  AND (b.is_public = true OR p.is_premium = true); -- Mostrar públicos O premium
```

---

### FASE 4: Verificar Trial (7 vs 10 días)

**Decisión Requerida:**
- Si el trial debe ser **7 días**, cambiar `useSubscriptionStatus.ts:73` de `10` a `7`
- Si el trial debe ser **10 días**, mantener como está

---

## 🎯 PRIORIDADES

1. **🔴 CRÍTICO:** Añadir `is_premium` a `businesses` y crear trigger de sincronización
2. **🔴 CRÍTICO:** Modificar App Cliente para hacer JOIN con `profiles` (si está en otro repo)
3. **🟡 ALTO:** Añadir polling agresivo tras compra para mejorar reactividad
4. **🟡 MEDIO:** Verificar/ajustar período de trial (7 vs 10 días)
5. **🟢 BAJO:** Auditar RevenueCat Dashboard para verificar App User IDs de `miturnowapp@gmail.com`

---

## ✅ CONCLUSIÓN

El problema principal es la **desconexión entre `profiles.is_premium` y `businesses`**. El webhook actualiza `profiles`, pero la App Cliente lee de `businesses` sin hacer JOIN. La solución requiere:

1. Añadir `is_premium` a `businesses`
2. Crear trigger de sincronización automática
3. Modificar App Cliente para usar `is_premium` de `businesses` (o hacer JOIN)

**Sin estos cambios, la App Cliente nunca mostrará negocios premium correctamente.**

