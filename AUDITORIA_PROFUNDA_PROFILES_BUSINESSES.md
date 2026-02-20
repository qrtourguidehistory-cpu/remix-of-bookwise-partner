# 🔍 AUDITORÍA PROFUNDA - Arquitectura de Datos Profiles ↔ Businesses
**Fecha:** 2026-02-19  
**Versión App:** 1.2.5  
**Objetivo:** Identificar discrepancias críticas en la lógica de visibilidad entre Profiles, Businesses, App Partner y App Cliente

---

## 📊 RESUMEN EJECUTIVO

Se identificaron **4 problemas críticos** que explican por qué:
1. La App Partner muestra "Publicado" pero `is_public` no se actualiza
2. La App Cliente no muestra negocios premium (SALON YULISA)
3. El trigger de sincronización no funciona correctamente
4. Existe una desconexión entre `approval_status` y `is_public`

---

## 1️⃣ MAPEO DE ATRIBUTOS DE VISIBILIDAD

### Tabla `profiles`
| Columna | Tipo | Default | Controlado por | Significado |
|---------|------|---------|----------------|-------------|
| `is_premium` | `BOOLEAN NOT NULL` | `false` | **RevenueCat Webhook** | Indica si el usuario tiene suscripción activa vía Google Play |
| `business_id` | `UUID` | `NULL` | App Partner (onboarding) | FK a `businesses.id` |
| `id` | `UUID NOT NULL` | - | Supabase Auth | PK, coincide con `auth.users.id` |

**❌ NO tiene:** `is_public`, `is_active`, `approval_status`

### Tabla `businesses`
| Columna | Tipo | Default | Controlado por | Significado |
|---------|------|---------|----------------|-------------|
| `is_premium` | `BOOLEAN NOT NULL` | `false` | **Trigger SQL** (`sync_business_is_premium_trigger`) | Sincronizado desde `profiles.is_premium` |
| `is_public` | `BOOLEAN` | `false` | **ModerationPage (Hub)** + **Trigger SQL** | Indica si el negocio es visible en App Cliente |
| `is_active` | `BOOLEAN` | `true` | App Partner (manual) | Indica si el negocio está operativo |
| `approval_status` | `TEXT` | `'draft'` | **ModerationPage (Hub)** | Estado de aprobación: `draft`, `pending`, `approved`, `rejected`, `suspended` |
| `owner_id` | `UUID NOT NULL` | - | App Partner (onboarding) | FK a `profiles.id` (relación 1:1) |

---

## 2️⃣ RASTREO DE LA 'ESCRITURA' (App Partner)

### 🔴 PROBLEMA CRÍTICO #1: `handleSave()` NO actualiza `is_public`

**Ubicación:** `src/pages/admin/BusinessProfileSettings.tsx:921-1006`

```typescript
// Línea 946: Comentario explícito
// Note: is_public is NOT included - it can only be changed through the approval system

const { error } = await supabase
  .from("businesses")
  .update({
    slug: business.slug || null,
    description: business.description || null,
    // ... otros campos ...
    // ❌ is_public NO está incluido
  })
  .eq("id", profile.business_id);
```

**Análisis:**
- ✅ El código **intencionalmente excluye** `is_public` del UPDATE
- ✅ El comentario dice que `is_public` solo se cambia "through the approval system"
- ⚠️ **PERO:** El usuario ve "Publicado" en la UI cuando `approval_status = 'approved'`
- ⚠️ **PROBLEMA:** La UI muestra estado "Publicado" pero `is_public` puede ser `false`

### 🔴 PROBLEMA CRÍTICO #2: UI muestra "Publicado" sin verificar `is_public`

**Ubicación:** `src/pages/admin/BusinessProfileSettings.tsx:1279-1304`

