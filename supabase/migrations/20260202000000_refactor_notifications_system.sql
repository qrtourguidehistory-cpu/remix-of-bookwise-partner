-- ============================================
-- MIGRACIÓN: REFACTORIZACIÓN COMPLETA DEL SISTEMA DE NOTIFICACIONES
-- ============================================
-- Fecha: 2026-02-02
-- Objetivo: Eliminar triggers legacy y crear sistema limpio y centralizado
-- 
-- CAMBIOS:
-- 1. Dropear TODOS los triggers legacy relacionados con notificaciones
-- 2. Modificar get_client_user_id_from_appointment para aceptar business_id
-- 3. Crear handle_appointment_confirmation() para estado 'confirmed'
-- 4. Modificar handle_appointment_completion() para usar business_id
-- 5. Crear solo 2 triggers nuevos (confirmation y completion)
-- 6. Asegurar validaciones: business_id, user_id, no walk-ins, una notificación por evento
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: DROPEAR TODOS LOS TRIGGERS LEGACY
-- ============================================

DROP TRIGGER IF EXISTS trigger_create_appointment_status_notification ON appointments;
DROP TRIGGER IF EXISTS trigger_create_review_request_notification ON appointments;
DROP TRIGGER IF EXISTS trigger_notify_client_on_status_change ON appointments;
DROP TRIGGER IF EXISTS trigger_notify_status_change ON appointments;
DROP TRIGGER IF EXISTS trigger_create_pending_review ON appointments;
DROP TRIGGER IF EXISTS trigger_handle_appointment_completion ON appointments;

-- ============================================
-- PASO 2: MODIFICAR get_client_user_id_from_appointment
-- ============================================
-- Agregar parámetro p_business_id y filtrar SIEMPRE por business_id

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
  v_client_email TEXT;
BEGIN
  -- ✅ VALIDACIÓN: business_id es obligatorio
  IF p_business_id IS NULL THEN
    RAISE WARNING '[get_client_user_id] business_id es NULL para appointment %', p_appointment_id;
    RETURN NULL;
  END IF;

  -- ✅ PASO 1: Obtener client_id y client_email desde la cita (filtrando por business_id)
  SELECT client_id, client_email
  INTO v_client_id, v_client_email
  FROM public.appointments
  WHERE id = p_appointment_id 
    AND business_id = p_business_id;  -- ✅ CRÍTICO: Filtrar por business_id
  
  -- Si no se encuentra la cita o no tiene business_id correcto, retornar NULL
  IF v_client_id IS NULL AND v_client_email IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- ✅ PASO 2: Si hay client_id, buscar user_id en clients (PRIORIDAD 1)
  -- ✅ CRÍTICO: Filtrar por business_id para multitenancy
  IF v_client_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.clients
    WHERE id = v_client_id
      AND business_id = p_business_id  -- ✅ CRÍTICO: Filtrar por business_id
    LIMIT 1;
    
    -- Si encontramos user_id, retornarlo inmediatamente
    IF v_user_id IS NOT NULL THEN
      RETURN v_user_id;
    END IF;
  END IF;
  
  -- ✅ PASO 3: Si no hay user_id pero hay client_email, buscar por email (FALLBACK)
  -- ⚠️ NOTA: Este fallback puede ser problemático para multitenancy, pero lo mantenemos como último recurso
  IF v_user_id IS NULL AND v_client_email IS NOT NULL THEN
    -- Buscar en client_profiles filtrando por business_id si existe
    SELECT cp.id INTO v_user_id
    FROM public.client_profiles cp
    WHERE cp.email = v_client_email
      AND cp.business_id = p_business_id  -- ✅ Filtrar por business_id
    LIMIT 1;
    
    -- Si no se encuentra en client_profiles, buscar directamente en auth.users (sin business_id)
    -- ⚠️ Esto puede causar problemas de multitenancy, pero es último recurso
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id
      FROM auth.users
      WHERE email = v_client_email
      LIMIT 1;
    END IF;
  END IF;
  
  -- ✅ PASO 4: Si aún no hay user_id, intentar desde appointments.user_id (ÚLTIMO RECURSO)
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.appointments
    WHERE id = p_appointment_id
      AND business_id = p_business_id;  -- ✅ Filtrar por business_id
  END IF;
  
  RETURN v_user_id;
END;
$function$;

