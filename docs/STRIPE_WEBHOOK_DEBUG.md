# Debug del Webhook de Stripe

## Problema
El webhook no está activando las suscripciones en Supabase.

## Verificaciones Necesarias

### 1. Verificar STRIPE_WEBHOOK_SECRET en Supabase

El webhook secret debe estar configurado en Supabase Secrets:

1. Ve a tu proyecto en Supabase Dashboard
2. Settings → Edge Functions → Secrets
3. Verifica que `STRIPE_WEBHOOK_SECRET` esté configurado
4. El valor debe ser el **Signing Secret** de tu webhook en Stripe (formato: `whsec_...`)

**⚠️ IMPORTANTE**: Si el secreto está mal, Supabase rechaza todos los mensajes de Stripe y nunca se ejecuta el webhook.

### 2. Verificar URL del Webhook en Stripe

1. Ve a Stripe Dashboard → Developers → Webhooks
2. Verifica que el webhook apunte a:
   ```
   https://rdznelijpliklisnflfm.supabase.co/functions/v1/stripe-webhook
   ```
3. Verifica que los eventos estén habilitados:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

### 3. Verificar Metadata en Stripe

El webhook necesita `business_id` y `subscription_id` en los metadata. Estos se envían desde `create-stripe-checkout`:

- ✅ `session.metadata.business_id`
- ✅ `session.metadata.subscription_id`
- ✅ `subscription.metadata.business_id` (fallback)
- ✅ `subscription.metadata.subscription_id` (fallback)

### 4. Ver Logs del Webhook

Para ver los logs del webhook:

1. Ve a Supabase Dashboard → Edge Functions → stripe-webhook → Logs
2. Busca logs con emojis:
   - 🔔 = Evento recibido
   - 💳 = Checkout session
   - ✅ = Éxito
   - ❌ = Error

### 5. Script de Prueba Manual

Para probar que el SubscriptionGuard funciona cuando el estado es 'active':

```bash
# Obtén business_id y subscription_id de tu base de datos
npx tsx scripts/test-subscription-activation.ts <business_id> <subscription_id>
```

Este script actualiza manualmente una suscripción a 'active' para verificar que el Paywall desaparece.

## Cambios Implementados

### Webhook Mejorado (versión 4)
- ✅ Logging detallado con emojis para fácil identificación
- ✅ Búsqueda de metadata en session Y subscription (fallback)
- ✅ Manejo de errores mejorado con detalles completos
- ✅ Verificación de seguridad: actualiza usando tanto `id` como `business_id`

### Polling Inteligente (3 intentos)
- ✅ Polling cada 2 segundos, máximo 3 intentos (6 segundos total)
- ✅ Limpieza de caché al final cuando es exitoso
- ✅ Mensaje mejorado cuando llega al intento 3

## Próximos Pasos

1. **Verifica el STRIPE_WEBHOOK_SECRET** en Supabase Secrets
2. **Revisa los logs** del webhook después de un pago de prueba
3. **Usa el script de prueba** para confirmar que el SubscriptionGuard funciona
4. **Revisa el Stripe Dashboard** para ver si los webhooks están llegando

