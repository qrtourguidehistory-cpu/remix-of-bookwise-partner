
# Plan de Solución - 2 Problemas Críticos

## Problema 1: Error `mapbox-gl` no encontrado

### Diagnóstico
- El paquete `mapbox-gl` **NO está en package.json** (no está instalado)
- 4 archivos lo importan directamente:
  - `src/hooks/useMapbox.ts`
  - `src/components/maps/BusinessMapDisplay.tsx`
  - `src/pages/admin/BusinessProfileSettings.tsx`
  - `src/pages/onboarding/steps/BusinessLocationStep.tsx`

### Solución
Agregar `mapbox-gl` a las dependencias del proyecto:

```json
// package.json - agregar a dependencies:
"mapbox-gl": "^3.4.0"
```

Y agregar los tipos para TypeScript:
```json
// package.json - agregar a devDependencies:
"@types/mapbox-gl": "^3.4.0"
```

---

## Problema 2: Tokens FCM Duplicados - Notificaciones Push a usuarios incorrectos

### Diagnóstico del Problema
1. **Un mismo token FCM está registrado en múltiples usuarios**
2. Firebase envía notificaciones por token (no por usuario)
3. Si un token está en varios usuarios, todos reciben la notificación
4. El flujo de login/logout NO elimina el token anterior

### Causa Raíz Identificada

En `partnerPushService.ts` (líneas 46-59):
```typescript
await supabase
  .from('client_devices')
  .upsert({
    user_id: userId,
    role: 'partner',
    platform: platform,
    fcm_token: token.value,
    // ... otros campos
  });
```

**Problema**: `upsert` usa `id` como clave por defecto, NO `fcm_token`. Esto permite que un mismo token se inserte múltiples veces con diferentes `user_id`.

### Solución Completa (4 Pasos)

#### Paso 1: Migración SQL - Limpiar duplicados y agregar UNIQUE constraint

```sql
-- 1. Crear tabla client_devices si no existe
CREATE TABLE IF NOT EXISTS client_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'client',
  platform TEXT NOT NULL DEFAULT 'android',
  fcm_token TEXT,
  device_info JSONB,
  is_active BOOLEAN DEFAULT true,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Eliminar tokens duplicados (mantener solo el más reciente)
DELETE FROM client_devices a
USING client_devices b
WHERE a.fcm_token = b.fcm_token
  AND a.fcm_token IS NOT NULL
  AND a.created_at < b.created_at;

-- 3. Agregar UNIQUE constraint para fcm_token (evitar futuros duplicados)
ALTER TABLE client_devices
ADD CONSTRAINT client_devices_fcm_token_unique UNIQUE (fcm_token);

-- 4. Crear índice para búsquedas rápidas por user_id y role
CREATE INDEX IF NOT EXISTS idx_client_devices_user_role 
ON client_devices(user_id, role);

-- 5. Habilitar RLS
ALTER TABLE client_devices ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS
CREATE POLICY "Users can manage their own devices"
ON client_devices FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all devices"
ON client_devices FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

#### Paso 2: Modificar partnerPushService.ts - Flujo de registro correcto

```typescript
// NUEVO FLUJO EN registration listener:

