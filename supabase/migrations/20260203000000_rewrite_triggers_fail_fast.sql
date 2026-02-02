-- ============================================
-- MIGRACIÓN: REESCRITURA COMPLETA DE TRIGGERS CON ENFOQUE FAIL-FAST
-- ============================================
-- Fecha: 2026-02-03
-- Objetivo: Eliminar TODOS los fallbacks y garantizar que sea IMPOSIBLE
--           enviar una notificación sin la cadena completa:
--           appointment → client → user_id → dispositivos
-- 
-- REGLA DE ORO:
-- Si no existe la cadena completa → NO HACER NADA (terminar silenciosamente)
-- Preferimos perder 100 notificaciones antes que enviar 1 incorrecta
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: ELIMINAR FUNCIONES Y TRIGGERS EXISTENTES
-- ============================================

DROP TRIGGER IF EXISTS trigger_handle_appointment_confirmation ON appointments;
DROP TRIGGER IF EXISTS trigger_handle_appointment_completion ON appointments;
DROP FUNCTION IF EXISTS public.handle_appointment_confirmation();
DROP FUNCTION IF EXISTS public.handle_appointment_completion();
DROP FUNCTION IF EXISTS public.get_client_user_id_from_appointment(uuid, uuid);

-- ============================================
-- PASO 2: FUNCIÓN SIMPLIFICADA SIN FALLBACKS
-- ============================================
-- SOLO busca en clients con business_id
-- Si no encuentra → retorna NULL (sin intentar alternativas)
-- CERO búsquedas por email
-- CERO uso de appointments.user_id
-- CERO búsquedas en client_profiles o auth.users

