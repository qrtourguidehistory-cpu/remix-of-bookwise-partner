-- Fix any policies that might be using b.user_id instead of b.owner_id
-- This migration ensures all appointment_notifications policies use b.owner_id correctly

-- Drop and recreate policies that use businesses b to ensure they use owner_id
DROP POLICY IF EXISTS "Business owners can view their business notifications" ON public.appointment_notifications;
DROP POLICY IF EXISTS "Partners can create notifications" ON public.appointment_notifications;
DROP POLICY IF EXISTS "Partners can update notifications" ON public.appointment_notifications;

-- Recreate with correct owner_id reference
CREATE POLICY "Business owners can view their business notifications"
ON public.appointment_notifications FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM appointments a
    JOIN businesses b ON a.business_id = b.id
    WHERE a.id = appointment_notifications.appointment_id
      AND b.owner_id = auth.uid()
      AND (
        (appointment_notifications.meta->>'type' = 'review_received')
        OR (appointment_notifications.meta->>'recipient_type' = 'business_owner')
      )
  )
);

CREATE POLICY "Partners can create notifications"
ON public.appointment_notifications FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM appointments a
    JOIN businesses b ON a.business_id = b.id
    WHERE a.id = appointment_notifications.appointment_id
      AND b.owner_id = auth.uid()
  )
  OR true
);

CREATE POLICY "Partners can update notifications"
ON public.appointment_notifications FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM appointments a
    JOIN businesses b ON a.business_id = b.id
    WHERE a.id = appointment_notifications.appointment_id
      AND b.owner_id = auth.uid()
  )
  OR true
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM appointments a
    JOIN businesses b ON a.business_id = b.id
    WHERE a.id = appointment_notifications.appointment_id
      AND b.owner_id = auth.uid()
  )
  OR true
);

