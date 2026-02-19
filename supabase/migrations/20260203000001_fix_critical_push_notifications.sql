-- ============================================
-- MIGRACIÓN: CORRECCIÓN CRÍTICA DE PUSH NOTIFICATIONS
-- ============================================
-- Fecha: 2026-02-03
-- Objetivo: Eliminar user_id hardcodeado y agregar validaciones estrictas
--           a TODAS las funciones que envían push notifications
-- 
-- PROBLEMAS CRÍTICOS ENCONTRADOS:
-- 1. notify_partner_safe() tiene user_id HARDCODEADO
-- 2. Falta validación de user_id en algunas funciones
-- 3. Falta validación de dispositivos activos
-- 
-- REGLA DE ORO:
-- Si no se puede determinar el usuario exacto → NO SE ENVÍA NADA
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: CORREGIR notify_partner_safe()
-- ============================================
-- PROBLEMA: Tiene user_id HARDCODEADO
-- SOLUCIÓN: Obtener owner_id del negocio y validar estrictamente

CREATE OR REPLACE FUNCTION public.notify_partner_safe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id UUID;
  v_business_id UUID;
BEGIN
  -- ✅ VALIDACIÓN 1: business_id es obligatorio
  IF NEW.business_id IS NULL THEN
    RETURN NEW;  -- Terminar silenciosamente
  END IF;
  
  v_business_id := NEW.business_id;
  
  -- ✅ VALIDACIÓN 2: Obtener owner_id del negocio
  SELECT owner_id INTO v_owner_id
  FROM public.businesses
  WHERE id = v_business_id
  LIMIT 1;
  
  -- ✅ VALIDACIÓN 3: owner_id es obligatorio
  IF v_owner_id IS NULL THEN
    RETURN NEW;  -- Terminar silenciosamente
  END IF;
  
  -- ✅ VALIDACIÓN 4: owner_id debe ser un UUID válido
  IF v_owner_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NEW;  -- Terminar silenciosamente
  END IF;
  
  -- ✅ VALIDACIÓN 5: Verificar que existen dispositivos activos
  IF NOT public.has_active_devices(v_owner_id, 'partner') THEN
    RETURN NEW;  -- Terminar silenciosamente (no hay dispositivos para enviar)
  END IF;
  
  -- ✅ TODAS LAS VALIDACIONES PASARON: Enviar notificación
  BEGIN
    PERFORM net.http_post(
      url := 'https://rdznelijpliklisnflfm.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_id', v_owner_id,
        'role', 'partner',
        'title', '🗓️ Nueva Cita',
        'message', 'Tienes una nueva reserva de ' || COALESCE(NEW.client_name, 'Cliente'),
        'appointment_id', NEW.id
      ),
      timeout_milliseconds := 2000
    );
  EXCEPTION WHEN OTHERS THEN
    -- ✅ Fail silently: Si hay error al enviar, no hacer nada
    NULL;
  END;
  
  RETURN NEW;
END;
$function$;

-- ============================================
-- PASO 2: CORREGIR fn_notify_partner_v13()
-- ============================================
-- PROBLEMA: No valida dispositivos activos
-- SOLUCIÓN: Agregar validación de dispositivos

CREATE OR REPLACE FUNCTION public.fn_notify_partner_v13()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id UUID;
  v_business_id UUID;
BEGIN
  -- ✅ VALIDACIÓN 1: business_id es obligatorio
  IF NEW.business_id IS NULL THEN
    RETURN NEW;  -- Terminar silenciosamente
  END IF;
  
  v_business_id := NEW.business_id;
  
  -- ✅ VALIDACIÓN 2: Obtener owner_id del negocio
  SELECT owner_id INTO v_owner_id
  FROM public.businesses
  WHERE id = v_business_id
  LIMIT 1;
  
  -- ✅ VALIDACIÓN 3: owner_id es obligatorio
  IF v_owner_id IS NULL THEN
    RETURN NEW;  -- Terminar silenciosamente
  END IF;
  
  -- ✅ VALIDACIÓN 4: owner_id debe ser un UUID válido
  IF v_owner_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NEW;  -- Terminar silenciosamente
  END IF;
  
  -- ✅ VALIDACIÓN 5: Verificar que existen dispositivos activos
  IF NOT public.has_active_devices(v_owner_id, 'partner') THEN
    RETURN NEW;  -- Terminar silenciosamente (no hay dispositivos para enviar)
  END IF;
  
  -- ✅ TODAS LAS VALIDACIONES PASARON: Enviar notificación
  BEGIN
    PERFORM net.http_post(
      url := 'https://rdznelijpliklisnflfm.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_id', v_owner_id,
        'role', 'partner',
        'title', '🗓️ Nueva Cita',
        'body', 'Tienes una nueva reserva de ' || COALESCE(NEW.client_name, 'Cliente')
      ),
      timeout_milliseconds := 2000
    );
  EXCEPTION WHEN OTHERS THEN
    -- ✅ Fail silently: Si hay error al enviar, no hacer nada
    NULL;
  END;
  
  RETURN NEW;
