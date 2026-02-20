# 📱 Cambios Requeridos en App Cliente - Soporte para `businesses.is_premium`

**Fecha:** 2026-02-19  
**Versión:** 1.2.5  
**Objetivo:** Documentar los cambios necesarios en la App Cliente para mostrar negocios premium correctamente

---

## ✅ Cambios Aplicados en Backend

### 1. Nueva Columna en `businesses`
- ✅ Columna `is_premium BOOLEAN` añadida a la tabla `businesses`
- ✅ Se sincroniza automáticamente desde `profiles.is_premium` vía trigger SQL
- ✅ Índice creado para optimizar queries: `idx_businesses_is_premium`

### 2. Trigger de Sincronización
- ✅ Trigger `sync_business_is_premium_trigger` actualiza `businesses.is_premium` automáticamente cuando `profiles.is_premium` cambia
- ✅ Sincronización bidireccional: cuando un usuario paga, su negocio se marca como premium automáticamente

---

## 🔧 Cambios Requeridos en App Cliente

### Opción A: Usar `businesses.is_premium` Directamente (RECOMENDADO)

**Query Actual (ANTES):**
```sql
SELECT * FROM businesses 
WHERE approval_status = 'approved' 
  AND is_active = true
  AND is_public = true;
```

**Query Nueva (DESPUÉS):**
```sql
SELECT * FROM businesses 
WHERE approval_status = 'approved' 
  AND is_active = true
  AND (is_public = true OR is_premium = true);
```

**Explicación:**
- Mostrar negocios que son **públicos** O **premium**
- Los negocios premium pueden tener `is_public = false` pero aún así deben mostrarse si `is_premium = true`

---

### Opción B: JOIN con `profiles` (Alternativa)

Si prefieres mantener la lógica de JOIN (aunque ya no es necesario):

```sql
SELECT 
  b.*,
  p.is_premium as owner_is_premium
FROM businesses b
LEFT JOIN profiles p ON b.owner_id = p.id
WHERE b.approval_status = 'approved' 
  AND b.is_active = true
  AND (b.is_public = true OR COALESCE(p.is_premium, false) = true);
```

**Nota:** Esta opción es menos eficiente porque requiere JOIN. La Opción A es preferible.

---

## 📋 Ejemplo de Implementación en TypeScript/JavaScript

### Si usas Supabase Client:

```typescript
// Query para obtener negocios visibles (públicos O premium)
const { data: businesses, error } = await supabase
  .from('businesses')
  .select('*')
  .eq('approval_status', 'approved')
  .eq('is_active', true)
  .or('is_public.eq.true,is_premium.eq.true')
  .order('business_name', { ascending: true });
```

### Si usas SQL directo:

```sql
SELECT 
  id,
  business_name,
  description,
  address,
  phone,
  email,
  logo_url,
  cover_image_url,
  is_public,
  is_premium,  -- ← Nueva columna disponible
  approval_status,
  created_at
FROM businesses
WHERE approval_status = 'approved'
  AND is_active = true
  AND (is_public = true OR is_premium = true)
ORDER BY business_name ASC;
```

---

## 🎯 Casos de Uso

### 1. Mostrar Todos los Negocios Visibles
```typescript
// Negocios públicos O premium
const { data } = await supabase
  .from('businesses')
  .select('*')
  .eq('approval_status', 'approved')
  .eq('is_active', true)
  .or('is_public.eq.true,is_premium.eq.true');
```

### 2. Filtrar Solo Negocios Premium
```typescript
// Solo negocios premium (incluso si no son públicos)
const { data } = await supabase
  .from('businesses')
  .select('*')
  .eq('approval_status', 'approved')
  .eq('is_active', true)
  .eq('is_premium', true);
```

### 3. Mostrar Badge "Premium" en UI
```typescript
// En tu componente de lista de negocios
{business.is_premium && (
  <Badge variant="premium">Premium</Badge>
)}
```

---

## 🔍 Verificación

### Query de Prueba
```sql
-- Verificar que los negocios premium están sincronizados
SELECT 
  b.business_name,
  b.is_premium as business_is_premium,
  p.email as owner_email,
  p.is_premium as profile_is_premium
FROM businesses b
LEFT JOIN profiles p ON b.owner_id = p.id
WHERE p.is_premium = true
ORDER BY b.business_name;
```

**Resultado Esperado:**
- `business_is_premium` debe ser `true` para todos los negocios donde `profile_is_premium = true`
- Si hay discrepancias, el trigger debería sincronizarlas automáticamente

---

## ⚠️ Notas Importantes

1. **RLS Policies:** Las políticas RLS existentes permiten lectura de `businesses` con `is_public = true`. Asegúrate de que también permitan lectura cuando `is_premium = true`, o usa Service Role Key si es necesario.

2. **Performance:** La columna `is_premium` tiene un índice parcial (`WHERE is_premium = true`), por lo que las queries que filtran por premium serán eficientes.

3. **Sincronización Automática:** No necesitas hacer nada especial para sincronizar - el trigger SQL lo hace automáticamente cuando `profiles.is_premium` cambia.

4. **Backward Compatibility:** Si un negocio no tiene `is_premium` (NULL), se trata como `false` por defecto, por lo que no afecta a negocios existentes.

---

## 🚀 Próximos Pasos

1. **Actualizar queries** en la App Cliente para usar `businesses.is_premium`
2. **Probar** que los negocios premium aparecen correctamente
3. **Añadir badge "Premium"** en la UI si es necesario
4. **Verificar** que los filtros funcionan correctamente

---

## 📞 Soporte

Si encuentras problemas con la sincronización, verifica:
- Que el trigger existe: `SELECT * FROM pg_trigger WHERE tgname = 'sync_business_is_premium_trigger';`
- Que la función existe: `SELECT * FROM pg_proc WHERE proname = 'sync_business_is_premium';`
- Que los datos están sincronizados: Usa la query de verificación arriba

