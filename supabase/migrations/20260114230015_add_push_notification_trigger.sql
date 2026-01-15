-- Enable http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Function to send push notification via Edge Function
CREATE OR REPLACE FUNCTION send_push_on_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_title TEXT;
  v_message TEXT;
  v_appointment_id UUID;
  v_business_id UUID;
  v_client_id UUID;
  v_supabase_url TEXT;
  v_supabase_key TEXT;
  v_response extensions.http_response;
BEGIN
  -- Get user role from profiles table
  SELECT p.role INTO v_role
  FROM profiles p
  WHERE p.id = NEW.user_id;
  
  -- Only send push if role is 'partner' or 'client'
  IF v_role NOT IN ('partner', 'client') THEN
    RETURN NEW;
  END IF;
  
  -- Extract notification data
  v_user_id := NEW.user_id;
  v_title := NEW.title;
  v_message := NEW.message;
  v_appointment_id := NEW.appointment_id;
  v_business_id := NEW.business_id;
  v_client_id := NEW.client_id;
  
  -- Get Supabase URL and anon key from vault or environment
  -- Note: You'll need to set these as secrets in Supabase Dashboard
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_supabase_key := current_setting('app.settings.supabase_anon_key', true);
  
  -- If settings not available, use hardcoded values
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://rdznelijpliklisnflfm.supabase.co';
  END IF;
  
  IF v_supabase_key IS NULL THEN
    v_supabase_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkem5lbGlqcGxpa2xpc25mbGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MjY4MzAsImV4cCI6MjA3ODIwMjgzMH0.o8G-wYYIN0Paw20YP4dSJcL5mf2mUdrfcWRfMauFjGQ';
  END IF;
  
  -- Call Edge Function to send push notification
  BEGIN
    SELECT * INTO v_response
    FROM extensions.http((
      'POST',
      v_supabase_url || '/functions/v1/send-push-notification',
      ARRAY[
        extensions.http_header('Content-Type', 'application/json'),
        extensions.http_header('Authorization', 'Bearer ' || v_supabase_key)
      ],
      'application/json',
      jsonb_build_object(
        'userId', v_user_id,
        'clientId', v_client_id,
        'role', v_role,
        'title', v_title,
        'body', v_message,
        'businessId', v_business_id,
        'appointmentId', v_appointment_id,
        'notificationType', NEW.type,
        'data', jsonb_build_object(
          'appointment_id', v_appointment_id,
          'business_id', v_business_id,
          'type', NEW.type,
          'notification_id', NEW.id
        )
      )::text
    ));
    
    -- Log the response (optional, for debugging)
    RAISE LOG 'Push notification sent. Status: %, Response: %', 
      v_response.status, 
      v_response.content;
      
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send push notification: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on client_notifications table
DROP TRIGGER IF EXISTS trigger_send_push_notification ON client_notifications;

CREATE TRIGGER trigger_send_push_notification
  AFTER INSERT ON client_notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_push_on_notification();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

