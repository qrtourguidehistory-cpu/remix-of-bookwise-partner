# Sistema de Notificaciones

Este documento describe el sistema de notificaciones implementado para las citas.

## Funcionalidades

### 1. Notificación de Confirmación
Cuando un partner confirma una cita, el cliente recibe automáticamente una notificación de confirmación.

**Cuándo se envía:**
- Al cambiar el estado de una cita a "confirmed" desde cualquier vista del calendario
- Al crear una nueva cita con estado "confirmed"

**Qué incluye:**
- Fecha y hora de la cita
- Mensaje de confirmación personalizado

### 2. Notificación de Recordatorio (10 minutos antes)
Se programa automáticamente una notificación que se envía 10 minutos antes de la hora programada de la cita.

**Cuándo se programa:**
- Al confirmar una cita
- Al crear una nueva cita confirmada

**Procesamiento:**
- Las notificaciones programadas se procesan mediante el Edge Function `process-notifications`
- Este Edge Function debe ejecutarse periódicamente (recomendado: cada minuto)

### 3. Notificación de Completación
Cuando se completa una cita, se envían dos notificaciones:

**a) Al cliente de la cita completada:**
- Notificación de que su cita ha sido completada
- Solicitud de reseña (review request)

**b) Al siguiente cliente en cola:**
- Notificación de que puede venir ahora
- Información sobre su cita próxima

### 4. Notificación de Cancelación
Cuando se cancela una cita, el cliente recibe una notificación de cancelación con la información de su cita.

## Configuración

### Edge Function para Procesar Notificaciones Programadas

El Edge Function `process-notifications` debe ejecutarse periódicamente para procesar las notificaciones programadas.

**Desplegar el Edge Function:**
```bash
supabase functions deploy process-notifications
```

**Configurar Cron Job (Supabase Dashboard):**
1. Ve a Database > Cron Jobs
2. Crea un nuevo cron job con:
   - **Schedule:** `* * * * *` (cada minuto)
   - **Command:** `SELECT net.http_post(url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-notifications', headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb);`

**Alternativa: Usar pg_cron directamente:**
```sql
SELECT cron.schedule(
  'process-notifications',
  '* * * * *', -- cada minuto
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-notifications',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

### Configuración de Notificaciones por Negocio

Cada negocio puede configurar sus preferencias de notificaciones en la tabla `notification_settings`:
- `email_notifications`: Habilitar/deshabilitar notificaciones por email
- `sms_notifications`: Habilitar/deshabilitar notificaciones por SMS
- `push_notifications`: Habilitar/deshabilitar notificaciones push

## Integración con Servicios Externos

Actualmente, el sistema registra las notificaciones en la tabla `appointment_notifications` pero no envía notificaciones reales. Para integrar con servicios reales:

### Email
Integrar con servicios como:
- SendGrid
- AWS SES
- Resend
- Nodemailer

### SMS
Integrar con servicios como:
- Twilio
- AWS SNS
- MessageBird

### Push Notifications
Integrar con:
- Firebase Cloud Messaging (FCM)
- Apple Push Notification Service (APNS)
- OneSignal

**Ubicación del código a modificar:**
- `src/lib/notificationService.ts` - Función `sendNotificationToClient()`
- `supabase/functions/process-notifications/index.ts` - Sección donde se envía la notificación

## Estructura de Datos

### Tabla `appointment_notifications`
- `id`: UUID único
- `appointment_id`: ID de la cita relacionada
- `send_at`: Fecha/hora programada para enviar
- `status`: 'scheduled', 'sent', 'failed', 'cancelled'
- `meta`: JSON con información adicional (tipo, mensaje, canales, etc.)

### Tabla `notification_settings`
- `business_id`: ID del negocio
- `email_notifications`: Boolean
- `sms_notifications`: Boolean
- `push_notifications`: Boolean

## Flujo de Notificaciones

1. **Creación/Confirmación de Cita:**
   - Se envía notificación inmediata de confirmación
   - Se programa notificación de recordatorio (10 min antes)

2. **Procesamiento de Notificaciones Programadas:**
   - Edge Function se ejecuta cada minuto
   - Busca notificaciones con `status = 'scheduled'` y `send_at <= now()`
   - Obtiene detalles de la cita y cliente
   - Envía la notificación según configuración del negocio
   - Actualiza el estado a 'sent' o 'failed'

3. **Completación de Cita:**
   - Se envía notificación al cliente completado
   - Se envía solicitud de reseña
   - Se busca siguiente cita en cola
   - Se envía notificación al siguiente cliente

4. **Cancelación de Cita:**
   - Se envía notificación de cancelación
   - Se cancelan notificaciones programadas relacionadas

## Testing

Para probar el sistema:

1. **Crear una cita confirmada:**
   - Verificar que se crea registro en `appointment_notifications` con tipo 'confirmation'
   - Verificar que se programa recordatorio 10 min antes

2. **Confirmar una cita:**
   - Cambiar estado a 'confirmed'
   - Verificar notificación de confirmación
   - Verificar programación de recordatorio

3. **Completar una cita:**
   - Cambiar estado a 'completed'
   - Verificar notificaciones al cliente completado
   - Verificar notificación al siguiente cliente (si existe)

4. **Cancelar una cita:**
   - Cambiar estado a 'cancelled'
   - Verificar notificación de cancelación
   - Verificar que se cancelan recordatorios programados

## Notas Importantes

- Las notificaciones se registran en la base de datos incluso si el servicio externo falla
- El sistema es resiliente: si una notificación falla, se marca como 'failed' pero no bloquea otras operaciones
- Las notificaciones programadas se cancelan automáticamente si la cita se cancela o completa antes del tiempo programado
- El sistema respeta las preferencias de notificación configuradas por cada negocio

