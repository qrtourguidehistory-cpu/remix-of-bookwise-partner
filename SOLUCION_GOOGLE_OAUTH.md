# 🔧 Solución: Problema con Google OAuth Login

## 🔍 Problema Identificado

El login con Google no está funcionando. Se encontró una **inconsistencia en el deep link** que puede estar causando el problema.

## ✅ Corrección Aplicada

### 1. Deep Link Corregido

**Antes:**
```typescript
// src/hooks/useCapacitorOAuth.ts
const NATIVE_REDIRECT_URL = 'com.miturnow.app://auth/callback';
```

**Después:**
```typescript
// src/hooks/useCapacitorOAuth.ts
const NATIVE_REDIRECT_URL = 'com.bookwise.partner://auth/callback';
```

**Razón:** El AndroidManifest.xml está configurado con `com.bookwise.partner://auth/callback`, pero el código estaba usando `com.miturnow.app://auth/callback`. Esto causaba que el redirect no funcionara correctamente.

## 🔧 Verificaciones Necesarias en Supabase Dashboard

### 1. Verificar que Google OAuth esté Habilitado

1. Ve a **Supabase Dashboard** → **Authentication** → **Providers**
2. Busca **Google** en la lista
3. Asegúrate de que esté **habilitado** (toggle ON)
4. Verifica que tenga configuradas:
   - **Client ID (for OAuth)**
   - **Client Secret (for OAuth)**

### 2. Verificar URLs de Redirect

En **Supabase Dashboard** → **Authentication** → **URL Configuration**, verifica que estén configuradas estas URLs:

**Site URL:**
```
https://rdznelijpliklisnflfm.supabase.co
```

**Redirect URLs (agregar todas estas):**
```
com.bookwise.partner://auth/callback
https://rdznelijpliklisnflfm.supabase.co
http://localhost:*
```

### 3. Verificar Configuración de Google Cloud Console

Si el problema persiste, verifica en **Google Cloud Console**:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona el proyecto correcto
3. Ve a **APIs & Services** → **Credentials**
4. Busca tu **OAuth 2.0 Client ID**
5. Verifica que en **Authorized redirect URIs** estén:
   ```
   https://rdznelijpliklisnflfm.supabase.co/auth/v1/callback
   com.bookwise.partner://auth/callback
   ```

## 🧪 Pasos para Probar

1. **Rebuild la app** después de la corrección:
   ```bash
   npm run build
   npx cap sync android
   ```

2. **Reinstalar la app** en el dispositivo

3. **Intentar login con Google** nuevamente

4. **Verificar logs** en la consola del navegador o Logcat:
   - Busca: `[CapacitorOAuth] Starting Google OAuth`
   - Busca: `[CapacitorOAuth] App opened with URL`

## 🐛 Troubleshooting

### Si sigue sin funcionar:

1. **Verificar logs de Supabase:**
   - Dashboard → **Logs** → **Auth Logs**
   - Busca errores relacionados con Google OAuth

2. **Verificar que el proveedor esté activo:**
   ```sql
   -- Verificar configuración de auth providers (si tienes acceso)
   SELECT * FROM auth.providers WHERE name = 'google';
   ```

3. **Probar en modo web primero:**
   - Abre la app en el navegador
   - Intenta login con Google
   - Si funciona en web pero no en móvil, el problema es el deep link

4. **Verificar permisos de la app:**
   - Asegúrate de que la app tenga permisos de Internet
   - Verifica que el AndroidManifest tenga las configuraciones correctas

## 📝 Checklist de Verificación

- [x] Deep link corregido en `useCapacitorOAuth.ts`
- [ ] Google OAuth habilitado en Supabase Dashboard
- [ ] URLs de redirect configuradas en Supabase
- [ ] URLs de redirect configuradas en Google Cloud Console
- [ ] App rebuild después de los cambios
- [ ] App reinstalada en el dispositivo
- [ ] Login probado nuevamente

## 🔗 Referencias

- **AndroidManifest.xml:** `com.bookwise.partner://auth/callback`
- **capacitor.config.ts:** `appId: 'com.bookwise.partner'`
- **useCapacitorOAuth.ts:** `NATIVE_REDIRECT_URL = 'com.bookwise.partner://auth/callback'`

Todos deben coincidir con el mismo scheme: `com.bookwise.partner`

