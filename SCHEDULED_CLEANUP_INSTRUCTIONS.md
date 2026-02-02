# 🧹 Instrucciones para Configurar la Limpieza Automática de Notificaciones

## 📋 Resumen

Se ha creado la Edge Function `scheduled-cleanup` que elimina automáticamente registros de las tablas `notifications` y `client_notifications` con más de 24 horas de antigüedad. Esto mantiene la base de datos ligera y eficiente.

## 🚀 Paso 1: Deploy de la Edge Function

### Opción A: Usando Supabase CLI (Recomendado)

1. **Asegúrate de tener Supabase CLI instalado:**
   ```bash
   npm install -g supabase
   ```

2. **Inicia sesión en Supabase:**
   ```bash
   supabase login
   ```

3. **Vincula tu proyecto (si aún no lo has hecho):**
   ```bash
   supabase link --project-ref tu-project-ref
   ```

4. **Haz deploy de la función:**
   ```bash
   supabase functions deploy scheduled-cleanup
   ```

### Opción B: Usando el Dashboard de Supabase

1. Ve al Dashboard de Supabase: https://app.supabase.com
2. Selecciona tu proyecto
3. Ve a **Edge Functions** en el menú lateral
4. Haz clic en **Create a new function**
5. Nombre: `scheduled-cleanup`
6. Copia el contenido del archivo `supabase/functions/scheduled-cleanup/index.ts`
7. Haz clic en **Deploy**

## ⏰ Paso 2: Configurar el Cron Job

### Opción A: Usando pg_cron (Recomendado - Base de datos)

1. **Conecta a tu base de datos de Supabase** usando el SQL Editor en el Dashboard

2. **Habilita la extensión pg_cron (si no está habilitada):**
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   ```

3. **Crea el cron job que ejecuta la función cada 24 horas:**
   ```sql
   SELECT cron.schedule(
     'cleanup-old-notifications',           -- Nombre del job
     '0 2 * * *',                           -- Cada día a las 2:00 AM (formato cron)
     $$
     SELECT
       net.http_post(
         url := 'https://TU_PROJECT_REF.supabase.co/functions/v1/scheduled-cleanup',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
         ),
         body := '{}'::jsonb
       ) AS request_id;
     $$
   );
   ```

   **⚠️ IMPORTANTE:** Reemplaza `TU_PROJECT_REF` con el ID de tu proyecto de Supabase.

   **Para obtener tu PROJECT_REF:**
   - Ve al Dashboard de Supabase
   - Selecciona tu proyecto
   - Ve a **Settings** → **API**
   - El **Project URL** contiene tu project ref: `https://xxxxx.supabase.co`

4. **Verificar que el cron job se creó correctamente:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'cleanup-old-notifications';
   ```

5. **Ver el historial de ejecuciones:**
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-old-notifications')
   ORDER BY start_time DESC
   LIMIT 10;
   ```

### Opción B: Usando Supabase Cron (Dashboard)

1. Ve al Dashboard de Supabase
2. Selecciona tu proyecto
3. Ve a **Database** → **Cron Jobs** (si está disponible en tu plan)
4. Crea un nuevo cron job:
   - **Nombre:** `cleanup-old-notifications`
   - **Schedule:** `0 2 * * *` (cada día a las 2:00 AM)
   - **Function:** `scheduled-cleanup`
   - **Method:** `POST`

### Opción C: Usando un servicio externo (Alternativa)

Si no tienes acceso a pg_cron, puedes usar un servicio externo como:

- **GitHub Actions** (gratis para repos públicos)
- **Cron-job.org** (gratis)
- **EasyCron** (gratis con limitaciones)
- **Zapier** (con plan de pago)