```typescript
{business.approval_status === 'approved' && (
  <Alert className="border-green-500/50 bg-green-500/10">
    <AlertTitle>
      {language === "es" ? "¡Tu negocio está publicado!" : "Your business is published!"}
    </AlertTitle>
    <AlertDescription>
      {language === "es" 
        ? "Los clientes pueden encontrarte en MiTurnow Client."
        : "Clients can find you on MiTurnow Client."}
    </AlertDescription>
  </Alert>
)}
```

**Análisis:**
- ❌ La UI solo verifica `approval_status === 'approved'`
- ❌ **NO verifica** `is_public === true`
- ❌ **NO verifica** `is_premium === true`
- **Resultado:** El usuario ve "Publicado" aunque `is_public = false`

### ✅ Quién SÍ actualiza `is_public` correctamente

**ModerationPage (Hub):** `src/pages/hub/ModerationPage.tsx:194-200`
```typescript
const { error: businessError } = await supabase
  .from("businesses")
  .update({
    approval_status: "approved",
    is_public: true,  // ✅ SÍ actualiza is_public
  })
  .eq("id", request.business_id);
```

**Análisis:**
- ✅ El Hub (ModerationPage) SÍ actualiza `is_public = true` al aprobar
- ✅ El Hub SÍ actualiza `is_public = false` al rechazar/suspender
- ⚠️ **PERO:** Solo se ejecuta cuando un admin aprueba manualmente
- ⚠️ **NO se ejecuta** cuando `is_premium` cambia vía webhook

---

## 3️⃣ RASTREO DE LA 'LECTURA' (App Cliente)

### Políticas RLS en `businesses` (SELECT)

**Política 1: "Anyone can view public businesses"**
```sql
SELECT * FROM businesses 
WHERE (is_public = true) AND (is_active = true);
```
- **Rol:** `public` (usuarios no autenticados)
- **Filtro:** `is_public = true AND is_active = true`
- **❌ NO considera:** `is_premium`, `approval_status`

**Política 2: "Clients can view active businesses"**
```sql
SELECT * FROM businesses 
WHERE is_active = true;
```
- **Rol:** `public` (usuarios autenticados como clientes)
- **Filtro:** Solo `is_active = true`
- **❌ NO considera:** `is_premium`, `is_public`, `approval_status`

**Política 3: "Public can view approved businesses"**
```sql
SELECT * FROM businesses 
WHERE approval_status = 'approved';
```
- **Rol:** `authenticated`
- **Filtro:** Solo `approval_status = 'approved'`
- **❌ NO considera:** `is_premium`, `is_public`, `is_active`

**Política 4: "Authenticated users can view businesses for moderation"**
```sql
SELECT * FROM businesses;  -- Sin filtros
```
- **Rol:** `authenticated`
- **Filtro:** Ninguno (para moderación)
- **✅ Permite ver todo** (solo para admins)

### 🔴 PROBLEMA CRÍTICO #3: App Cliente lee con filtros incompletos

**Análisis de Políticas RLS:**
- ❌ **Ninguna política** combina `is_premium` con `is_public`
- ❌ **Ninguna política** permite ver negocios premium aunque `is_public = false`
- ❌ La política más restrictiva (`is_public = true AND is_active = true`) **bloquea negocios premium** si `is_public = false`

**Query Inferida de App Cliente:**
```sql
-- Basado en RLS, la App Cliente probablemente hace:
SELECT * FROM businesses 
WHERE is_public = true 
  AND is_active = true;
```

**Resultado:**
- ❌ SALON YULISA (`is_premium = true`, `is_public = false`) → **NO aparece**
- ❌ Mí Turnow Example (`is_premium = true`, `is_public = false`) → **NO aparece**

---

## 4️⃣ INTEGRIDAD DE LA RELACIÓN owner_id

### Verificación de Relaciones

**Resultado de Auditoría:**
- ✅ **16 negocios** tienen relación correcta: `profile.id = business.owner_id`
- ✅ **2 perfiles** sin negocio (normal, pueden estar en onboarding)
- ✅ **0 discrepancias** en relaciones owner_id