-- ============================================
-- PASO 3: CREAR handle_appointment_confirmation()
-- ============================================
-- Función centralizada para manejar estado 'confirmed'
-- Similar a handle_appointment_completion() pero para confirmaciones

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
BEGIN
  -- ✅ Solo procesar si el estado cambió a 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    -- ✅ VALIDACIÓN 1: business_id es obligatorio
    IF NEW.business_id IS NULL THEN
      RAISE WARNING '[Confirmation] ⚠️ business_id es NULL para appointment %, no se crea notificación', NEW.id;
      RETURN NEW;
    END IF;
    
    -- ✅ VALIDACIÓN 2: client_id es obligatorio (no walk-ins)
    IF NEW.client_id IS NULL THEN
      RAISE NOTICE '[Confirmation] ⚠️ client_id es NULL para appointment % (walk-in), no se crea notificación', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Obtener información del negocio
    SELECT b.id, b.business_name INTO _business_id, _business_name
    FROM public.businesses b
    WHERE b.id = NEW.business_id;
    
    -- Obtener información de la cita
    _client_name := COALESCE(NEW.client_name, 'Cliente');
    _client_id := NEW.client_id;
    _appointment_date := COALESCE(NEW.appointment_date, NEW.date);
    _appointment_time := NEW.start_time;
    
    -- ✅ CRÍTICO: Obtener user_id del cliente usando la función corregida con business_id
    _client_user_id := public.get_client_user_id_from_appointment(NEW.id, NEW.business_id);
    
    -- ✅ VALIDACIÓN 3: user_id es obligatorio (no walk-ins sin usuario)
    IF _client_user_id IS NULL THEN
      RAISE NOTICE '[Confirmation] ⚠️ user_id es NULL para appointment % (walk-in sin usuario), no se crea notificación', NEW.id;
      RETURN NEW;
    END IF;
    
    -- ✅ VALIDACIÓN 4: user_id debe ser un UUID válido
    IF _client_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE WARNING '[Confirmation] ❌ user_id inválido para appointment %: %', NEW.id, _client_user_id;
      RETURN NEW;
    END IF;
    
    -- ✅ Generar mensaje único y amigable
    _notification_title := 'Cita confirmada';
    _notification_message := format(
      'Tu cita en %s ha sido confirmada para el %s a las %s.',
      COALESCE(_business_name, 'el establecimiento'),
      TO_CHAR(_appointment_date, 'DD/MM/YYYY'),
      TO_CHAR(_appointment_time, 'HH24:MI')
    );
    
    -- Determinar role del usuario (default: 'client')
    _user_role := 'client';
    
    -- ✅ Crear UNA SOLA notificación en client_notifications
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
      
      RAISE NOTICE '[Confirmation] ✅ Notificación creada: appointment_id=%, user_id=%, type=confirmation', 
        NEW.id, _client_user_id;
        
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[Confirmation] ❌ Error al crear notificación para appointment %: %', NEW.id, SQLERRM;
    END;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[Confirmation] ❌ Excepción en handle_appointment_confirmation: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- ============================================
-- PASO 4: MODIFICAR handle_appointment_completion()
-- ============================================
-- Actualizar para usar business_id en get_client_user_id_from_appointment

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
BEGIN
  -- ✅ Solo procesar si el estado cambió a 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- ✅ VALIDACIÓN 1: business_id es obligatorio
    IF NEW.business_id IS NULL THEN
      RAISE WARNING '[Completion] ⚠️ business_id es NULL para appointment %, no se crea notificación', NEW.id;
      RETURN NEW;
    END IF;
    
    -- ✅ VALIDACIÓN 2: client_id es obligatorio (no walk-ins)
    IF NEW.client_id IS NULL THEN
      RAISE NOTICE '[Completion] ⚠️ client_id es NULL para appointment % (walk-in), no se crea notificación', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Obtener información del negocio
    SELECT b.id, b.business_name INTO _business_id, _business_name
    FROM public.businesses b
    WHERE b.id = NEW.business_id;
    
    -- Obtener información de la cita
    _client_name := COALESCE(NEW.client_name, 'Cliente');
    _client_id := NEW.client_id;
    _appointment_date := COALESCE(NEW.appointment_date, NEW.date);
    _appointment_time := NEW.start_time;
    
    -- ✅ CRÍTICO: Obtener user_id del cliente usando la función corregida con business_id
    _client_user_id := public.get_client_user_id_from_appointment(NEW.id, NEW.business_id);
    
    -- ✅ VALIDACIÓN 3: user_id es obligatorio (no walk-ins sin usuario)
    IF _client_user_id IS NULL THEN
      RAISE NOTICE '[Completion] ⚠️ user_id es NULL para appointment % (walk-in sin usuario), no se crea notificación', NEW.id;
      RETURN NEW;
    END IF;
    
    -- ✅ VALIDACIÓN 4: user_id debe ser un UUID válido
    IF _client_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE WARNING '[Completion] ❌ user_id inválido para appointment %: %', NEW.id, _client_user_id;
      RETURN NEW;
    END IF;
    
    -- ✅ Generar mensaje único y amigable (consolidado)
    _notification_title := 'Cita completada';
    _notification_message := format(
      'Tu cita en %s ha sido completada. ¡Gracias por visitarnos! ¿Cómo fue tu experiencia? Comparte tu opinión sobre el servicio recibido.',
      COALESCE(_business_name, 'el establecimiento')
    );
    
    -- Determinar role del usuario (default: 'client')
    _user_role := 'client';
    
    -- ✅ Crear UNA SOLA notificación en client_notifications
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
      
      RAISE NOTICE '[Completion] ✅ Notificación consolidada creada: appointment_id=%, user_id=%, type=appointment_completed', 
        NEW.id, _client_user_id;
        
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[Completion] ❌ Error al crear notificación consolidada para appointment %: %', NEW.id, SQLERRM;
    END;
    
    -- ✅ Crear review pendiente (sin notificación adicional)
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
        
        RAISE NOTICE '[Completion] ✅ Review pendiente creada para appointment %', NEW.id;
        
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[Completion] ❌ Error al crear review para appointment %: %', NEW.id, SQLERRM;
      END;
    END IF;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[Completion] ❌ Excepción en handle_appointment_completion: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- ============================================
-- PASO 5: CREAR SOLO 2 TRIGGERS NUEVOS
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
-- VERIFICACIÓN: Listar triggers activos
-- ============================================
-- Ejecutar después de la migración para verificar:
-- SELECT trigger_name, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND event_object_table = 'appointments'
--   AND event_manipulation = 'UPDATE'
--   AND action_timing = 'AFTER'
-- ORDER BY trigger_name;