END;
$function$;

-- ============================================
-- PASO 3: CORREGIR notify_partner_new_appointment()
-- ============================================
-- PROBLEMA: No valida dispositivos activos
-- SOLUCIÓN: Agregar validación de dispositivos antes de insertar

CREATE OR REPLACE FUNCTION public.notify_partner_new_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_business_id UUID;
  v_owner_id UUID;
  v_client_name TEXT;
BEGIN
  -- ✅ VALIDACIÓN 1: business_id es obligatorio
  IF NEW.business_id IS NULL THEN
    RETURN NEW;  -- Terminar silenciosamente
  END IF;
  
  v_business_id := NEW.business_id;
  
  -- ✅ VALIDACIÓN 2: Obtener owner_id del negocio
  SELECT b.id, b.owner_id INTO v_business_id, v_owner_id
  FROM public.businesses b
  WHERE b.id = NEW.business_id
  LIMIT 1;
  
  -- ✅ VALIDACIÓN 3: owner_id es obligatorio
  IF v_owner_id IS NULL THEN
    RETURN NEW;  -- Terminar silenciosamente
  END IF;
  
  -- ✅ VALIDACIÓN 4: owner_id debe ser un UUID válido
  IF v_owner_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NEW;  -- Terminar silenciosamente
  END IF;
  
  -- ✅ VALIDACIÓN 5: Verificar que existen dispositivos activos
  IF NOT public.has_active_devices(v_owner_id, 'partner') THEN
    RETURN NEW;  -- Terminar silenciosamente (no hay dispositivos para enviar)
  END IF;
  
  -- ✅ Obtener nombre del cliente si existe
  IF NEW.client_id IS NOT NULL THEN
    SELECT full_name INTO v_client_name
    FROM public.clients
    WHERE id = NEW.client_id
      AND business_id = v_business_id
    LIMIT 1;
  END IF;
  
  -- ✅ TODAS LAS VALIDACIONES PASARON: Insertar notificación
  BEGIN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      read,
      created_at,
      link
    ) VALUES (
      v_owner_id,
      'new_appointment',
      'Nueva cita recibida',
      COALESCE(v_client_name, 'Cliente') || ' ha reservado una cita para el ' || 
      TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY') || ' a las ' || NEW.start_time,
      false,
      NOW(),
      '/admin/appointments'
    );
  EXCEPTION WHEN OTHERS THEN
    -- ✅ Fail silently: Si hay error al insertar, no hacer nada
    NULL;
  END;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- ✅ Fail silently: Cualquier excepción → terminar sin hacer nada
    RETURN NEW;
END;
$function$;

-- ============================================
-- PASO 4: CREAR FUNCIÓN HELPER PARA VALIDAR USER_ID EN EDGE FUNCTIONS
-- ============================================
-- Esta función puede ser llamada desde Edge Functions para validar user_id
-- antes de insertar en client_notifications

CREATE OR REPLACE FUNCTION public.validate_user_id_for_notification(
  p_user_id uuid,
  p_role text DEFAULT 'client'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- ✅ VALIDACIÓN 1: user_id es obligatorio
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- ✅ VALIDACIÓN 2: user_id debe ser un UUID válido
  IF p_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN FALSE;
  END IF;
  
  -- ✅ VALIDACIÓN 3: Verificar que existen dispositivos activos
  IF NOT public.has_active_devices(p_user_id, p_role) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$function$;

COMMIT;

-- ============================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================
-- Verificar que las funciones fueron actualizadas:
-- 
-- SELECT 
--   proname as function_name,
--   pg_get_function_arguments(oid) as arguments
-- FROM pg_proc
-- WHERE proname IN (
--   'notify_partner_safe',
--   'fn_notify_partner_v13',
--   'notify_partner_new_appointment',
--   'validate_user_id_for_notification'
-- )
-- ORDER BY proname;
--
-- Verificar que NO hay user_id hardcodeado:
-- 
-- SELECT 
--   proname,
--   pg_get_functiondef(oid) as definition
-- FROM pg_proc
-- WHERE proname IN (
--   'notify_partner_safe',
--   'fn_notify_partner_v13',
--   'notify_partner_new_appointment'
-- )
-- AND pg_get_functiondef(oid) LIKE '%3a3e0599-296c-4cb2-8658-e3a095de75d1%';
--
-- Debe retornar 0 filas (ninguna función con user_id hardcodeado)