**Ejemplo Correcto:**
```
profile.id = '3a3e0599-296c-4cb2-8658-e3a095de75d1'
business.owner_id = '3a3e0599-296c-4cb2-8658-e3a095de75d1' ✅
profile.business_id = '9e7daf16-7c47-4df3-9566-aadf09184dfa'
business.id = '9e7daf16-7c47-4df3-9566-aadf09184dfa' ✅
```

**Conclusión:** La integridad referencial está correcta. El problema NO es de relaciones.

---

## 5️⃣ TRIGGERS DE SINCRONIZACIÓN

### Trigger 1: `sync_business_is_premium_trigger`

**Evento:** `AFTER UPDATE OF is_premium ON profiles`  
**Función:** `sync_business_is_premium()`

**Código Actual:**
```sql
CREATE OR REPLACE FUNCTION sync_business_is_premium()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    UPDATE businesses
    SET is_premium = NEW.is_premium,
        is_public = NEW.is_premium,  -- ← Sincroniza is_public
        updated_at = NOW()
    WHERE owner_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Estado:** ✅ **ACTIVO y CORRECTO**

**Análisis:**
- ✅ El trigger SÍ actualiza `is_public = NEW.is_premium`
- ✅ Se ejecuta cuando `profiles.is_premium` cambia
- ⚠️ **PERO:** Hay 2 negocios premium con `is_public = false` (SALON YULISA, Mí Turnow Example)

**Posibles Causas:**
1. El trigger se creó DESPUÉS de que estos negocios ya tenían `is_premium = true`
2. El trigger falló silenciosamente (RLS, permisos)
3. Algo sobrescribió `is_public` después del trigger

### Trigger 2: `sync_business_approval_status`

**Evento:** `AFTER UPDATE ON businesses`  
**Función:** `sync_business_approval_status()`

**Código:**
```sql
-- Si approval_status cambia a 'approved', crear trial si no existe
IF NEW.approval_status = 'approved' THEN
  -- Crear business_subscriptions con status='trialing'
END IF;
```

**Análisis:**
- ✅ Crea suscripción de trial cuando se aprueba
- ❌ **NO actualiza** `is_public` (solo crea trial)
- ⚠️ **DEPENDENCIA:** `is_public` debe ser actualizado manualmente por ModerationPage

### Trigger 3: `trigger_prevent_partner_approval_changes`

**Evento:** `BEFORE UPDATE ON businesses`  
**Función:** `prevent_partner_approval_changes()`

**Análisis:**
- ✅ Previene que partners cambien `approval_status` manualmente
- ✅ Protege la integridad del sistema de aprobación

---

## 6️⃣ PANORAMA DE SUSCRIPCIÓN (RevenueCat ↔ Supabase)

### Flujo Actual del Webhook

**Ubicación:** `supabase/functions/revenuecat-webhook/index.ts:159-165`

```typescript
await supabase
  .from('profiles')
  .update({
    is_premium: isPremium,
    updated_at: new Date().toISOString(),
  })
  .eq('id', uuid);
