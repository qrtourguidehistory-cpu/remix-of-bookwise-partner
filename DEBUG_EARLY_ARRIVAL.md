# 🔍 DEBUG: Notificaciones de "Puede asistir" no llegan

## 📋 PASOS PARA DEBUGGEAR

### 1. Verificar que la solicitud se crea
```sql
-- Ver las últimas solicitudes creadas
SELECT 
  ar.id,
  ar.appointment_id,
  ar.user_id,
  ar.client_id,
  ar.status,
  ar.created_at,
  a.user_id as appointment_user_id,
  a.client_id as appointment_client_id
FROM appointment_requests ar
JOIN appointments a ON ar.appointment_id = a.id
WHERE ar.type = 'early_arrival'
ORDER BY ar.created_at DESC
LIMIT 5;
```

### 2. Verificar que las notificaciones se crean
```sql
-- Ver las últimas notificaciones de early_arrival_request
SELECT 
  cn.id,
  cn.user_id,
  cn.client_id,
  cn.appointment_id,
  cn.type,
  cn.title,
  cn.message,
  cn.read,
  cn.created_at,
  cn.meta->>'request_id' as request_id
FROM client_notifications cn
WHERE cn.type = 'early_arrival_request'
ORDER BY cn.created_at DESC
LIMIT 5;
```

### 3. Verificar el user_id del cliente
```sql
-- Verificar que el appointment tiene user_id
SELECT 
  a.id,
  a.user_id as appointment_user_id,
  a.client_id,
  c.user_id as client_table_user_id,
  cp.id as client_profile_id
FROM appointments a
LEFT JOIN clients c ON a.client_id = c.id
LEFT JOIN client_profiles cp ON cp.id = COALESCE(c.user_id, a.user_id)
WHERE a.id = 'TU_APPOINTMENT_ID_AQUI';
```

### 4. Verificar logs del Edge Function
- Ve a Supabase Dashboard > Edge Functions > send-early-arrival-request > Logs
- Busca errores o mensajes de "No clientUserId found"

## 🔧 PROBLEMAS COMUNES

### Problema 1: `user_id` es NULL
**Síntoma**: El Edge Function logea "No clientUserId found, skipping notification"

**Solución**: Asegúrate de que el appointment tenga `user_id` o que el `client_id` tenga un `user_id` asociado

### Problema 2: Políticas RLS bloquean la inserción
**Síntoma**: Error al insertar en `client_notifications`

**Solución**: Verificar que la política "System can insert notifications via trigger" esté activa

### Problema 3: Edge Function no se ejecuta
**Síntoma**: No hay logs del Edge Function

**Solución**: Verificar que el Edge Function esté desplegado y que la llamada desde el frontend sea correcta

