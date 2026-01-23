# Implementación de PayPal Subscriptions con Capacitor

## Resumen

Esta implementación usa **PayPal REST API** con **Capacitor Browser** para suscripciones en aplicaciones móviles nativas (Android + iOS), **sin usar PayPal JS SDK**.

## Arquitectura

```
Usuario → Botón "Suscribirse" 
  → Edge Function (create-paypal-subscription)
  → PayPal REST API crea suscripción
  → Retorna approval_url
  → Browser.open() abre PayPal en navegador del sistema
  → Usuario aprueba en PayPal
  → PayPal redirige a Edge Function (paypal-return)
  → Edge Function redirige a deep link (com.miturnow.partner://paypal/success)
  → App captura deep link con App.addListener('appUrlOpen')
  → Confirma/sincroniza suscripción vía backend
```

## Archivos Creados/Modificados

### 1. Hook: `src/hooks/usePayPalSubscription.ts`
- Maneja la creación de suscripciones
- Abre PayPal con `Browser.open()`
- Escucha deep links con `App.addListener('appUrlOpen')`
- Confirma/sincroniza suscripciones

### 2. Edge Function: `supabase/functions/create-paypal-subscription/index.ts`
- Crea suscripción en PayPal usando REST API
- Retorna `approval_url` para abrir en navegador
- Configura `return_url` y `cancel_url` apuntando a `paypal-return`

### 3. Edge Function: `supabase/functions/paypal-return/index.ts` (NUEVA)
- Intermediario entre PayPal y la app
- Recibe parámetros de PayPal (token, subscription_id)
- Redirige al deep link con esos parámetros

### 4. Edge Function: `supabase/functions/confirm-paypal-subscription/index.ts` (NUEVA)
- Confirma suscripción después de aprobación
- Obtiene estado desde PayPal API
- Actualiza BD con estado correcto

### 5. Edge Function: `supabase/functions/sync-paypal-subscription/index.ts` (NUEVA)
- Sincroniza estado de suscripción desde PayPal
- Útil cuando no hay token de aprobación

### 6. Componente: `src/pages/admin/SubscriptionPage.tsx`
- Usa `usePayPalSubscription` hook
- Botón simple que llama a `createPayPalSubscription()`
- **Eliminado**: Todo código relacionado con PayPal JS SDK

### 7. AndroidManifest: `android/app/src/main/AndroidManifest.xml`
- Agregados deep links para PayPal:
  - `com.miturnow.partner://paypal/success`
  - `com.miturnow.partner://paypal/cancel`

## Flujo Completo

### 1. Usuario hace clic en "Suscribirse"

```typescript
// En SubscriptionPage.tsx
<Button onClick={async () => {
  const result = await createPayPalSubscription(
    profile.business_id,
    profile.id,
    subscription?.id
  );
}}>
  Suscribirse con PayPal
</Button>
```

### 2. Hook crea suscripción en backend

```typescript
// usePayPalSubscription.ts
const { data } = await supabase.functions.invoke('create-paypal-subscription', {
  body: {
    business_id: businessId,
    owner_id: ownerId,
    subscription_id: existingSubscriptionId,
    is_native: isNative,
  }
});
```

### 3. Edge Function crea suscripción en PayPal

```typescript
// create-paypal-subscription/index.ts
const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
  method: 'POST',
  body: JSON.stringify({
    plan_id: 'P-3E06630207547191YNFX65GI',
    application_context: {
      return_url: 'https://.../paypal-return?status=success&subscription_id=xxx',
      cancel_url: 'https://.../paypal-return?status=cancel&subscription_id=xxx',
    }
  })
});
```

### 4. Abrir PayPal en navegador

```typescript
// usePayPalSubscription.ts
if (isNative) {
  await Browser.open({
    url: data.approval_url,
    presentationStyle: 'fullscreen', // iOS
    windowName: '_self',
  });
} else {
  window.location.href = data.approval_url;
}
```

### 5. Usuario aprueba en PayPal

PayPal redirige a: `https://.../paypal-return?status=success&subscription_id=xxx&token=xxx`

### 6. Edge Function redirige a deep link

```typescript
// paypal-return/index.ts
const deepLink = `com.miturnow.partner://paypal/success?subscription_id=${subscriptionId}&token=${token}`;
return new Response(null, {
  status: 302,
  headers: { 'Location': deepLink }
});
```

### 7. App captura deep link

```typescript
// usePayPalSubscription.ts
App.addListener('appUrlOpen', async ({ url }) => {
  const urlObj = new URL(url.replace('com.miturnow.partner://', 'https://'));
  const path = urlObj.pathname;
  const params = new URLSearchParams(urlObj.search);
  
  if (path.includes('/paypal/success')) {
    const subscriptionId = params.get('subscription_id');
    const token = params.get('token');
    
    await confirmPayPalSubscription(subscriptionId, token);
  }
});
```

### 8. Confirmar suscripción

```typescript
// usePayPalSubscription.ts
await supabase.functions.invoke('confirm-paypal-subscription', {
  body: {
    subscription_id: subscriptionId,
    token: token,
  }
});
```

## Configuración Requerida

### Variables de Entorno (Supabase Secrets)

```bash
PAYPAL_CLIENT_ID=AVQv1quFb4J_F3k4jcCIDd_ZtCvvOm0ofl8eSVRu3gWRIp0Yod2VDnuhKVGGmzVF5BSN0Est6H_y5n_A
PAYPAL_CLIENT_SECRET=tu_secret_aqui
PAYPAL_MODE=sandbox  # o 'live' para producción
```

### Deep Links en Android

Ya configurados en `AndroidManifest.xml`:
- `com.miturnow.partner://paypal/success`
- `com.miturnow.partner://paypal/cancel`

### Deep Links en iOS

Agregar en `ios/App/App/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.miturnow.partner</string>
    </array>
  </dict>
</array>
```

## Seguridad

✅ **Aprobado por PayPal**: Usa REST API oficial
✅ **Sin JS SDK**: No hay iframes ni popups
✅ **Tokens seguros**: Manejo correcto de approval tokens
✅ **Validación backend**: Todo se valida en Edge Functions
✅ **Deep links seguros**: Solo la app puede recibirlos

## Testing

1. **Sandbox**: Usa `PAYPAL_MODE=sandbox`
2. **Cuentas de prueba**: Crea cuentas en PayPal Developer Dashboard
3. **Deep links**: Prueba con `adb shell am start -a android.intent.action.VIEW -d "com.miturnow.partner://paypal/success?subscription_id=test&token=test"`

## Troubleshooting

- **Deep link no se captura**: Verificar AndroidManifest.xml
- **Browser no cierra**: Verificar que `Browser.close()` se llama después del deep link
- **Token no llega**: PayPal puede no enviar token en algunos casos, usar `sync-paypal-subscription` como fallback

