# Plan de Mejoras de Seguridad - BookWise Partner

## Estado Actual

✅ **Completado:**
- Eliminado `src/lib/supabaseClient.ts` con credenciales hardcodeadas
- Creado re-export desde `@/integrations/supabase/client` 
- Eliminado `src/lib/supabaseHelpers.ts` y `src/lib/queryValidator.ts`

## Fase 1: Seguridad Crítica - SQL a Ejecutar

Las siguientes queries SQL deben ejecutarse en la base de datos para completar las mejoras de seguridad:

### 1. Arreglar RLS Policies Inseguras

```sql
-- appointment_notifications: Cambiar política de INSERT con "true" a una más segura
DROP POLICY IF EXISTS "System can insert notifications" ON appointment_notifications;

CREATE POLICY "Business users can insert notifications" 
ON appointment_notifications FOR INSERT 
TO authenticated 
WITH CHECK (business_id = get_user_business_id());

-- client_notifications: Crear función helper y política segura
CREATE OR REPLACE FUNCTION can_insert_client_notification(p_business_id uuid, p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (p_business_id = get_user_business_id())
    OR
    (p_client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()))
$$;

DROP POLICY IF EXISTS "System can insert notifications" ON client_notifications;

CREATE POLICY "Authorized users can insert client notifications" 
ON client_notifications FOR INSERT 
TO authenticated 
WITH CHECK (
  business_id IS NULL 
  OR business_id = get_user_business_id()
  OR can_insert_client_notification(business_id, client_id)
);

-- sms_logs: Cambiar política de INSERT con "true"
DROP POLICY IF EXISTS "System can insert sms logs" ON sms_logs;

CREATE POLICY "Business users can insert sms logs" 
ON sms_logs FOR INSERT 
TO authenticated 
WITH CHECK (business_id = get_user_business_id());
```

### 2. Validación Backend de Citas (Trigger)

```sql
CREATE OR REPLACE FUNCTION validate_appointment_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_overlap_count INTEGER;
BEGIN
  -- Verificar que existe staff_id
  IF NEW.staff_id IS NULL THEN
    RAISE EXCEPTION 'appointment_requires_staff: Una cita requiere un miembro del personal asignado';
  END IF;

  -- Verificar que existe service_id
  IF NEW.service_id IS NULL THEN
    RAISE EXCEPTION 'appointment_requires_service: Una cita requiere un servicio asignado';
  END IF;

  -- Verificar que existe client_id
  IF NEW.client_id IS NULL THEN
    RAISE EXCEPTION 'appointment_requires_client: Una cita requiere un cliente asignado';
  END IF;

  -- Verificar duración válida (end_time > start_time)
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'invalid_appointment_duration: La hora de fin debe ser posterior a la hora de inicio';
  END IF;

  -- Verificar que el staff existe y está activo
  IF NOT EXISTS (
    SELECT 1 FROM staff 
    WHERE id = NEW.staff_id 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'staff_not_active: El miembro del personal no está activo';
  END IF;

  -- Verificar solapamiento con mismo staff
  IF NEW.status NOT IN ('cancelled', 'no_show') THEN
    SELECT COUNT(*) INTO v_overlap_count
    FROM appointments 
    WHERE staff_id = NEW.staff_id 
    AND appointment_date = NEW.appointment_date
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND status NOT IN ('cancelled', 'no_show')
    AND (
      (NEW.start_time >= start_time AND NEW.start_time < end_time) 
      OR
      (NEW.end_time > start_time AND NEW.end_time <= end_time)
      OR
      (NEW.start_time <= start_time AND NEW.end_time >= end_time)
    );

    IF v_overlap_count > 0 THEN
      RAISE EXCEPTION 'appointment_overlap: Ya existe una cita para este miembro del personal en el horario seleccionado';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_appointment_trigger ON appointments;

CREATE TRIGGER validate_appointment_trigger
BEFORE INSERT OR UPDATE ON appointments
FOR EACH ROW 
EXECUTE FUNCTION validate_appointment_data();
```