CREATE OR REPLACE FUNCTION public.get_client_user_id_from_appointment(
  p_appointment_id uuid,
  p_business_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_client_id UUID;
BEGIN
  -- ✅ VALIDACIÓN 1: business_id es obligatorio
  IF p_business_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- ✅ VALIDACIÓN 2: appointment_id es obligatorio
  IF p_appointment_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- ✅ PASO ÚNICO: Obtener client_id desde la cita (filtrando por business_id)
  SELECT client_id
  INTO v_client_id
  FROM public.appointments
  WHERE id = p_appointment_id 
    AND business_id = p_business_id
  LIMIT 1;
  
  -- Si no se encuentra la cita o no tiene client_id, retornar NULL
  IF v_client_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- ✅ PASO ÚNICO: Buscar user_id en clients (PRIORIDAD ÚNICA, SIN FALLBACKS)
  -- CRÍTICO: Filtrar por business_id para multitenancy
  -- CRÍTICO: Solo retornar si user_id NO es NULL
  SELECT user_id INTO v_user_id
  FROM public.clients
  WHERE id = v_client_id
    AND business_id = p_business_id
    AND user_id IS NOT NULL  -- ✅ CRÍTICO: Solo si tiene user_id
  LIMIT 1;
  
  -- ✅ VALIDACIÓN 3: user_id debe ser un UUID válido
  IF v_user_id IS NOT NULL THEN
    IF v_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN NULL;  -- UUID inválido
    END IF;
  END IF;
  
  -- Retornar user_id (puede ser NULL si no se encontró)
  RETURN v_user_id;
END;
$function$;

-- ============================================
-- PASO 3: FUNCIÓN PARA VALIDAR QUE EXISTEN DISPOSITIVOS
-- ============================================
-- Valida que el user_id tenga al menos un dispositivo activo
-- Si no hay dispositivos → retorna FALSE (no enviar notificación)

CREATE OR REPLACE FUNCTION public.has_active_devices(
  p_user_id uuid,
  p_role text DEFAULT 'client'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_device_count INTEGER;
BEGIN
  -- ✅ VALIDACIÓN: user_id es obligatorio
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- ✅ VALIDACIÓN: user_id debe ser un UUID válido
  IF p_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN FALSE;
  END IF;

  -- ✅ Contar dispositivos activos para este user_id y role
  SELECT COUNT(*) INTO v_device_count
  FROM public.client_devices
  WHERE user_id = p_user_id
    AND role = p_role
    AND enabled = true
    AND fcm_token IS NOT NULL
    AND fcm_token != '';

  -- Retornar TRUE solo si hay al menos un dispositivo activo
  RETURN v_device_count > 0;
END;
$function$;

-- ============================================
-- PASO 4: REESCRIBIR handle_appointment_confirmation()
-- ============================================
-- REGLA DE ORO: Si falta CUALQUIER dato → terminar sin hacer nada
-- Validar cadena completa: appointment → client → user_id → dispositivos

CREATE OR REPLACE FUNCTION public.handle_appointment_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _business_id UUID;
  _business_name TEXT;
  _client_name TEXT;
  _client_user_id UUID;
  _client_id UUID;
  _appointment_date DATE;
  _appointment_time TIME;
  _notification_title TEXT;
  _notification_message TEXT;
  _user_role TEXT;
  _has_devices BOOLEAN;
BEGIN
  -- ✅ Solo procesar si el estado cambió a 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    -- ✅ VALIDACIÓN 1: business_id es obligatorio
    IF NEW.business_id IS NULL THEN
      RETURN NEW;  -- Terminar silenciosamente
    END IF;
    
    -- ✅ VALIDACIÓN 2: client_id es obligatorio (no walk-ins)
    IF NEW.client_id IS NULL THEN
      RETURN NEW;  -- Terminar silenciosamente
    END IF;
    
    -- ✅ VALIDACIÓN 3: Obtener user_id del cliente (SIN FALLBACKS)
    _client_user_id := public.get_client_user_id_from_appointment(NEW.id, NEW.business_id);
    
    -- ✅ VALIDACIÓN 4: user_id es obligatorio
    IF _client_user_id IS NULL THEN
      RETURN NEW;  -- Terminar silenciosamente
    END IF;
    
    -- ✅ VALIDACIÓN 5: user_id debe ser un UUID válido
    IF _client_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN NEW;  -- Terminar silenciosamente
    END IF;
    
    -- ✅ VALIDACIÓN 6: Verificar que el cliente existe y pertenece al negocio
    SELECT id, full_name INTO _client_id, _client_name
    FROM public.clients
    WHERE id = NEW.client_id
      AND business_id = NEW.business_id
      AND user_id = _client_user_id  -- ✅ CRÍTICO: Verificar que user_id coincide
    LIMIT 1;
    
    IF _client_id IS NULL THEN
      RETURN NEW;  -- Terminar silenciosamente
    END IF;
    
    -- ✅ VALIDACIÓN 7: Verificar que existen dispositivos activos
    _has_devices := public.has_active_devices(_client_user_id, 'client');
    
    IF NOT _has_devices THEN
      RETURN NEW;  -- Terminar silenciosamente (no hay dispositivos para enviar)
    END IF;
    
    -- ✅ VALIDACIÓN 8: Obtener información del negocio
    SELECT id, business_name INTO _business_id, _business_name
    FROM public.businesses b
    WHERE b.id = NEW.business_id
    LIMIT 1;
    
    IF _business_id IS NULL THEN
      RETURN NEW;  -- Terminar silenciosamente
    END IF;
    
    -- ✅ TODAS LAS VALIDACIONES PASARON: Proceder a crear notificación
    _client_name := COALESCE(_client_name, NEW.client_name, 'Cliente');
    _appointment_date := COALESCE(NEW.appointment_date, NEW.date);
    _appointment_time := NEW.start_time;
    
    -- Generar mensaje
    _notification_title := 'Cita confirmada';
    _notification_message := format(
      'Tu cita en %s ha sido confirmada para el %s a las %s.',
      COALESCE(_business_name, 'el establecimiento'),
      TO_CHAR(_appointment_date, 'DD/MM/YYYY'),
      TO_CHAR(_appointment_time, 'HH24:MI')
    );
    
    _user_role := 'client';
    
    -- ✅ Crear notificación (solo si todas las validaciones pasaron)
    BEGIN
      INSERT INTO public.client_notifications (
        user_id,
        client_id,
        appointment_id,
        business_id,
        type,
        title,
        message,
        role,
        read,
        meta
      ) VALUES (
        _client_user_id,
        _client_id,
        NEW.id,
        _business_id,
        'confirmation',
        _notification_title,
        _notification_message,
        _user_role,
        false,
        jsonb_build_object(
          'type', 'confirmation',
          'business_id', _business_id,
          'business_name', _business_name,
          'appointment_date', _appointment_date::text,
          'appointment_time', _appointment_time::text,
          'consolidated', true
        )
      );
        
    EXCEPTION WHEN OTHERS THEN
      -- ✅ Fail silently: Si hay error al insertar, no hacer nada
      NULL;
    END;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- ✅ Fail silently: Cualquier excepción → terminar sin hacer nada
    RETURN NEW;
END;
$function$;

-- ============================================
-- PASO 5: REESCRIBIR handle_appointment_completion()
-- ============================================
-- REGLA DE ORO: Si falta CUALQUIER dato → terminar sin hacer nada
-- Validar cadena completa: appointment → client → user_id → dispositivos

CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _business_id UUID;
  _business_name TEXT;
  _client_name TEXT;
  _client_user_id UUID;
  _client_id UUID;
  _appointment_date DATE;
  _appointment_time TIME;
  _notification_title TEXT;
  _notification_message TEXT;
  _user_role TEXT;
  _has_devices BOOLEAN;
BEGIN
  -- ✅ Solo procesar si el estado cambió a 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- ✅ VALIDACIÓN 1: business_id es obligatorio
    IF NEW.business_id IS NULL THEN
      RETURN NEW;  -- Terminar silenciosamente
    END IF;
    
    -- ✅ VALIDACIÓN 2: client_id es obligatorio (no walk-ins)
    IF NEW.client_id IS NULL THEN
      RETURN NEW;  -- Terminar silenciosamente
    END IF;
    
    -- ✅ VALIDACIÓN 3: Obtener user_id del cliente (SIN FALLBACKS)
    _client_user_id := public.get_client_user_id_from_appointment(NEW.id, NEW.business_id);
    
    -- ✅ VALIDACIÓN 4: user_id es obligatorio
    IF _client_user_id IS NULL THEN
      RETURN NEW;  -- Terminar silenciosamente
    END IF;
    
    -- ✅ VALIDACIÓN 5: user_id debe ser un UUID válido
    IF _client_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN NEW;  -- Terminar silenciosamente
    END IF;
    
    -- ✅ VALIDACIÓN 6: Verificar que el cliente existe y pertenece al negocio
    SELECT id, full_name INTO _client_id, _client_name
    FROM public.clients
    WHERE id = NEW.client_id
      AND business_id = NEW.business_id
      AND user_id = _client_user_id  -- ✅ CRÍTICO: Verificar que user_id coincide
    LIMIT 1;
    
    IF _client_id IS NULL THEN
      RETURN NEW;  -- Terminar silenciosamente
    END IF;
    
    -- ✅ VALIDACIÓN 7: Verificar que existen dispositivos activos
    _has_devices := public.has_active_devices(_client_user_id, 'client');
    
    IF NOT _has_devices THEN
      RETURN NEW;  -- Terminar silenciosamente (no hay dispositivos para enviar)
    END IF;
    
    -- ✅ VALIDACIÓN 8: Obtener información del negocio
    SELECT id, business_name INTO _business_id, _business_name
    FROM public.businesses b
    WHERE b.id = NEW.business_id
    LIMIT 1;
    
    IF _business_id IS NULL THEN
      RETURN NEW;  -- Terminar silenciosamente
    END IF;
    
    -- ✅ TODAS LAS VALIDACIONES PASARON: Proceder a crear notificación
    _client_name := COALESCE(_client_name, NEW.client_name, 'Cliente');
    _appointment_date := COALESCE(NEW.appointment_date, NEW.date);
    _appointment_time := NEW.start_time;
    
    -- Generar mensaje
    _notification_title := 'Cita completada';
    _notification_message := format(
      'Tu cita en %s ha sido completada. ¡Gracias por visitarnos! ¿Cómo fue tu experiencia? Comparte tu opinión sobre el servicio recibido.',
      COALESCE(_business_name, 'el establecimiento')
    );
    
    _user_role := 'client';
    
    -- ✅ Crear notificación (solo si todas las validaciones pasaron)
    BEGIN
      INSERT INTO public.client_notifications (
        user_id,
        client_id,
        appointment_id,
        business_id,
        type,
        title,
        message,
        role,
        read,
        meta
      ) VALUES (
        _client_user_id,
        _client_id,
        NEW.id,
        _business_id,
        'appointment_completed',
        _notification_title,
        _notification_message,
        _user_role,
        false,
        jsonb_build_object(
          'type', 'appointment_completed',
          'business_id', _business_id,
          'business_name', _business_name,
          'appointment_date', _appointment_date::text,
          'appointment_time', _appointment_time::text,
          'request_review', true,
          'consolidated', true
        )
      );
        
    EXCEPTION WHEN OTHERS THEN
      -- ✅ Fail silently: Si hay error al insertar, no hacer nada
      NULL;
    END;
    
    -- ✅ Crear review pendiente (solo si todas las validaciones pasaron)
    IF NOT EXISTS (SELECT 1 FROM public.reviews WHERE appointment_id = NEW.id) THEN
      BEGIN
        INSERT INTO public.reviews (
          appointment_id,
          client_id,
          business_id,
          rating,
          comment,
          status,
          expiration_date,
          notification_sent,
          created_at
        )
        VALUES (
          NEW.id,
          _client_id,
          _business_id,
          NULL,
          NULL,
          'pending',
          NOW() + INTERVAL '24 hours',
          false,
          NOW()
        );
        
      EXCEPTION WHEN OTHERS THEN
        -- ✅ Fail silently: Si hay error al insertar review, no hacer nada
        NULL;
      END;
    END IF;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- ✅ Fail silently: Cualquier excepción → terminar sin hacer nada
    RETURN NEW;
END;
$function$;

-- ============================================
-- PASO 6: CREAR TRIGGERS NUEVOS
-- ============================================

-- Trigger para estado 'confirmed'
CREATE TRIGGER trigger_handle_appointment_confirmation
AFTER UPDATE ON appointments
FOR EACH ROW
WHEN (NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed'))
EXECUTE FUNCTION handle_appointment_confirmation();

-- Trigger para estado 'completed'
CREATE TRIGGER trigger_handle_appointment_completion
AFTER UPDATE ON appointments
FOR EACH ROW
WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
EXECUTE FUNCTION handle_appointment_completion();

COMMIT;

-- ============================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================
-- Ejecutar después de la migración para verificar:
-- 
-- SELECT 
--   trigger_name, 
--   event_manipulation,
--   action_timing,
--   action_statement
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND event_object_table = 'appointments'
-- ORDER BY trigger_name;
--
-- Debe mostrar solo 2 triggers:
-- 1. trigger_handle_appointment_confirmation (UPDATE, AFTER)
-- 2. trigger_handle_appointment_completion (UPDATE, AFTER)

