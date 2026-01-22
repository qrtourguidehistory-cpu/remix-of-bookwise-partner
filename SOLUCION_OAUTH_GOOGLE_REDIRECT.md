# 🔧 Solución: OAuth Google Redirige a Supabase en Lugar del App

## 📊 Diagnóstico del Problema

El OAuth de Google está redirigiendo a `nflfm.supabase.co` en lugar de abrir la app con el deep link `com.miturnow.partner://auth/callback`.

**Causa:** La URL de redirección no está configurada en el Dashboard de Supabase.

## ✅ Solución: Configurar Redirect URLs en Supabase

### Paso 1: Supabase Dashboard

1. Ve a tu **Supabase Dashboard** → `https://supabase.com/dashboard`
2. Selecciona tu proyecto
3. Ve a **Authentication** → **URL Configuration**
4. En la sección **Redirect URLs**, agrega:
   ```
   com.miturnow.partner://auth/callback
   ```
5. Haz clic en **Save**

### Paso 2: Verificar Google Cloud Console (Opcional)

Si usas Google OAuth directamente (no solo a través de Supabase):

1. Ve a **Google Cloud Console** → **APIs & Services** → **Credentials**
2. Busca tu **OAuth 2.0 Client ID** (Android)
3. En **Authorized redirect URIs**, agrega:
   ```
   com.miturnow.partner://auth/callback
   ```

## 🔍 Verificación de Configuración Actual

### Archivos Verificados ✅

1. **`src/hooks/useCapacitorOAuth.ts`**
   - ✅ `NATIVE_REDIRECT_URL = 'com.miturnow.partner://auth/callback'`

2. **`android/app/src/main/AndroidManifest.xml`**
   - ✅ Intent filter configurado: `com.miturnow.partner://auth/callback`

3. **`capacitor.config.ts`**
   - ✅ `appId: 'com.miturnow.partner'`

### Configuración Requerida en Supabase Dashboard ⚠️

**Debes agregar manualmente en Supabase Dashboard:**

```
com.miturnow.partner://auth/callback
```

## 📱 Cómo Funciona el Flujo

1. Usuario hace clic en "Continuar con Google"
2. Se abre el navegador con la URL de OAuth de Google
3. Usuario autoriza la aplicación
4. Google redirige a Supabase con el código de autorización
5. Supabase redirige a `com.miturnow.partner://auth/callback` (si está configurado)
6. La app captura el deep link y procesa la autenticación

**Problema actual:** El paso 5 falla porque Supabase no tiene la URL registrada, entonces muestra la página de Supabase en lugar de redirigir.

## 🧪 Prueba Después de Configurar

1. Abre la app en tu dispositivo Android
2. Intenta iniciar sesión con Google
3. Debería abrir la app automáticamente después de autorizar
4. Verifica los logs en `npx cap run android` o en Logcat:
   ```
   [CapacitorOAuth] App opened with URL: com.miturnow.partner://auth/callback?code=...
   ```

## 📝 Notas Adicionales

- **No es necesario** reconstruir la app después de cambiar la configuración en Supabase
- Los cambios en Supabase Dashboard son **inmediatos**
- Si sigue sin funcionar, verifica que la URL esté exactamente como se muestra (sin espacios, sin mayúsculas incorrectas)