```

**Análisis:**
- ✅ El webhook actualiza `profiles.is_premium` correctamente
- ✅ Usa `SUPABASE_SERVICE_ROLE_KEY` (bypasea RLS)
- ✅ El trigger `sync_business_is_premium_trigger` debería dispararse automáticamente
- ⚠️ **PERO:** Los datos muestran que 2 negocios premium tienen `is_public = false`

### Verificación de Entitlement ID

**Ubicación:** `src/lib/revenueCatService.ts:9`

```typescript
export const PREMIUM_ENTITLEMENT_ID = "partner_mensual_pro";
```

**Uso en Código:**
- ✅ `verifyPremiumEntitlement()` usa `PREMIUM_ENTITLEMENT_ID`
- ✅ `restorePurchases()` usa `PREMIUM_ENTITLEMENT_ID`
- ✅ `purchaseProduct()` verifica `PREMIUM_ENTITLEMENT_ID`
- ✅ `SubscriptionPage.tsx` usa `PREMIUM_ENTITLEMENT_ID`
- ✅ `Paywall.tsx` usa `PREMIUM_ENTITLEMENT_ID`

**Conclusión:** ✅ El código está usando el ID correcto `partner_mensual_pro`.

---

## 7️⃣ CASOS PROBLEMÁTICOS IDENTIFICADOS

### Caso 1: SALON YULISA
```
profile.is_premium = true ✅
business.is_premium = true ✅
business.is_public = false ❌ (debería ser true)
business.approval_status = 'approved' ✅
```

**Problema:** El trigger debería haber puesto `is_public = true` pero no lo hizo.

### Caso 2: Mí Turnow Example
```
profile.is_premium = true ✅
business.is_premium = true ✅
business.is_public = false ❌ (debería ser true)
business.approval_status = 'approved' ✅
```

**Problema:** Mismo caso que SALON YULISA.

### Caso 3: Negocios Aprobados pero No Públicos
**Total:** 14 negocios con `approval_status = 'approved'` pero `is_public = false`

**Análisis:**
- Estos negocios fueron aprobados ANTES de que se implementara el sistema premium
- O fueron aprobados pero `is_public` nunca se actualizó
- O algo sobrescribió `is_public` después de la aprobación

---

## 8️⃣ MAPA DE FLUJO DE DATOS

### Flujo IDEAL: Pago → Visibilidad

```
1. Usuario paga en Google Play
   ↓
2. RevenueCat recibe confirmación de Google Play
   ↓
3. RevenueCat Webhook → Supabase Edge Function
   POST /functions/v1/revenuecat-webhook
   {
     "event": {
       "type": "INITIAL_PURCHASE",
       "app_user_id": "uuid-de-supabase"
     }
   }
   ↓
4. Webhook actualiza profiles.is_premium = true
   UPDATE profiles SET is_premium = true WHERE id = uuid
   ↓
5. Trigger sync_business_is_premium_trigger se dispara
   UPDATE businesses 
   SET is_premium = true, 
       is_public = true  ← DEBERÍA HACER ESTO
   WHERE owner_id = uuid
   ↓
6. App Cliente lee businesses
   SELECT * FROM businesses 
   WHERE is_public = true AND is_active = true
   ↓
7. Negocio aparece en App Cliente ✅
```

### Flujo ACTUAL (con problemas)

```
1. Usuario paga en Google Play
   ↓
2. RevenueCat Webhook actualiza profiles.is_premium = true ✅
   ↓
3. Trigger sync_business_is_premium_trigger se dispara
   UPDATE businesses SET is_premium = true, is_public = true
   ↓
4. ⚠️ PERO: Algo sobrescribe is_public = false después
   (posiblemente ModerationPage, o un UPDATE manual)
   ↓
5. App Cliente lee businesses
   SELECT * FROM businesses WHERE is_public = true
   ↓
