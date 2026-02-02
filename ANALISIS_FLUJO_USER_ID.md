# 🔍 ANÁLISIS COMPLETO: FLUJO DE USER_ID EN PUSH NOTIFICATIONS

**Fecha:** 2026-02-02  
**Objetivo:** Identificar por qué todas las notificaciones llegan al mismo usuario

---

## 📋 ANÁLISIS DE FUNCIONES

### ✅ 1. Función `call_send_push_notification()`

**Código Completo:**
```sql
CREATE OR REPLACE FUNCTION public.call_send_push_notification(
  p_user_id uuid, 
  p_role text, 
  p_title text, 
  p_body text, 
  p_notification_id uuid DEFAULT NULL::uuid, 
  p_data jsonb DEFAULT NULL::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url TEXT := 'https://rdznelijpliklisnflfm.supabase.co';
  v_service_role_key TEXT;
  v_function_url TEXT;
  v_response_id BIGINT;
  v_request_body JSONB;
  v_normalized_role TEXT;
BEGIN
  IF p_user_id IS NULL OR p_title IS NULL OR p_body IS NULL THEN
    RETURN;
  END IF;
  
  v_normalized_role := LOWER(TRIM(COALESCE(p_role, 'client')));
  
  v_function_url := v_supabase_url || '/functions/v1/send-push-notification';
  
  v_service_role_key := public.get_service_role_key();
  
  -- ✅ PAYLOAD CONSTRUIDO CORRECTAMENTE
  v_request_body := jsonb_build_object(
    'user_id', p_user_id::text,  -- ✅ USA p_user_id (correcto)
    'title', p_title,
    'body', p_body,
    'role', v_normalized_role,
    'data', COALESCE(p_data, '{}'::jsonb),
    'notification_id', CASE WHEN p_notification_id IS NOT NULL THEN p_notification_id::text ELSE NULL END
  );
  
  RAISE NOTICE '[Push] URL: %, user_id: %, role: %', v_function_url, p_user_id, v_normalized_role;
  
  SELECT net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := v_request_body,  -- ✅ ENVÍA EL PAYLOAD DIRECTAMENTE
    timeout_milliseconds := 30000
  ) INTO v_response_id;
  
  RAISE NOTICE '[Push] Encolado: job_id=%', v_response_id;
END;
$function$;
```

**✅ Verificación:**
- ✅ **NO usa `auth.uid()`** - Usa `p_user_id` del parámetro
- ✅ **NO usa `current_user`** - Usa `p_user_id` del parámetro
- ✅ **NO usa `owner_id`** - Usa `p_user_id` del parámetro
- ✅ **NO usa valores hardcodeados** - Usa `p_user_id` del parámetro
- ✅ **Payload incluye explícitamente `user_id`:** `'user_id', p_user_id::text`

**Conclusión:** ✅ La función SQL está CORRECTA.

---

### ⚠️ 2. Edge Function `send-push-notification`

**Código Relevante:**
```typescript
serve(async (req: Request) => {
  try {
    const requestBody: RequestBody = await req.json();
    
    // Extract payload: handle both direct calls and webhook/trigger calls
    const record = requestBody.record || requestBody;  // ⚠️ PROBLEMA POTENCIAL
    
    // ...
    
    const targetUserId = record.user_id || record.userId || record.clientId;  // ⚠️ BUSCA EN RECORD
```

**⚠️ Problema Identificado:**

1. **`call_send_push_notification()` envía el payload directamente:**
   ```json
   {
     "user_id": "ef2e21d7-999f-4301-8b05-00b9605f36c0",
     "title": "Cita confirmada",
     "body": "Tu cita...",
     "role": "client",
     "data": {...},
     "notification_id": "..."
   }
   ```

2. **Edge Function busca primero en `requestBody.record`:**
   ```typescript
   const record = requestBody.record || requestBody;
   ```
   
   Si `requestBody.record` existe pero está vacío o tiene un `user_id` diferente, usará ese en lugar del correcto.

3. **Luego busca `user_id` en `record`:**
   ```typescript
   const targetUserId = record.user_id || record.userId || record.clientId;
   ```

**🔴 PROBLEMA POTENCIAL:**
- Si `requestBody.record` existe (aunque sea `{}` o `null`), se usará en lugar de `requestBody`
- Si `requestBody.record.user_id` existe pero es incorrecto, se usará ese

---

## 🔍 DIAGNÓSTICO

### Escenario Actual:

1. **`call_send_push_notification()` envía:**
   ```json
   {
     "user_id": "ef2e21d7-999f-4301-8b05-00b9605f36c0",  // ✅ CORRECTO
     "title": "Cita confirmada",
     "body": "...",
     "role": "client",
     "data": {...}
   }
   ```

2. **Edge Function recibe:**
   ```typescript
   requestBody = {
     user_id: "ef2e21d7-999f-4301-8b05-00b9605f36c0",  // ✅ CORRECTO
     title: "Cita confirmada",
     ...
   }
   ```

3. **Edge Function procesa:**
   ```typescript
   const record = requestBody.record || requestBody;
   // Si requestBody.record no existe, record = requestBody ✅
   
   const targetUserId = record.user_id || record.userId || record.clientId;
   // Debería obtener "ef2e21d7-999f-4301-8b05-00b9605f36c0" ✅
   ```

**Conclusión:** El código DEBERÍA funcionar correctamente, pero necesitamos logs para confirmar qué está pasando realmente.

---

## 🔧 SOLUCIÓN: AGREGAR LOGS DETALLADOS

Necesitamos agregar logs en la Edge Function para ver:
1. El payload completo recibido
2. El `user_id` extraído
3. El `user_id` usado para buscar dispositivos

---

**FIN DEL ANÁLISIS**

