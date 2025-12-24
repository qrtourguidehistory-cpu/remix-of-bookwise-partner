# Auditoría de Categorías de Establecimientos

## Resumen
Esta auditoría verifica que la búsqueda de establecimientos por categoría funcione correctamente, incluyendo tanto la categoría principal (`primary_category`) como las categorías secundarias (`secondary_categories`).

## Estructura de Datos

### Tabla `businesses`
- **`primary_category`** (TEXT): Categoría principal del establecimiento
- **`secondary_categories`** (TEXT[]): Array de hasta 3 categorías secundarias
- **`is_public`** (BOOLEAN): Debe ser `true` para que aparezca en búsquedas
- **`onboarding_completed`** (BOOLEAN): Debe ser `true` para que aparezca en búsquedas

### Vista `establishments`
La vista incluye:
- `category`: Mapea a `primary_category`
- `secondary_categories`: Array de categorías secundarias
- `all_categories`: Array combinado de todas las categorías (principal + secundarias)

## Funcionalidad de Búsqueda

### Función `get_businesses_with_category(category_id TEXT)`
Busca establecimientos que tengan una categoría específica en:
- `primary_category` (categoría principal)
- `secondary_categories` (cualquiera de las categorías secundarias)

**Ejemplo:**
```sql
-- Buscar todos los establecimientos con categoría "nails"
SELECT * FROM public.get_businesses_with_category('nails');

-- Buscar todos los establecimientos con categoría "barber"
SELECT * FROM public.get_businesses_with_category('barber');
```

### Función `search_businesses_by_category(category_search TEXT)`
Busca en la vista `establishments` y retorna todos los campos del establecimiento.

## Lógica de Búsqueda

Un establecimiento aparecerá en los resultados si:
1. Su `primary_category` coincide con la categoría buscada, O
2. La categoría buscada está presente en su array `secondary_categories`

**Ejemplo práctico:**
- Establecimiento A tiene:
  - `primary_category`: "nails"
  - `secondary_categories`: ["barber", "massage"]
  
- Este establecimiento aparecerá cuando se busque:
  - "nails" (categoría principal)
  - "barber" (categoría secundaria)
  - "massage" (categoría secundaria)

## Categorías Disponibles

Las categorías se identifican por IDs (en inglés):
- `hair_salon` - Salón de belleza
- `nails` - Uñas
- `eyebrows_lashes` - Cejas y pestañas
- `beauty_salon` - Salón de belleza
- `medspa` - Medspa
- `barber` - Barbería
- `massage` - Masajes
- `spa_sauna` - Spa y sauna
- `waxing` - Depilación
- `tattoo_piercing` - Tatuajes y piercings
- `tanning` - Bronceado
- `fitness` - Fitness y recuperación
- `physical_therapy` - Fisioterapia
- `health_practice` - Práctica de salud
- `pet_grooming` - Peluquería de mascotas
- `other` - Otro

## Optimizaciones Implementadas

1. **Índices creados:**
   - `idx_businesses_primary_category`: Índice en `primary_category` para búsquedas rápidas
   - `idx_businesses_secondary_categories`: Índice GIN en `secondary_categories` para búsquedas en arrays

2. **Vista optimizada:**
   - La vista `establishments` incluye `all_categories` para búsquedas más eficientes

## Uso en la Aplicación

Para buscar establecimientos por categoría en el código:

```typescript
// Opción 1: Usar la función SQL
const { data, error } = await supabase.rpc('get_businesses_with_category', {
  category_id: 'nails'
});

// Opción 2: Usar la vista directamente
const { data, error } = await supabase
  .from('establishments')
  .select('*')
  .or(`category.eq.nails,secondary_categories.cs.{nails}`);
```

## Verificación

Para verificar que todo funciona correctamente:

```sql
-- 1. Ver todos los establecimientos con sus categorías
SELECT 
  business_name,
  primary_category,
  secondary_categories,
  ARRAY[primary_category] || COALESCE(secondary_categories, ARRAY[]::text[]) as all_categories
FROM public.businesses
WHERE is_public = true AND onboarding_completed = true;

-- 2. Probar búsqueda por categoría principal
SELECT * FROM public.get_businesses_with_category('nails');

-- 3. Probar búsqueda por categoría secundaria
SELECT * FROM public.get_businesses_with_category('barber');
```

## Notas Importantes

1. **Consistencia de IDs**: Las categorías se almacenan como IDs (ej: "nails", "barber"), no como labels (ej: "Uñas", "Barbería")
2. **Búsqueda case-sensitive**: La búsqueda es case-sensitive, asegúrate de usar los IDs exactos
3. **Visibilidad**: Solo los establecimientos con `is_public = true` y `onboarding_completed = true` aparecen en búsquedas