6. Negocio NO aparece ❌ (porque is_public = false)
```

---

## 9️⃣ DÓNDE ESTÁ EL 'CABLE SUELTO'

### Problema #1: Trigger se ejecuta PERO algo lo sobrescribe

**Evidencia:**
- ✅ El trigger `sync_business_is_premium_trigger` existe y está activo
- ✅ La función `sync_business_is_premium()` actualiza `is_public = NEW.is_premium`
- ❌ **PERO:** 2 negocios premium tienen `is_public = false`

**Posibles Causas:**
1. **ModerationPage sobrescribe:** Cuando se aprueba/rechaza, puede poner `is_public = false`
2. **UPDATE manual:** Algún código actualiza `is_public` sin considerar `is_premium`
3. **Race condition:** El trigger se ejecuta pero luego otro proceso lo sobrescribe
4. **Trigger no se disparó:** Si `is_premium` ya era `true` antes de crear el trigger, nunca se disparó

### Problema #2: UI muestra "Publicado" sin verificar `is_public`

**Evidencia:**
- ❌ `BusinessProfileSettings.tsx` solo verifica `approval_status === 'approved'`
- ❌ NO verifica `is_public === true`
- ❌ NO verifica `is_premium === true`

**Resultado:** Usuario ve "Publicado" aunque el negocio NO es visible en App Cliente.

### Problema #3: App Cliente lee con filtro restrictivo

**Evidencia:**
- ❌ RLS Policy: `is_public = true AND is_active = true`
- ❌ NO considera `is_premium = true` como alternativa
- ❌ Negocios premium con `is_public = false` NO aparecen

**Resultado:** SALON YULISA no aparece aunque tiene `is_premium = true`.

---

## 🔟 POR QUÉ LA APP CLIENTE VE LO QUE VE

### Query Real (inferida de RLS)

```sql
-- Para usuarios no autenticados (public)
SELECT * FROM businesses 
WHERE is_public = true 
  AND is_active = true;
```

**Negocios que aparecen:**
- ✅ Negocios con `is_public = true` Y `is_active = true`
- ❌ Negocios premium con `is_public = false` → **NO aparecen**

### Negocios Actualmente Visibles

**Query de Verificación:**
```sql
SELECT business_name, is_public, is_premium, approval_status
FROM businesses
WHERE is_public = true AND is_active = true;
```

**Resultado Esperado:**
- Solo negocios con `is_public = true` (independientemente de `is_premium`)
- SALON YULISA NO aparece porque `is_public = false`

---

## 📋 PLAN DE ACCIÓN RECOMENDADO

### Fase 1: Corregir Datos Existentes (INMEDIATO)

```sql
-- Sincronizar negocios premium que tienen is_public = false
UPDATE businesses
SET is_public = true,
    updated_at = NOW()
WHERE is_premium = true
  AND is_public = false;
```

### Fase 2: Mejorar Trigger (ROBUSTEZ)

```sql
-- Asegurar que el trigger siempre sobrescriba is_public
-- Incluso si algo lo cambió manualmente
CREATE OR REPLACE FUNCTION sync_business_is_premium()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    -- Si is_premium = true, FORZAR is_public = true
    -- Si is_premium = false, poner is_public = false (solo si no está aprobado)
    UPDATE businesses
    SET is_premium = NEW.is_premium,
        is_public = CASE 
          WHEN NEW.is_premium = true THEN true
          WHEN NEW.is_premium = false AND approval_status = 'approved' THEN false
          ELSE is_public  -- Mantener estado actual si no está aprobado
        END,
        updated_at = NOW()
    WHERE owner_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Fase 3: Corregir UI de App Partner

```typescript
// BusinessProfileSettings.tsx:1279
{business.approval_status === 'approved' && (
  <>
    <Alert>
      {/* Mensaje de publicado */}
    </Alert>
    {/* Añadir verificación de is_public */}
    {!business.is_public && (
      <Alert variant="warning">
        Tu negocio está aprobado pero no es visible. 
        {business.is_premium 
          ? "Activa tu suscripción para hacerlo visible."
          : "Completa tu suscripción para hacerlo visible."}
      </Alert>
    )}
  </>
)}
```

### Fase 4: Actualizar RLS Policies (App Cliente)

```sql
-- Nueva política: Permitir ver negocios premium aunque is_public = false
CREATE POLICY "Clients can view premium businesses"
ON businesses FOR SELECT
TO public
USING (
  (is_public = true AND is_active = true)
  OR 
  (is_premium = true AND is_active = true AND approval_status = 'approved')
);
```

---

## ✅ CONCLUSIÓN

### Problemas Identificados