### 3. Transiciones de Estado Controladas

```sql
CREATE OR REPLACE FUNCTION validate_appointment_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Estados finales no se pueden cambiar
  IF OLD.status IN ('completed', 'cancelled', 'no_show') THEN
    RAISE EXCEPTION 'cannot_change_final_status: No se puede cambiar el estado de una cita %, es un estado final', OLD.status;
  END IF;

  -- Transiciones válidas desde pending
  IF OLD.status = 'pending' AND NEW.status NOT IN ('confirmed', 'cancelled', 'arrived') THEN
    RAISE EXCEPTION 'invalid_transition_from_pending';
  END IF;

  -- Transiciones válidas desde confirmed
  IF OLD.status = 'confirmed' AND NEW.status NOT IN ('started', 'cancelled', 'no_show', 'arrived') THEN
    RAISE EXCEPTION 'invalid_transition_from_confirmed';
  END IF;

  -- Transiciones válidas desde arrived
  IF OLD.status = 'arrived' AND NEW.status NOT IN ('started', 'cancelled', 'no_show') THEN
    RAISE EXCEPTION 'invalid_transition_from_arrived';
  END IF;

  -- Transiciones válidas desde started
  IF OLD.status = 'started' AND NEW.status NOT IN ('completed') THEN
    RAISE EXCEPTION 'invalid_transition_from_started';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_status_transition_trigger ON appointments;

CREATE TRIGGER validate_status_transition_trigger
BEFORE UPDATE OF status ON appointments
FOR EACH ROW 
EXECUTE FUNCTION validate_appointment_status_transition();
```

### 4. Índices para Performance

```sql
CREATE INDEX IF NOT EXISTS idx_appointments_staff_date_status 
ON appointments (staff_id, appointment_date, status)
WHERE status NOT IN ('cancelled', 'no_show');

CREATE INDEX IF NOT EXISTS idx_appointments_overlap_check
ON appointments (staff_id, appointment_date, start_time, end_time)
WHERE status NOT IN ('cancelled', 'no_show');
```

### 5. Campos para Fases Futuras

```sql
-- Puntualidad de clientes
ALTER TABLE clients ADD COLUMN IF NOT EXISTS punctuality_score NUMERIC DEFAULT 100;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS late_arrivals INTEGER DEFAULT 0;

-- Puntualidad de staff
ALTER TABLE staff ADD COLUMN IF NOT EXISTS late_starts INTEGER DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS total_appointments_handled INTEGER DEFAULT 0;

-- Push notifications
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMP WITH TIME ZONE;
```

### 6. Idempotencia de Notificaciones

```sql
-- Prevenir notificaciones duplicadas
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_idempotency 
ON appointment_notifications (appointment_id, notification_type)
WHERE status = 'scheduled';
```

## Diagrama de Transiciones de Estado

```
┌─────────┐    confirm    ┌───────────┐    start    ┌─────────┐   complete   ┌───────────┐
│ pending │──────────────▶│ confirmed │────────────▶│ started │─────────────▶│ completed │
└─────────┘               └───────────┘             └─────────┘              └───────────┘
     │                          │                        
     │ cancel                   │ cancel/no_show/arrived
     │                          │
     ▼                          ▼
┌───────────┐             ┌───────────┐
│ cancelled │             │  no_show  │
└───────────┘             └───────────┘
                                │
                          ┌─────┴─────┐
                          │  arrived  │
                          └───────────┘
                                │ start
                                ▼
                          ┌─────────┐
                          │ started │
                          └─────────┘
```

## Próximos Pasos

1. **Fase 2**: Implementar sistema de notificaciones push
2. **Fase 3**: Refactorizar componentes grandes
3. **Fase 4**: Mejoras de UX/UI
4. **Fase 5**: Dashboard de Analytics
5. **Fase 6**: Mejoras modernas (timeline, walk-ins, etc.)
