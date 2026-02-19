# 🚀 Instrucciones de Deploy: RevenueCat Webhook

## ✅ Pre-requisitos

1. **Supabase CLI instalado y configurado**
   ```bash
   # Verificar instalación
   supabase --version
   
   # Si no está instalado:
   # Windows (PowerShell):
   scoop install supabase
   # O descargar desde: https://github.com/supabase/cli/releases
   ```

2. **Autenticado en Supabase**
   ```bash
   supabase login
   ```

3. **Proyecto vinculado**
   ```bash
   # Si no está vinculado, ejecutar:
   supabase link --project-ref TU_PROJECT_REF
   ```

---

## 📋 Paso 1: Verificar la Migración SQL

La columna `is_premium` ya existe según la migración `20260215000000_add_is_premium_to_profiles.sql`.

**Si necesitas ejecutarla manualmente:**

```sql
-- Ejecutar en Supabase SQL Editor o via CLI:
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_is_premium 
ON profiles(is_premium) 
WHERE is_premium = true;

COMMENT ON COLUMN profiles.is_premium IS 'Indicates if user has premium access via RevenueCat/Google Play subscription';
```

**O ejecutar la migración completa:**
```bash
supabase db push
```

---

## 📋 Paso 2: Verificar Variables de Entorno

Las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` se configuran automáticamente en Supabase Edge Functions, pero puedes verificar que estén disponibles:

```bash
# Verificar variables de entorno del proyecto
supabase secrets list
```

**Nota:** `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` están disponibles automáticamente en todas las Edge Functions, no necesitas configurarlas manualmente.

---

## 📋 Paso 3: Deploy de la Edge Function

### Opción A: Deploy desde Terminal (Recomendado)

```bash
# 1. Navegar al directorio del proyecto
cd "C:\Users\laptop\Desktop\Mi Turnow Partner\Mi Turnow Partner"

# 2. Verificar que la función existe
ls supabase/functions/revenuecat-webhook/index.ts

# 3. Deploy de la función
supabase functions deploy revenuecat-webhook

# 4. Verificar que el deploy fue exitoso
supabase functions list
```

### Opción B: Deploy con Project Ref Específico

Si tienes múltiples proyectos o necesitas especificar el project ref:

```bash
# Obtener tu project ref desde Supabase Dashboard
# URL: https://supabase.com/dashboard/project/TU_PROJECT_REF

# Deploy con project ref
supabase functions deploy revenuecat-webhook --project-ref TU_PROJECT_REF
```

### Opción C: Deploy desde Supabase Dashboard

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleccionar tu proyecto
3. Ir a **Edge Functions** en el menú lateral
4. Click en **Deploy function**
5. Seleccionar `revenuecat-webhook` o crear nueva función
6. Copiar el contenido de `supabase/functions/revenuecat-webhook/index.ts`
7. Click en **Deploy**

---

## 📋 Paso 4: Obtener la URL del Webhook

Después del deploy, obtén la URL de tu función:

```bash
# Opción 1: Desde terminal
supabase functions list

# Opción 2: Desde el código (la URL sigue este patrón):
# https://TU_PROJECT_REF.supabase.co/functions/v1/revenuecat-webhook
```

**Formato de la URL:**
```
https://[TU_PROJECT_REF].supabase.co/functions/v1/revenuecat-webhook
```

**Ejemplo:**
```
https://rdznelijpliklisnflfm.supabase.co/functions/v1/revenuecat-webhook
```

---

## 📋 Paso 5: Configurar Webhook en RevenueCat Dashboard

1. **Ir a RevenueCat Dashboard**
   - URL: https://app.revenuecat.com/
   - Seleccionar tu proyecto

2. **Navegar a Webhooks**
   - Ir a **Project Settings** → **Integrations** → **Webhooks**
   - O directamente: https://app.revenuecat.com/projects/[TU_PROJECT]/integrations/webhooks

3. **Agregar Webhook**
   - Click en **Add Webhook** o **Configure Webhook**
   - **Webhook URL:** `https://[TU_PROJECT_REF].supabase.co/functions/v1/revenuecat-webhook`
   - **Events:** Seleccionar los eventos que quieres recibir:
     - ✅ `INITIAL_PURCHASE`
     - ✅ `RENEWAL`
     - ✅ `CANCELLATION`
     - ✅ `EXPIRATION`
     - ✅ `REACTIVATION` (opcional)
     - ✅ `UNCANCELLATION` (opcional)
     - ✅ `BILLING_ISSUE` (opcional)
     - ✅ `SUBSCRIPTION_PAUSED` (opcional)