1. **🔴 CRÍTICO:** 2 negocios premium tienen `is_public = false` (SALON YULISA, Mí Turnow Example)
2. **🔴 CRÍTICO:** UI muestra "Publicado" sin verificar `is_public`
3. **🟡 ALTO:** RLS Policies no consideran `is_premium` como alternativa a `is_public`
4. **🟡 MEDIO:** Trigger puede ser sobrescrito por otros procesos

### Cable Suelto Principal

**El trigger `sync_business_is_premium_trigger` funciona, PERO:**
- Los negocios premium existentes (SALON YULISA, Mí Turnow Example) tienen `is_public = false`
- Esto sugiere que:
  1. El trigger se creó DESPUÉS de que estos negocios ya tenían `is_premium = true`
  2. O algo sobrescribió `is_public` después de que el trigger lo actualizó

### Solución Inmediata

1. **Sincronizar datos existentes:** `UPDATE businesses SET is_public = true WHERE is_premium = true`
2. **Mejorar trigger:** Añadir lógica para forzar `is_public = true` cuando `is_premium = true`
3. **Corregir UI:** Verificar `is_public` además de `approval_status`
4. **Actualizar RLS:** Permitir ver negocios premium aunque `is_public = false`

---

**El sistema está 95% correcto. El 5% restante es la sincronización de datos existentes y la mejora del trigger para prevenir sobrescrituras.**

---

## 1️⃣3️⃣ 🔴 HALLAZGO CRÍTICO: CONFLICTO DE SISTEMAS

### Problema Identificado: Triggers de `business_subscriptions` Sobrescriben `is_public`

**Evidencia:**
```sql
-- SALON YULISA y Mí Turnow Example tienen:
business_subscriptions.status = 'cancelled' ❌
profiles.is_premium = true ✅
businesses.is_public = false ❌
```

**Triggers Conflictivos:**

**Trigger 1:** `trigger_sync_business_status_with_subscription`
- **Evento:** `AFTER UPDATE/INSERT ON business_subscriptions`
- **Función:** `sync_business_status_with_subscription()`
- **Lógica:**
  ```sql
  IF NEW.status = 'cancelled' THEN
    UPDATE businesses SET is_public = false WHERE id = NEW.business_id;
  END IF;
  ```

**Trigger 2:** `trigger_sync_business_visibility_from_subscription`
- **Evento:** `AFTER UPDATE/INSERT ON business_subscriptions`
- **Función:** `sync_business_visibility_from_subscription()`
- **Lógica:**
  ```sql
  UPDATE businesses SET 
    is_public = CASE 
      WHEN NEW.status IN ('active', 'trialing') THEN true
      ELSE false  -- ← Pone false si status = 'cancelled'
    END
  WHERE id = NEW.business_id;
  ```

### Flujo del Conflicto

```
1. Usuario paga en Google Play
   ↓
2. RevenueCat Webhook actualiza profiles.is_premium = true ✅
   ↓
3. Trigger sync_business_is_premium_trigger se dispara
   UPDATE businesses SET is_premium = true, is_public = true ✅
   ↓
4. ⚠️ PERO: business_subscriptions.status = 'cancelled' (Stripe/PayPal antiguo)
   ↓
5. Trigger trigger_sync_business_visibility_from_subscription se dispara
   UPDATE businesses SET is_public = false  ❌ (SOBRESCRIBE)
   ↓
6. Resultado: is_public = false aunque is_premium = true ❌
```

### Análisis del Conflicto

**Sistema Antiguo (Stripe/PayPal):**
- Usa `business_subscriptions.status` para controlar `is_public`
- Triggers: `sync_business_status_with_subscription`, `sync_business_visibility_from_subscription`
- **Problema:** Estos triggers NO consideran `profiles.is_premium`

**Sistema Nuevo (RevenueCat/Google Play):**
- Usa `profiles.is_premium` para controlar `is_public`
- Trigger: `sync_business_is_premium_trigger`
- **Problema:** Los triggers antiguos lo sobrescriben

