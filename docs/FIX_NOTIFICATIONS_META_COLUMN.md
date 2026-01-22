# 🔧 Fix: Columna `meta` en Tabla `notifications`

## 🐛 Problema Identificado

La aplicación mostraba error **400 (Bad Request)** en el Logcat:
```
Error fetching partner notifications: {
  code: '42703',
  details: null,
  hint: null,
  message: 'column notifications.meta does not exist'
}
```

**Causa:**
- La tabla `notifications` no tenía la columna `meta` (jsonb)
- El código en `MobileLayout.tsx` intenta seleccionar `meta` de la tabla `notifications` (línea 291)
- La Edge Function `send_push_notification` puede necesitar guardar metadata en esta columna

---

## ✅ SOLUCIONES APLICADAS

### 1. **Migración SQL: Agregar Columna `meta`** ✅

**Archivo creado:** `supabase/migrations/20260117000000_add_meta_column_to_notifications.sql`

**Funcionalidad:**
- Si la tabla `notifications` existe, agrega la columna `meta` (jsonb) si no existe
- Si la tabla `notifications` no existe, la crea con todas las columnas requeridas, incluyendo `meta`
- Crea índices para mejorar rendimiento de consultas
- Habilita Row Level Security (RLS) con políticas apropiadas

**Columnas de la tabla `notifications`:**
- `id` (uuid, primary key)
- `user_id` (uuid, NOT NULL)
- `type` (text, NOT NULL)
- `title` (text, NOT NULL)
- `message` (text, NOT NULL)
- `read` (boolean, default false)
- `link` (text)
- **`meta` (jsonb, default '{}')** ⭐ **NUEVA COLUMNA**
- `appointment_id` (uuid)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Estado:** ✅ Completado

---

### 2. **Verificación: `partnerNotificationService.ts`** ✅

**Archivo verificado:** `src/lib/partnerNotificationService.ts`

**Verificación:**
- ✅ Línea 93: `meta: data.meta || null` se envía correctamente a la Edge Function
- ✅ La Edge Function `send_push_notification` recibe el campo `meta` en el body

**Estado:** ✅ **CORRECTO** - Ya envía `meta` correctamente

---

### 3. **Corrección: `CHANNEL_ERROR` en `MobileLayout.tsx`** ✅

**Archivo modificado:** `src/components/mobile/MobileLayout.tsx`

**Problemas identificados:**
1. Se usaba `Date.now()` en el nombre del canal, creando canales nuevos en cada render
2. No se limpiaba el canal anterior antes de crear uno nuevo
3. El `handleVisibilityChange` podía crear suscripciones duplicadas

**Soluciones aplicadas:**
1. **Nombre fijo del canal:** `notifications-partner-${ownerId}` (sin `Date.now()`)
2. **Limpieza previa:** Remueve el canal existente antes de crear uno nuevo
3. **Flag de prevención:** `isSubscribed` y `cleanupExecuted` previenen suscripciones duplicadas
4. **Limpieza mejorada:** Cleanup más robusto con `.then()` y `.catch()` para manejo de errores

**Código aplicado:**
```typescript
// ✅ USAR NOMBRE FIJO DEL CANAL (NO Date.now())
const channelName = `notifications-partner-${ownerId}`;

// ⚠️ LIMPIAR CANAL ANTERIOR SI EXISTE
const existingChannel = supabase.channel(channelName);
if (existingChannel) {
  try {
    await supabase.removeChannel(existingChannel);
  } catch (err) {
    console.warn('⚠️ No se pudo remover canal anterior:', err);
  }
}

// Crear nuevo canal con nombre fijo
channel = supabase.channel(channelName, { ... });
```

**Estado:** ✅ Completado

---

## 🚀 PASOS PARA APLICAR EL FIX

### Paso 1: Aplicar Migración SQL

**Opción A: Desde Supabase Dashboard**
1. Ve a **Database → Migrations**
2. Haz clic en **New Migration**
3. Pega el contenido de `supabase/migrations/20260117000000_add_meta_column_to_notifications.sql`
4. Haz clic en **Run Migration**

**Opción B: Desde Terminal (Supabase CLI)**
```bash
# Si usas Supabase CLI
supabase db push

# O aplicar directamente el archivo SQL
supabase db reset --db-url "your-connection-string" < supabase/migrations/20260117000000_add_meta_column_to_notifications.sql
```

**Opción C: SQL Directo en Supabase SQL Editor**
1. Ve a **SQL Editor** en Supabase Dashboard
2. Pega el contenido completo de la migración
3. Ejecuta la query

### Paso 2: Verificar Migración

```sql
-- Verificar que la columna meta existe
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notifications'
  AND column_name = 'meta';

-- Deberías ver:
-- column_name | data_type | column_default
-- meta        | jsonb     | '{}'::jsonb
```

### Paso 3: Verificar en Logcat

Después de aplicar la migración y ejecutar la app, deberías ver:

