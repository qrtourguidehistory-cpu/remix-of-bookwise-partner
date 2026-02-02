# ✅ Deploy Completado - scheduled-cleanup

## 📋 Resumen

Se ha completado exitosamente el deploy y configuración de la función `scheduled-cleanup` para limpiar automáticamente notificaciones antiguas.

## ✅ Tareas Completadas

### 1. Deploy de la Edge Function
- ✅ Función `scheduled-cleanup` desplegada en Supabase
- ✅ URL: `https://rdznelijpliklisnflfm.supabase.co/functions/v1/scheduled-cleanup`
- ✅ Configuración agregada en `supabase/config.toml`

### 2. Configuración del Cron Job
- ✅ Extensión `pg_cron` habilitada
- ✅ Extensión `pg_net` habilitada (para hacer HTTP requests)
- ✅ Cron job `cleanup-old-notifications` creado y activo
- ✅ Programado para ejecutarse cada día a las 2:00 AM (formato: `0 2 * * *`)

### 3. Prueba Manual
- ✅ Función probada manualmente
- ✅ **Resultado:** Se eliminaron exitosamente:
  - 272 notificaciones de la tabla `notifications`
  - 46 notificaciones de la tabla `client_notifications`
  - **Total: 318 notificaciones eliminadas**

## 📊 Estado Actual

### Cron Job
- **Nombre:** `cleanup-old-notifications`
- **Job ID:** 1
- **Estado:** ✅ Activo
- **Programación:** Cada día a las 2:00 AM
- **Base de datos:** postgres
- **Usuario:** postgres

### Estadísticas de Limpieza
- **Notificaciones antiguas restantes:** 0
- **Última ejecución:** Exitosa

## 🔍 Monitoreo

### Ver el estado del cron job:
```sql
SELECT * FROM cron.job WHERE jobname = 'cleanup-old-notifications';
```

### Ver el historial de ejecuciones:
```sql
SELECT 
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-old-notifications')
ORDER BY start_time DESC
LIMIT 10;
```

### Ver cuántas notificaciones se eliminarán en la próxima ejecución:
```sql
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

### Ver logs de la Edge Function:
- Dashboard de Supabase → Edge Functions → `scheduled-cleanup` → Logs
- URL: https://supabase.com/dashboard/project/rdznelijpliklisnflfm/functions

## 🎯 Próximos Pasos

La función está completamente configurada y funcionando. Se ejecutará automáticamente cada día a las 2:00 AM para mantener la base de datos limpia.

### Opciones de Configuración Avanzada

Si necesitas cambiar la frecuencia del cron job:

```sql
-- Eliminar el cron job actual
SELECT cron.unschedule('cleanup-old-notifications');

-- Crear uno nuevo con diferente frecuencia
-- Ejemplo: cada 12 horas (2:00 AM y 2:00 PM)
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 2,14 * * *',  -- 2:00 AM y 2:00 PM
  $$
  SELECT
    net.http_post(
      url := 'https://rdznelijpliklisnflfm.supabase.co/functions/v1/scheduled-cleanup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

## 📝 Notas

- ⚠️ La función elimina permanentemente los registros con más de 24 horas
- ✅ La función es idempotente (puede ejecutarse múltiples veces sin problemas)
- 🔒 Usa Service Role Key para tener permisos completos
- 📊 Monitorea periódicamente los logs para asegurarte de que funciona correctamente

---

**Fecha de deploy:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Estado:** ✅ Completado y funcionando