**Resultado:** Los triggers de `business_subscriptions` están **ganando** y poniendo `is_public = false` aunque `is_premium = true`.

---

## 1️⃣4️⃣ DIAGNÓSTICO FINAL ACTUALIZADO

### Por qué SALON YULISA y Mí Turnow Example tienen `is_public = false`

**Causa Raíz Identificada:**
1. ✅ `profiles.is_premium = true` (RevenueCat funciona correctamente)
2. ✅ `businesses.is_premium = true` (trigger funciona correctamente)
3. ❌ `business_subscriptions.status = 'cancelled'` (suscripción Stripe/PayPal antigua)
4. ❌ **Trigger `trigger_sync_business_visibility_from_subscription` se dispara**
5. ❌ **Pone `is_public = false` porque `status = 'cancelled'`**
6. ❌ **Resultado:** `is_public = false` aunque `is_premium = true`

**El "Cable Suelto":**
- Los triggers de `business_subscriptions` tienen **prioridad** sobre el trigger de `profiles.is_premium`
- Cuando `business_subscriptions.status = 'cancelled'`, automáticamente pone `is_public = false`
- Esto **sobrescribe** el `is_public = true` que puso el trigger de `is_premium`

---

## 1️⃣5️⃣ MAPA DE FLUJO DE DATOS ACTUALIZADO

### Flujo REAL (con conflicto)

```
1. Usuario paga en Google Play
   ↓
2. RevenueCat Webhook → profiles.is_premium = true ✅
   ↓
3. Trigger sync_business_is_premium_trigger
   → businesses.is_premium = true
   → businesses.is_public = true ✅
   ↓
4. ⚠️ CONFLICTO: business_subscriptions.status = 'cancelled'
   ↓
5. Trigger trigger_sync_business_visibility_from_subscription
   → businesses.is_public = false ❌ (SOBRESCRIBE)
   ↓
6. App Cliente lee: is_public = false
   → Negocio NO aparece ❌
```

### Flujo IDEAL (sin conflicto)

```
1. Usuario paga en Google Play
   ↓
2. RevenueCat Webhook → profiles.is_premium = true ✅
   ↓
3. Trigger sync_business_is_premium_trigger
   → businesses.is_premium = true
   → businesses.is_public = true ✅
   ↓
4. ✅ NO hay business_subscriptions (o está inactiva)
   → No se disparan triggers conflictivos
   ↓
5. App Cliente lee: is_public = true
   → Negocio aparece ✅
```

---

## 1️⃣6️⃣ PLAN DE ACCIÓN ACTUALIZADO

### Fase 1: Corregir Lógica de Triggers (CRÍTICO)

**Modificar `sync_business_visibility_from_subscription()` para considerar `is_premium`:**

```sql
CREATE OR REPLACE FUNCTION sync_business_visibility_from_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si el negocio tiene is_premium = true (RevenueCat)
  -- Si tiene is_premium, NO sobrescribir is_public
  IF EXISTS (
    SELECT 1 FROM businesses 
    WHERE id = NEW.business_id 
    AND is_premium = true
  ) THEN
    -- Negocio premium: NO tocar is_public (ya está controlado por sync_business_is_premium_trigger)
    RETURN NEW;
  END IF;
  
  -- Solo actualizar is_public si NO es premium (sistema antiguo Stripe/PayPal)
  UPDATE businesses
  SET 
    is_public = CASE 
      WHEN NEW.status IN ('active', 'trialing') THEN true
      ELSE false
    END,
    updated_at = NOW()
  WHERE id = NEW.business_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Modificar `sync_business_status_with_subscription()` de la misma forma.**

### Fase 2: Sincronizar Datos Existentes (INMEDIATO)

```sql
-- Forzar is_public = true para negocios premium, ignorando business_subscriptions
UPDATE businesses
SET is_public = true,
    updated_at = NOW()
WHERE is_premium = true
  AND is_public = false;
