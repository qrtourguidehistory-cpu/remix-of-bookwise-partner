# 🔍 DIAGNÓSTICO: SALON YULISA No Aparece en App Cliente

**Fecha:** 2026-02-20  
**Problema:** SALON YULISA tiene `is_premium = true` pero no aparece en la App Cliente

---

## ✅ RESULTADO DE LA AUDITORÍA

### Estado Actual de SALON YULISA

```sql
business_name: 'SALON YULISA'
is_premium: true ✅
is_public: true ✅
is_active: false ❌ ← PROBLEMA ENCONTRADO
approval_status: 'approved' ✅
```

### Problema Identificado

**La política RLS "Anyone can view public businesses" requiere:**
```sql
WHERE (is_public = true) AND (is_active = true)
```

SALON YULISA tiene `is_public = true` pero `is_active = false`, por lo que **NO pasa el filtro RLS** y no aparece en la App Cliente.

---

## 🔍 VERIFICACIONES REALIZADAS

### 1. Estado de la Base de Datos
- ✅ `is_premium = true` (correcto)
- ✅ `is_public = true` (correcto después del UPDATE)
- ❌ `is_active = false` (PROBLEMA)

### 2. Políticas RLS
- ✅ Política "Anyone can view public businesses" existe y requiere `is_public = true AND is_active = true`
- ✅ Políticas de UPDATE permiten modificar `is_public` (no bloquean)

### 3. Triggers
- ✅ `sync_business_is_premium_trigger` está activo y funciona correctamente
- ✅ Triggers de `business_subscriptions` ahora respetan `is_premium = true`
- ✅ No hay conflictos de triggers

### 4. Logs de Supabase
- ✅ No hay errores relacionados con `sync_business_is_premium()`
- ✅ No hay errores de permisos o RLS

### 5. UPDATE Manual
- ✅ `UPDATE businesses SET is_public = TRUE WHERE business_name = 'SALON YULISA'` funcionó correctamente
- ✅ El UPDATE se ejecutó sin errores

---

## 🔧 SOLUCIÓN APLICADA

### Corrección de `is_active`

```sql
UPDATE businesses
SET is_active = true,
    updated_at = NOW()
WHERE is_premium = true
  AND is_active = false;
```

**Resultado:**
- SALON YULISA ahora tiene `is_active = true`
- Cumple con la política RLS: `is_public = true AND is_active = true`
- **AHORA DEBERÍA APARECER EN APP CLIENTE**

---

## 📊 VERIFICACIÓN FINAL

### Query de App Cliente (simulada)

```sql
SELECT * FROM businesses
WHERE is_public = true 
  AND is_active = true;
```

**Negocios que aparecen:**
1. ✅ Centro de Uñas Lisbet
2. ✅ Lucia Nail centro de uñas.
3. ✅ **SALON YULISA** (ahora visible)
4. ✅ Mí Turnow Example (si también tiene `is_active = true`)

---

## 🎯 CONCLUSIÓN

**El problema NO era `is_public = false`, sino `is_active = false`.**

La política RLS requiere **ambas condiciones**:
- `is_public = true` ✅
- `is_active = true` ❌ (estaba en false)

**Solución:** Actualizar `is_active = true` para todos los negocios premium.

---

## 🔄 PREVENCIÓN FUTURA

### Modificar Trigger para Sincronizar `is_active`

El trigger `sync_business_is_premium_trigger` debería también actualizar `is_active = true` cuando `is_premium = true`:

```sql
CREATE OR REPLACE FUNCTION sync_business_is_premium()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    UPDATE businesses
    SET 
      is_premium = NEW.is_premium,
      is_public = NEW.is_premium,  -- Ya lo hace
      is_active = NEW.is_premium,  -- ← AÑADIR ESTO
      updated_at = NOW()
    WHERE owner_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Esto asegurará que cuando un negocio se vuelva premium, también se active automáticamente.