**Ejemplo con curl (para usar en cualquier servicio de cron):**
```bash
curl -X POST \
  'https://TU_PROJECT_REF.supabase.co/functions/v1/scheduled-cleanup' \
  -H 'Authorization: Bearer TU_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

## 🔍 Paso 3: Verificar que Funciona

### Probar manualmente la función:

```bash
curl -X POST \
  'https://TU_PROJECT_REF.supabase.co/functions/v1/scheduled-cleanup' \
  -H 'Authorization: Bearer TU_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Limpieza completada exitosamente",
  "deleted": {
    "notifications": 15,
    "client_notifications": 23,
    "total": 38
  },
  "cutoff_date": "2025-01-14T02:00:00.000Z"
}
```

### Verificar en los logs:

1. Ve al Dashboard de Supabase
2. Selecciona tu proyecto
3. Ve a **Edge Functions** → **scheduled-cleanup** → **Logs**
4. Deberías ver mensajes como:
   - `🧹 Iniciando limpieza de notificaciones anteriores a: ...`
   - `✅ Eliminadas X notificaciones de la tabla notifications`
   - `✅ Eliminadas X notificaciones de la tabla client_notifications`

## 📊 Monitoreo

### Ver estadísticas de limpieza:

Puedes crear una vista SQL para monitorear cuántas notificaciones se eliminarán en la próxima ejecución:

```sql
CREATE OR REPLACE VIEW notification_cleanup_stats AS
SELECT 
  'notifications' AS table_name,
  COUNT(*) AS records_to_delete
FROM notifications
WHERE created_at < NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  'client_notifications' AS table_name,
  COUNT(*) AS records_to_delete
FROM client_notifications
WHERE created_at < NOW() - INTERVAL '24 hours';
```

Luego consulta:
```sql
SELECT * FROM notification_cleanup_stats;
```

## ⚙️ Configuración Avanzada

### Cambiar el intervalo de limpieza

Si quieres cambiar el intervalo de 24 horas a otro valor (por ejemplo, 48 horas), edita la Edge Function:

```typescript
// Cambiar de 24 a 48 horas
twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 48);
```

Y actualiza el nombre de la variable si lo deseas.

### Cambiar la frecuencia del cron

Para ejecutar cada 12 horas en lugar de cada 24 horas, cambia el schedule:

```sql
-- Ejecutar cada 12 horas (a las 2:00 AM y 2:00 PM)
SELECT cron.unschedule('cleanup-old-notifications');
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 2,14 * * *',  -- 2:00 AM y 2:00 PM
  $$ ... $$
);
```

## 🛠️ Solución de Problemas

### Error: "permission denied for schema cron"

**Solución:** Necesitas permisos de superusuario o habilitar pg_cron. Contacta al soporte de Supabase si no tienes acceso.

### Error: "function does not exist"

**Solución:** Asegúrate de que la Edge Function se haya desplegado correctamente. Verifica en el Dashboard de Supabase.

### El cron no se ejecuta

**Solución:** 
1. Verifica que el cron job esté activo: `SELECT * FROM cron.job;`
2. Revisa los logs de ejecución: `SELECT * FROM cron.job_run_details;`
3. Verifica que la URL de la función sea correcta

## 📝 Notas Importantes

- ⚠️ **Esta función elimina permanentemente los registros.** Asegúrate de que no necesites las notificaciones después de 24 horas.
- ✅ **La función es idempotente:** Puede ejecutarse múltiples veces sin problemas.
- 🔒 **Usa Service Role Key:** La función usa la Service Role Key para tener permisos completos.
- 📊 **Monitorea el uso:** Revisa periódicamente los logs para asegurarte de que funciona correctamente.

## ✅ Checklist de Implementación

- [ ] Edge Function `scheduled-cleanup` desplegada
- [ ] Extensión `pg_cron` habilitada (si usas pg_cron)
- [ ] Cron job configurado y programado
- [ ] Función probada manualmente
- [ ] Logs verificados
- [ ] Monitoreo configurado (opcional)

---

**¿Necesitas ayuda?** Revisa los logs de la Edge Function en el Dashboard de Supabase o consulta la documentación de [Supabase Edge Functions](https://supabase.com/docs/guides/functions).

