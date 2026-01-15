# 🔔 Push Notifications Setup - Multi-Project Firebase

## 📋 Resumen

Se ha actualizado el sistema de notificaciones push para soportar **múltiples proyectos de Firebase** según el rol del usuario:

- **Partners** → Usan el proyecto `bookwise-partner`
- **Clientes** → Usan el proyecto `mi-turnow-cliente`

## 🔧 Archivos Actualizados

### 1. Edge Function: `send-push-notification`
- **Ubicación**: `supabase/functions/send-push-notification/index.ts`
- **Cambios principales**:
  - Usa **Firebase Admin SDK** en lugar del Legacy FCM API
  - Detecta el rol del usuario (`partner` o `client`)
  - Inicializa Firebase con las credenciales correctas según el rol
  - Consulta tokens de la tabla `client_devices`
  - Soporta envío a múltiples dispositivos por usuario

### 2. Trigger de Base de Datos
- **Ubicación**: `supabase/migrations/20260114230015_add_push_notification_trigger.sql`
- **Función**: Se ejecuta automáticamente cuando se inserta una notificación en `client_notifications`
- **Acción**: Llama al Edge Function `send-push-notification` con el rol del usuario

## 🔑 Variables de Entorno Requeridas

Debes configurar estas variables en el **Dashboard de Supabase** → **Settings** → **Edge Functions** → **Secrets**:

### Para Partner (Bookwise Partner)
```bash
FIREBASE_PARTNER_PROJECT_ID=bookwise-partner
FIREBASE_PARTNER_CLIENT_EMAIL=firebase-adminsdk-fbsvc@bookwise-partner.iam.gserviceaccount.com
FIREBASE_PARTNER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Para Cliente (Mi Turnow Cliente)
```bash
FIREBASE_CLIENT_PROJECT_ID=mi-turnow-cliente
FIREBASE_CLIENT_CLIENT_EMAIL=firebase-adminsdk-fbsvc@mi-turnow-cliente.iam.gserviceaccount.com
FIREBASE_CLIENT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## 📝 Cómo Obtener las Credenciales

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona el proyecto correspondiente (`bookwise-partner` o `mi-turnow-cliente`)
3. Ve a **Project Settings** ⚙️ → **Service Accounts**
4. Haz clic en **Generate New Private Key**
5. Descarga el archivo JSON
6. Extrae los valores:
   - `project_id` → `FIREBASE_*_PROJECT_ID`
   - `client_email` → `FIREBASE_*_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_*_PRIVATE_KEY`

### ⚠️ Importante para Private Key
El `private_key` debe estar en formato de una sola línea con `\n` literal:
```bash
"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w...\n-----END PRIVATE KEY-----\n"
```

## 🚀 Pasos de Implementación

### 1. Aplicar la Migración
```bash
# Opción A: Usando Supabase CLI
supabase db push

# Opción B: Desde el Dashboard
# Dashboard → SQL Editor → Pega el contenido de la migración → Run
```

### 2. Configurar Variables de Entorno
```bash
# Usando Supabase CLI
supabase secrets set FIREBASE_PARTNER_PROJECT_ID=bookwise-partner
supabase secrets set FIREBASE_PARTNER_CLIENT_EMAIL=firebase-adminsdk-fbsvc@bookwise-partner.iam.gserviceaccount.com
supabase secrets set FIREBASE_PARTNER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

supabase secrets set FIREBASE_CLIENT_PROJECT_ID=mi-turnow-cliente
supabase secrets set FIREBASE_CLIENT_CLIENT_EMAIL=firebase-adminsdk-fbsvc@mi-turnow-cliente.iam.gserviceaccount.com
supabase secrets set FIREBASE_CLIENT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 3. Desplegar Edge Function
```bash
supabase functions deploy send-push-notification
```

### 4. Verificar Extensión HTTP
La migración habilita automáticamente la extensión `http` en PostgreSQL, pero verifica:
```sql
SELECT * FROM pg_extension WHERE extname = 'http';
```

## 🧪 Probar el Sistema

### Prueba 1: Insertar Notificación Manualmente
```sql
INSERT INTO client_notifications (
  user_id,
  title,
  message,
  type,
  business_id
) VALUES (
  'user-uuid-aqui',
  'Prueba de notificación',
  'Este es un mensaje de prueba',
  'general',
  'business-uuid-aqui'
);
```

### Prueba 2: Llamar Edge Function Directamente
```bash
curl -X POST \
  https://rdznelijpliklisnflfm.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "role": "partner",
    "title": "Test",
    "body": "Test message",
    "data": {}
  }'
```

## 📊 Monitoreo

### Ver Logs de Edge Function
```bash
supabase functions logs send-push-notification
```

### Ver Logs de PostgreSQL
```sql
-- Ver warnings del trigger
SELECT * FROM pg_stat_statements WHERE query LIKE '%send_push_on_notification%';
```

## 🔍 Verificación de Tokens

Los tokens FCM se almacenan en la tabla `client_devices`:

```sql
SELECT 
  cd.id,
  cd.user_id,
  cd.role,
  cd.platform,
  cd.enabled,
  cd.created_at,
  p.role as user_role,
  SUBSTRING(cd.fcm_token, 1, 20) || '...' as token_preview
FROM client_devices cd
LEFT JOIN profiles p ON p.id = cd.user_id
WHERE cd.enabled = true
ORDER BY cd.created_at DESC;
```

## ⚡ Flujo Completo

```
1. App inserta notificación en client_notifications
          ↓
2. Trigger send_push_on_notification se ejecuta
          ↓
3. Obtiene el rol del usuario desde profiles
          ↓
4. Llama a Edge Function send-push-notification con role
          ↓
5. Edge Function:
   - Detecta rol (partner/client)
   - Carga credenciales de Firebase correspondientes
   - Inicializa Firebase Admin SDK
   - Consulta tokens de client_devices
   - Envía push a todos los dispositivos del usuario
          ↓
6. Usuario recibe notificación push en su dispositivo
```

## 🛠️ Troubleshooting

### Error: "Missing private key for role: partner"
- **Causa**: Variables de entorno no configuradas
- **Solución**: Configurar `FIREBASE_PARTNER_PRIVATE_KEY` o `FIREBASE_CLIENT_PRIVATE_KEY`

### Error: "No devices found for user"
- **Causa**: Usuario no tiene tokens FCM registrados
- **Solución**: Verificar que la app haya registrado el token en `client_devices`

### Error: "Failed to send push notification"
- **Causa**: Múltiples posibles (token inválido, credenciales incorrectas, etc.)
- **Solución**: Revisar logs de Edge Function con `supabase functions logs send-push-notification`

### Push no llega al dispositivo
1. Verificar que el token FCM esté activo: `enabled = true` en `client_devices`
2. Verificar que el rol del dispositivo coincida con el rol del usuario en `profiles`
3. Verificar credenciales de Firebase en variables de entorno
4. Probar envío manual desde Firebase Console

## 📚 Documentación Adicional

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [PostgreSQL HTTP Extension](https://github.com/pramsey/pgsql-http)

## ✅ Checklist de Implementación

- [ ] Aplicar migración `20260114230015_add_push_notification_trigger.sql`
- [ ] Configurar variables de entorno para Partner
- [ ] Configurar variables de entorno para Cliente
- [ ] Desplegar Edge Function actualizada
- [ ] Verificar extensión HTTP en PostgreSQL
- [ ] Probar inserción de notificación manual
- [ ] Verificar logs de Edge Function
- [ ] Probar push en dispositivo real
- [ ] Verificar tokens en tabla `client_devices`