4. **Guardar Configuración**
   - Click en **Save** o **Update**

---

## 📋 Paso 6: Verificar que Funciona

### Opción 1: Probar desde RevenueCat Dashboard

1. Ir a **RevenueCat Dashboard** → **Customers**
2. Seleccionar un usuario de prueba
3. Simular un evento (si RevenueCat lo permite)
4. Verificar logs en Supabase

### Opción 2: Probar con cURL

```bash
# Reemplazar con tu URL y un UUID de prueba
curl -X POST https://[TU_PROJECT_REF].supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "id": "test-event-123",
      "type": "INITIAL_PURCHASE",
      "app_user_id": "TU_UUID_DE_PRUEBA",
      "product_id": "partner_mensual_pro"
    }
  }'
```

### Opción 3: Verificar Logs en Supabase

```bash
# Ver logs en tiempo real
supabase functions logs revenuecat-webhook --follow

# Ver logs recientes
supabase functions logs revenuecat-webhook
```

O desde Supabase Dashboard:
1. Ir a **Edge Functions** → **revenuecat-webhook**
2. Click en **Logs**
3. Verificar que aparezcan logs cuando RevenueCat envía eventos

---

## 📋 Paso 7: Verificar en Base de Datos

Después de recibir un evento, verificar que `is_premium` se actualizó:

```sql
-- En Supabase SQL Editor:
SELECT id, is_premium, updated_at 
FROM profiles 
WHERE id = 'TU_UUID_DE_PRUEBA';
```

O desde terminal:

```bash
# Ejecutar query SQL
supabase db query "SELECT id, is_premium, updated_at FROM profiles WHERE id = 'TU_UUID_DE_PRUEBA';"
```

---

## 🔍 Troubleshooting

### Error: "Function not found"
```bash
# Verificar que la función existe
ls supabase/functions/revenuecat-webhook/

# Re-deploy
supabase functions deploy revenuecat-webhook
```

### Error: "Unauthorized" o "401"
- Verificar que `SUPABASE_SERVICE_ROLE_KEY` esté configurado (se configura automáticamente)
- Verificar que RevenueCat esté enviando la request correctamente

### Error: "Profile not found"
- El `app_user_id` debe ser un UUID válido que exista en la tabla `profiles`
- La función intentará crear el perfil si no existe, pero es mejor asegurarse de que el usuario ya tenga perfil

### No se reciben eventos
1. Verificar que el webhook esté configurado en RevenueCat Dashboard
2. Verificar que la URL sea correcta (sin espacios, con HTTPS)
3. Verificar logs en Supabase: `supabase functions logs revenuecat-webhook --follow`
4. Verificar que los eventos estén habilitados en RevenueCat Dashboard

### La columna is_premium no se actualiza
1. Verificar logs: `supabase functions logs revenuecat-webhook`
2. Verificar que el `app_user_id` coincida con un `id` en la tabla `profiles`
3. Verificar que el tipo de evento sea uno de los soportados:
   - `INITIAL_PURCHASE`, `RENEWAL`, `REACTIVATION`, `UNCANCELLATION` → `is_premium = true`
   - `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`, `SUBSCRIPTION_PAUSED` → `is_premium = false`

---

## ✅ Checklist Final

- [ ] Migración SQL ejecutada (columna `is_premium` existe)
- [ ] Edge Function desplegada: `supabase functions deploy revenuecat-webhook`
- [ ] URL del webhook obtenida: `https://[PROJECT_REF].supabase.co/functions/v1/revenuecat-webhook`
- [ ] Webhook configurado en RevenueCat Dashboard con la URL correcta
- [ ] Eventos seleccionados en RevenueCat Dashboard
- [ ] Prueba realizada (evento de prueba o compra real)
- [ ] Logs verificados: `supabase functions logs revenuecat-webhook`
- [ ] Base de datos verificada: `SELECT is_premium FROM profiles WHERE id = 'UUID'`

---

## 📚 Referencias

- **Supabase Edge Functions Docs:** https://supabase.com/docs/guides/functions
- **RevenueCat Webhooks Docs:** https://www.revenuecat.com/docs/webhooks
- **Supabase CLI Docs:** https://supabase.com/docs/reference/cli

---

**¡Listo! Tu webhook de RevenueCat está configurado y funcionando.** 🎉