await PushNotifications.addListener('registration', async (token) => {
  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  
  // PASO 1: Eliminar este token de CUALQUIER otro usuario (limpieza)
  await supabase
    .from('client_devices')
    .delete()
    .eq('fcm_token', token.value)
    .neq('user_id', userId);
  
  // PASO 2: Upsert usando fcm_token como clave de conflicto
  // Esto garantiza 1 token = 1 usuario
  const { error } = await supabase
    .from('client_devices')
    .upsert(
      {
        user_id: userId,
        role: 'partner',
        platform: platform,
        fcm_token: token.value,
        is_active: true,
        enabled: true,
        device_info: { device: platform, ts: new Date().toISOString() }
      },
      { 
        onConflict: 'fcm_token',  // Si el token ya existe, actualizar
        ignoreDuplicates: false 
      }
    );
    
  if (error) {
    console.error('[PartnerPush] Error registrando token:', error);
  } else {
    console.log('[PartnerPush] ✅ Token registrado correctamente para user:', userId);
  }
});
```

#### Paso 3: Modificar AuthContext.tsx - Eliminar token al logout

La función `signOut` ya intenta marcar dispositivos como inactivos, pero necesitamos **eliminar el registro** o al menos limpiar el token:

```typescript
const signOut = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // OPCIÓN A: Eliminar completamente el registro del dispositivo
      const { error: deleteError } = await supabase
        .from('client_devices')
        .delete()
        .eq('user_id', user.id);
      
      // OPCIÓN B (alternativa): Solo limpiar el token FCM
      // await supabase
      //   .from('client_devices')
      //   .update({ fcm_token: null, is_active: false })
      //   .eq('user_id', user.id);
      
      if (deleteError) {
        console.error('[AuthContext] Error eliminando dispositivo:', deleteError);
      }
    }
  } catch (error) {
    console.error('[AuthContext] Error en cleanup:', error);
  }
  
  // Resto del logout...
};
```

#### Paso 4: Edge Function - Manejar tokens inválidos

Agregar manejo de errores cuando Firebase devuelve `registration-token-not-registered`:

```typescript
// En send-push-notification/index.ts
// Cuando se recibe error de token inválido, eliminarlo de la BD

} catch (err: any) {
  console.error(`❌ Error enviando notificación:`, err.message, err.code);
  
  // Si el token ya no es válido, eliminarlo de la BD
  if (err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-registration-token') {
    
    // Eliminar token inválido
    await fetch(`${supabaseUrl}/rest/v1/client_devices?id=eq.${deviceId}`, {
      method: 'DELETE',
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
    });
    
    console.log(`🗑️ Token inválido eliminado: device ${deviceId}`);
  }
  
  throw err;
}
```

---

## Resumen de Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `package.json` | Agregar `mapbox-gl` y `@types/mapbox-gl` |
| Nueva migración SQL | Crear tabla, limpiar duplicados, agregar UNIQUE |
| `src/services/partnerPushService.ts` | Nuevo flujo de registro con limpieza previa |
| `src/contexts/AuthContext.tsx` | Eliminar dispositivo en logout |
| `supabase/functions/send-push-notification/index.ts` | Eliminar tokens inválidos automáticamente |

---

## Diagrama del Nuevo Flujo FCM

```text
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO DE REGISTRO                        │
├─────────────────────────────────────────────────────────────┤
│  1. Usuario hace LOGIN                                      │
│  2. App solicita permisos push                              │
│  3. Firebase genera token FCM                               │
│  4. ⚠️ NUEVO: Eliminar token de otros usuarios              │
│  5. Insertar/Actualizar con UNIQUE constraint               │
│  6. ✅ 1 token = 1 usuario GARANTIZADO                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    FLUJO DE LOGOUT                          │
├─────────────────────────────────────────────────────────────┤
│  1. Usuario hace LOGOUT                                     │
│  2. ⚠️ NUEVO: Eliminar registro de client_devices           │
│  3. Limpiar listeners de push                               │
│  4. Token queda huérfano (no asociado a nadie)              │
│  5. ✅ Siguiente login de cualquier usuario lo toma         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    ENVÍO DE NOTIFICACIÓN                    │
├─────────────────────────────────────────────────────────────┤
│  1. Edge Function recibe user_id                            │
│  2. Busca dispositivos SOLO de ese user_id                  │
│  3. Envía push a Firebase                                   │
│  4. Si token inválido → eliminar de BD                      │
│  5. ✅ Solo el usuario correcto recibe la notificación      │
└─────────────────────────────────────────────────────────────┘
```

---

## Orden de Ejecución

1. **Agregar dependencia mapbox-gl** (soluciona error de build)
2. **Ejecutar migración SQL** (limpiar datos y agregar constraint)
3. **Modificar partnerPushService.ts** (nuevo flujo de registro)
4. **Modificar AuthContext.tsx** (limpieza en logout)
5. **Modificar Edge Function** (eliminar tokens inválidos)

---

## Notas Técnicas

- El constraint `UNIQUE(fcm_token)` en PostgreSQL previene inserciones duplicadas a nivel de BD
- El `upsert` con `onConflict: 'fcm_token'` actualizará el user_id si el token ya existe
- Eliminar el token al logout es más seguro que solo marcarlo como inactivo
- Firebase reutiliza tokens entre reinstalaciones, por eso la limpieza previa es crítica
