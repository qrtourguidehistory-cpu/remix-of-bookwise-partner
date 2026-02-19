-- ============================================
-- PREPARACIÓN DB PARA ARQUITECTURA HÍBRIDA (OPCIÓN D)
-- ============================================
-- Objetivo: Preparar la base de datos para soportar inserciones idempotentes
-- desde Edge Functions, sin duplicados.
--
-- Cambios:
-- 1. Crear constraint UNIQUE para prevenir duplicados lógicos
-- 2. Modificar triggers SQL para que sean idempotentes (ON CONFLICT DO NOTHING)
--
-- Fecha: 2025-02-03
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: CREAR CONSTRAINT UNIQUE PARA client_notifications
-- ============================================
-- Constraint: (user_id, appointment_id, type)
-- 
-- Justificación:
-- - user_id: Identifica al usuario que recibe la notificación
-- - appointment_id: Identifica la cita relacionada (puede ser NULL para notificaciones no relacionadas a citas)
-- - type: Tipo de notificación ('confirmation', 'appointment_completed', etc.)
--
-- Nota: En PostgreSQL, NULL != NULL en constraints UNIQUE, así que si appointment_id es NULL,
-- múltiples filas pueden tener el mismo (user_id, NULL, type). Para notificaciones relacionadas
-- a citas (que es nuestro caso principal), appointment_id siempre estará presente.
--
-- Si en el futuro necesitamos notificaciones sin appointment_id, podemos crear un índice único
-- parcial o usar un constraint más complejo.

-- Verificar si ya existe un constraint similar
DO $$
BEGIN
  -- Intentar crear el constraint UNIQUE
  -- Si ya existe, no hacer nada (idempotente)
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conrelid = 'public.client_notifications'::regclass 
      AND conname = 'client_notifications_user_appointment_type_unique'
  ) THEN
    -- Crear índice único (más eficiente que constraint directo para múltiples columnas)
    CREATE UNIQUE INDEX client_notifications_user_appointment_type_unique
    ON public.client_notifications (user_id, appointment_id, type)
    WHERE appointment_id IS NOT NULL;
    
    -- También crear constraint para casos donde appointment_id es NULL
    -- Usamos un índice único funcional para manejar NULLs correctamente
    CREATE UNIQUE INDEX client_notifications_user_type_unique_null_appointment
    ON public.client_notifications (user_id, type, COALESCE(appointment_id::text, ''))
    WHERE appointment_id IS NULL;
    
    RAISE NOTICE '✅ Constraint UNIQUE creado para client_notifications';
  ELSE
    RAISE NOTICE 'ℹ️ Constraint UNIQUE ya existe para client_notifications';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️ Error al crear constraint UNIQUE: %', SQLERRM;
END $$;

-- ============================================
-- PASO 2: MODIFICAR TRIGGERS PARA SER IDEMPOTENTES
-- ============================================
-- Los triggers actuales usan INSERT directo sin ON CONFLICT.
-- Vamos a modificarlos para que usen INSERT ... ON CONFLICT DO NOTHING
-- para que sean idempotentes y no fallen si Edge Functions también insertan.

-- Función: handle_appointment_confirmation
-- Modificar para usar ON CONFLICT DO NOTHING
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
    
    -- ✅ TODAS LAS VALIDACIONES PASARON: Proceder a crear notificación (IDEMPOTENTE)
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
    
    -- ✅ Crear notificación con ON CONFLICT DO NOTHING (IDEMPOTENTE)
    -- Si Edge Function ya insertó, este INSERT no fallará ni creará duplicado
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
          'consolidated', true,
          'push_sent', false
        )
      )
      ON CONFLICT (user_id, appointment_id, type) 
      WHERE appointment_id IS NOT NULL
      DO NOTHING;
        
    EXCEPTION WHEN OTHERS THEN
      -- ✅ Fail silently: Si hay error al insertar, no hacer nada
      -- Esto incluye errores de constraint (aunque ON CONFLICT debería manejarlos)
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

-- Función: handle_appointment_completion
-- Modificar para usar ON CONFLICT DO NOTHING
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
    
    -- ✅ TODAS LAS VALIDACIONES PASARON: Proceder a crear notificación (IDEMPOTENTE)
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
    
    -- ✅ Crear notificación con ON CONFLICT DO NOTHING (IDEMPOTENTE)
    -- Si Edge Function ya insertó, este INSERT no fallará ni creará duplicado
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
          'consolidated', true,
          'push_sent', false
        )
      )
      ON CONFLICT (user_id, appointment_id, type) 
      WHERE appointment_id IS NOT NULL
      DO NOTHING;
        
    EXCEPTION WHEN OTHERS THEN
      -- ✅ Fail silently: Si hay error al insertar, no hacer nada
      -- Esto incluye errores de constraint (aunque ON CONFLICT debería manejarlos)
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
-- PASO 3: VERIFICACIÓN
-- ============================================

-- Verificar que los índices únicos se crearon correctamente
DO $$
DECLARE
  index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'client_notifications'
    AND indexname IN (
      'client_notifications_user_appointment_type_unique',
      'client_notifications_user_type_unique_null_appointment'
    );
  
  IF index_count = 2 THEN
    RAISE NOTICE '✅ Índices únicos creados correctamente';
  ELSE
    RAISE WARNING '⚠️ Solo se crearon % de 2 índices únicos esperados', index_count;
  END IF;
END $$;

COMMIT;

-- ============================================
-- RESUMEN DE CAMBIOS
-- ============================================
-- ✅ Constraint UNIQUE creado:
--    - client_notifications_user_appointment_type_unique (user_id, appointment_id, type)
--    - client_notifications_user_type_unique_null_appointment (para appointment_id NULL)
--
-- ✅ Triggers modificados (idempotentes):
--    - handle_appointment_confirmation() → Usa ON CONFLICT DO NOTHING
--    - handle_appointment_completion() → Usa ON CONFLICT DO NOTHING
--
-- ✅ Estado final:
--    - DB lista para recibir inserts desde Edge Functions
--    - Triggers SQL son idempotentes (no crearán duplicados)
--    - Constraint UNIQUE previene duplicados a nivel de DB
--
-- Próximo paso: Modificar Edge Functions para insertar en DB después de push exitoso

