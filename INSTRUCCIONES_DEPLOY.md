# 📦 Instrucciones para Deploy de Edge Functions

## Edge Functions que Necesitan Deploy

Se corrigieron 2 Edge Functions que deben desplegarse:

1. **`notify-appointment-confirmed`** - Notificación push cuando se mueve/confirma una cita
2. **`process-notifications`** - Procesa notificaciones programadas

## Opción 1: Deploy desde Supabase Dashboard (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Navega a **Edge Functions** en el menú lateral
3. Para cada función:
   - Haz clic en la función
   - Haz clic en **Deploy** o **Redeploy**
   - O usa el botón de **Upload** para subir el archivo `index.ts` actualizado

## Opción 2: Deploy desde CLI de Supabase (RECOMENDADO)

Usa `npx` para ejecutar el CLI sin instalarlo globalmente:

```bash
# Deploy de las funciones (npx instalará el CLI automáticamente si es necesario)
npx supabase functions deploy notify-appointment-confirmed
npx supabase functions deploy process-notifications
```

**Nota:** Si es la primera vez, `npx` instalará automáticamente el CLI de Supabase. Solo necesitas estar autenticado en Supabase (se abrirá el navegador para login si es necesario).

## Opción 3: Deploy Manual (Subir archivos)

1. Ve a Supabase Dashboard → Edge Functions
2. Para cada función, edita el código directamente en el editor
3. Copia y pega el contenido actualizado de:
   - `supabase/functions/notify-appointment-confirmed/index.ts`
   - `supabase/functions/process-notifications/index.ts`
4. Guarda y despliega

## ✅ Verificación Post-Deploy

Después del deploy, prueba moviendo una cita:
1. Mueve una cita al día 23 de febrero
2. Verifica que la notificación push muestre "23 de febrero" (no "22 de febrero")

---

**Nota:** El archivo `src/lib/processScheduledNotifications.ts` es código del cliente y se actualizará automáticamente cuando hagas el próximo build de la app.

