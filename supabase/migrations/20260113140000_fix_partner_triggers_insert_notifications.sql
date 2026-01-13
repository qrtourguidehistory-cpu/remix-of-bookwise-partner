-- Fix partner notification triggers to insert into 'notifications' table instead of 'client_notifications'
-- El Partner debe recibir notificaciones en 'notifications', NO en 'client_notifications'

-- 1. Fix notify_partner_appointment_status_change: Insertar en 'notifications'
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
  
  -- ✅ CORRECCIÓN: Insertar en 'notifications' (tabla de partners), NO en 'client_notifications'
  IF v_business_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      read,
      created_at,
      link
    ) VALUES (
      v_owner_id,
      'appointment_status_change', -- Tipo operativo para Partner
      'Estado de cita actualizado',
      'La cita de ' || COALESCE(v_client_name, 'Cliente') || ' cambió de "' || 
      v_old_status_label || '" a "' || v_new_status_label || '"',
      false,
      NOW(),
      '/admin/appointments' -- Link a la vista de citas
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

-- 2. Fix notify_partner_new_appointment: Insertar en 'notifications'
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
  
  -- ✅ CORRECCIÓN: Insertar en 'notifications' (tabla de partners), NO en 'client_notifications'
  IF v_business_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      read,
      created_at,
      link
    ) VALUES (
      v_owner_id,
      'new_appointment', -- Tipo operativo para Partner
      'Nueva cita recibida',
      COALESCE(v_client_name, 'Cliente') || ' ha reservado una cita para el ' || 
      TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY') || ' a las ' || NEW.start_time,
      false,
      NOW(),
      '/admin/appointments' -- Link a la vista de citas
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

