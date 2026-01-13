-- Fix notification types in database triggers to match CHECK constraint
-- Opción A: Mapear tipos no permitidos a tipos existentes

-- 1. Fix notify_partner_appointment_status_change: 'appointment_status_change' → 'status_change'
CREATE OR REPLACE FUNCTION public.notify_partner_appointment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_business_id uuid;
  v_owner_id uuid;
  v_client_name text;
  v_old_status_label text;
  v_new_status_label text;
BEGIN
  -- Solo crear notificación si el status cambió
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Obtener business_id y owner_id del negocio
  SELECT b.id, b.owner_id INTO v_business_id, v_owner_id
  FROM businesses b
  WHERE b.id = NEW.business_id;
  
  -- Obtener nombre del cliente si existe
  IF NEW.client_id IS NOT NULL THEN
    SELECT full_name INTO v_client_name
    FROM clients
    WHERE id = NEW.client_id;
  END IF;
  
  -- Mapear status a labels
  v_old_status_label := CASE OLD.status
    WHEN 'pending' THEN 'Pendiente'
    WHEN 'confirmed' THEN 'Confirmada'
    WHEN 'started' THEN 'Iniciada'
    WHEN 'completed' THEN 'Completada'
    WHEN 'cancelled' THEN 'Cancelada'
    WHEN 'no_show' THEN 'No asistió'
    ELSE OLD.status
  END;
  
  v_new_status_label := CASE NEW.status
    WHEN 'pending' THEN 'Pendiente'
    WHEN 'confirmed' THEN 'Confirmada'
    WHEN 'started' THEN 'Iniciada'
    WHEN 'completed' THEN 'Completada'
    WHEN 'cancelled' THEN 'Cancelada'
    WHEN 'no_show' THEN 'No asistió'
    ELSE NEW.status
  END;
  
  -- Crear notificación para el Partner
  -- FIX: Usar 'status_change' en lugar de 'appointment_status_change'
  IF v_business_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
    INSERT INTO client_notifications (
      business_id,
      user_id,
      appointment_id,
      client_id,
      type,
      title,
      message,
      read,
      created_at,
      meta
    ) VALUES (
      v_business_id,
      v_owner_id,
      NEW.id,
      NEW.client_id,
      'status_change', -- ✅ Cambiado de 'appointment_status_change' a 'status_change'
      'Estado de cita actualizado',
      'La cita de ' || COALESCE(v_client_name, 'Cliente') || ' cambió de "' || 
      v_old_status_label || '" a "' || v_new_status_label || '"',
      false,
      NOW(),
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the update
    RAISE WARNING 'Error in notify_partner_appointment_status_change: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- 2. Fix notify_partner_new_appointment: 'new_appointment' → 'confirmation'
CREATE OR REPLACE FUNCTION public.notify_partner_new_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_business_id uuid;
  v_owner_id uuid;
  v_client_name text;
BEGIN
  -- Obtener business_id y owner_id del negocio
  SELECT b.id, b.owner_id INTO v_business_id, v_owner_id
  FROM businesses b
  WHERE b.id = NEW.business_id;
  
  -- Obtener nombre del cliente si existe
  IF NEW.client_id IS NOT NULL THEN
    SELECT full_name INTO v_client_name
    FROM clients
    WHERE id = NEW.client_id;
  END IF;
  
  -- Crear notificación para el Partner
  -- FIX: Usar 'confirmation' en lugar de 'new_appointment'
  IF v_business_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
    INSERT INTO client_notifications (
      business_id,
      user_id,
      appointment_id,
      client_id,
      type,
      title,
      message,
      read,
      created_at
    ) VALUES (
      v_business_id,
      v_owner_id,
      NEW.id,
      NEW.client_id,
      'confirmation', -- ✅ Cambiado de 'new_appointment' a 'confirmation'
      'Nueva cita recibida',
      COALESCE(v_client_name, 'Cliente') || ' ha reservado una cita para el ' || 
      TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY') || ' a las ' || NEW.start_time,
      false,
      NOW()
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the update
    RAISE WARNING 'Error in notify_partner_new_appointment: %', SQLERRM;
    RETURN NEW;
END;
$function$;