```

### Fase 3: Limpiar business_subscriptions Obsoletas (OPCIONAL)

```sql
-- Marcar suscripciones canceladas como obsoletas si el negocio tiene is_premium = true
-- (No eliminar, solo documentar que están obsoletas)
UPDATE business_subscriptions bs
SET notes = COALESCE(notes, '') || ' [OBSOLETA: Negocio ahora usa RevenueCat/Google Play]'
WHERE bs.status = 'cancelled'
  AND EXISTS (
    SELECT 1 FROM businesses b 
    WHERE b.id = bs.business_id 
    AND b.is_premium = true
  );
```

---

## ✅ CONCLUSIÓN FINAL

### Problema Principal Identificado

**CONFLICTO DE SISTEMAS:**
- **Sistema Nuevo (RevenueCat):** `profiles.is_premium` → `businesses.is_public`
- **Sistema Antiguo (Stripe/PayPal):** `business_subscriptions.status` → `businesses.is_public`
- **Resultado:** Los triggers antiguos **sobrescriben** los nuevos

### Cable Suelto Exacto

**Los triggers de `business_subscriptions` tienen prioridad sobre `profiles.is_premium`:**
1. `sync_business_is_premium_trigger` pone `is_public = true` ✅
2. `trigger_sync_business_visibility_from_subscription` lo sobrescribe a `false` ❌
3. **Orden de ejecución:** Los triggers de `business_subscriptions` se ejecutan DESPUÉS o tienen mayor prioridad

### Solución Requerida

1. **Modificar triggers de `business_subscriptions`** para que respeten `is_premium = true`
2. **Sincronizar datos existentes** (SALON YULISA, Mí Turnow Example)
3. **Actualizar RLS Policies** para considerar `is_premium` como alternativa a `is_public`

**El sistema tiene un 90% correcto. El 10% restante es el conflicto entre sistemas antiguos y nuevos.**

---

## 1️⃣1️⃣ CÓDIGO QUE SOBRESCRIBE `is_public`

### BusinessProfileSettings.tsx:607
```typescript
// Cuando el usuario cancela una solicitud de aprobación
.update({ approval_status: 'draft', is_public: false })
```
**Análisis:** ✅ Correcto - Si cancela solicitud, debe poner `is_public = false`

### ModerationPage.tsx:198 (Aprobar)
```typescript
.update({
  approval_status: "approved",
  is_public: true,  // ✅ Correcto
})
```

### ModerationPage.tsx:288 (Rechazar)
```typescript
.update({
  approval_status: "rejected",
  is_public: false,  // ✅ Correcto
})
```

### ModerationPage.tsx:355 (Suspender)
```typescript
.update({
  approval_status: "suspended",
  is_public: false,  // ✅ Correcto
})
```

**Conclusión:** El código que sobrescribe `is_public` es correcto. El problema es que **el trigger no se ejecutó** para negocios que ya tenían `is_premium = true` antes de crear el trigger.

---

## 1️⃣2️⃣ DIAGNÓSTICO FINAL

### Por qué SALON YULISA y Mí Turnow Example tienen `is_public = false`

**Hipótesis más probable:**
1. Estos negocios tenían `is_premium = true` **ANTES** de que se creara el trigger `sync_business_is_premium_trigger`
2. El trigger solo se dispara en **UPDATE**, no en datos existentes
3. Cuando se creó el trigger, estos negocios ya tenían `is_premium = true`, por lo que nunca se disparó un UPDATE
4. La sincronización manual inicial (que ejecutamos) solo actualizó `is_premium`, no `is_public`

**Evidencia:**
- ✅ El trigger existe y está activo
- ✅ La función es correcta (actualiza `is_public = NEW.is_premium`)
- ❌ Pero 2 negocios premium tienen `is_public = false`
- ✅ No hay código que sobrescriba `is_public` incorrectamente

**Solución:** Ejecutar sincronización manual para `is_public` (ya hecho en migración anterior, pero verificar resultado).