**✅ Logs Esperados (Éxito):**
```
✅ [REALTIME] Owner ID obtenido: 87ab3dcf-33f6-448e-9abe-1be34faee800
✅ [REALTIME] Suscrito correctamente a notifications
📡 [REALTIME] Estado de suscripción: SUBSCRIBED
```

**❌ NO deberías ver:**
```
❌ Error fetching partner notifications: column notifications.meta does not exist
❌ [REALTIME] Error en canal: CHANNEL_ERROR
```

---

## 🔍 VERIFICACIÓN ADICIONAL

### Verificar que `meta` se Guarda Correctamente

Después de crear una notificación, verifica en Supabase:

```sql
-- Ver las últimas notificaciones con meta
SELECT 
  id,
  type,
  title,
  meta,
  created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 10;

-- Ejemplo de meta esperado:
-- {
--   "old_status": "pending",
--   "new_status": "confirmed",
--   "appointment_date": "2026-01-18"
-- }
```

### Verificar que la Suscripción Real-time Funciona

1. Abre la app Partner
2. Verifica en Logcat que ves: `✅ [REALTIME] Suscrito correctamente a notifications`
3. Crea una notificación desde otro dispositivo o mediante SQL
4. Deberías ver en Logcat: `🔔 [REALTIME] Nueva notificación recibida:`
5. La notificación debería aparecer automáticamente en la UI

---

## 🐛 TROUBLESHOOTING

### Problema: "column notifications.meta does not exist" persiste

**Causa:** La migración no se aplicó correctamente

**Solución:**
1. Verifica que la migración se ejecutó en Supabase Dashboard → Migrations
2. Verifica la estructura de la tabla: `SELECT * FROM information_schema.columns WHERE table_name = 'notifications';`
3. Si la columna no existe, ejecuta manualmente:
   ```sql
   ALTER TABLE public.notifications 
   ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb;
   ```

### Problema: `CHANNEL_ERROR` persiste

**Causa:** Suscripciones duplicadas o canal mal limpiado

**Solución:**
1. Verifica en Logcat que solo ves UNA línea de `✅ [REALTIME] Suscrito correctamente`
2. Si ves múltiples líneas, el cleanup no está funcionando
3. Cierra la app completamente y ábrela de nuevo
4. Verifica que el nombre del canal sea fijo (sin `Date.now()`)

### Problema: Notificaciones no aparecen en tiempo real

**Causa:** La suscripción no está activa o el filtro está mal

**Solución:**
1. Verifica que `ownerId` es correcto en los logs
2. Verifica que el filtro `user_id=eq.${ownerId}` es correcto
3. Verifica que las notificaciones en la DB tienen el `user_id` correcto
4. Verifica que Real-time está habilitado para la tabla `notifications` en Supabase Dashboard

---

## ✅ CHECKLIST DE VERIFICACIÓN

Antes de considerar el fix completo, verifica:

- [ ] Migración SQL aplicada correctamente
- [ ] Columna `meta` existe en la tabla `notifications`
- [ ] Índices creados para mejorar rendimiento
- [ ] RLS habilitado y políticas creadas
- [ ] `partnerNotificationService.ts` envía `meta` correctamente (ya verificado ✅)
- [ ] `MobileLayout.tsx` usa nombre fijo para el canal (sin `Date.now()`)
- [ ] Solo hay UNA suscripción activa por sesión
- [ ] Cleanup del canal funciona correctamente
- [ ] No hay errores `CHANNEL_ERROR` en Logcat
- [ ] Las notificaciones aparecen en tiempo real

---

## 📝 NOTAS IMPORTANTES

### Sobre la Columna `meta`

- **Tipo:** `jsonb` (JSON binario, indexable y rápido)
- **Default:** `'{}'::jsonb` (objeto JSON vacío)
- **Uso:** Almacena metadata adicional como `old_status`, `new_status`, `appointment_date`, `rating`, etc.

### Sobre las Suscripciones Real-time

- **Nombre del canal:** `notifications-partner-${ownerId}` (fijo, no dinámico)
- **Filtro:** `user_id=eq.${ownerId}` (solo notificaciones del owner del negocio)
- **Eventos:** `INSERT` y `UPDATE` (nuevas notificaciones y cambios de estado)

### Sobre el Cleanup

- **Cleanup automático:** Se ejecuta cuando el componente se desmonta
- **Prevención de duplicados:** Flags `isSubscribed` y `cleanupExecuted` previenen múltiples suscripciones
- **Manejo de errores:** `.then()` y `.catch()` en `removeChannel()` para evitar errores silenciosos

---

## 🎯 RESULTADO ESPERADO

Después de aplicar estos fixes:

- ✅ La columna `meta` existe en la tabla `notifications`
- ✅ Las consultas a `notifications` no fallan con error 400
- ✅ Solo hay UNA suscripción activa por sesión
- ✅ No hay errores `CHANNEL_ERROR` en Logcat
- ✅ Las notificaciones se reciben en tiempo real correctamente
- ✅ El cleanup funciona correctamente al cerrar la app

---

**Documento creado:** 2026-01-17  
**Correcciones aplicadas:** Todas ✅  
**Próximo paso:** Aplicar migración SQL y verificar en Logcat

