CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'manager',
    'staff'
);


--
-- Name: appointment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_status AS ENUM (
    'pending',
    'confirmed',
    'completed',
    'cancelled',
    'no_show',
    'started',
    'arrived'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'card',
    'online'
);


--
-- Name: create_early_arrival_request(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_early_arrival_request(p_appointment_id uuid, p_business_id uuid, p_staff_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_request_id UUID;
  v_appointment RECORD;
  v_next_appointment RECORD;
  v_client_id UUID;
BEGIN
  -- Get the current appointment details
  SELECT * INTO v_appointment
  FROM appointments
  WHERE id = p_appointment_id AND business_id = p_business_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Appointment not found');
  END IF;
  
  -- Check if there's already a pending request for this appointment
  IF EXISTS (
    SELECT 1 FROM appointment_requests 
    WHERE appointment_id = p_appointment_id 
    AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A pending request already exists for this appointment');
  END IF;
  
  -- Find the next appointment for the same staff on the same day
  SELECT * INTO v_next_appointment
  FROM appointments
  WHERE staff_id = v_appointment.staff_id
    AND appointment_date = v_appointment.appointment_date
    AND start_time > v_appointment.start_time
    AND status NOT IN ('cancelled', 'completed', 'no_show')
  ORDER BY start_time ASC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No next appointment found to notify');
  END IF;
  
  -- Create the early arrival request
  INSERT INTO appointment_requests (
    business_id,
    appointment_id,
    staff_id,
    client_id,
    request_type,
    status,
    original_start_time,
    original_end_time,
    proposed_start_time,
    proposed_end_time,
    expires_at
  ) VALUES (
    p_business_id,
    v_next_appointment.id,
    COALESCE(p_staff_id, v_appointment.staff_id),
    v_next_appointment.client_id,
    'early_arrival',
    'pending',
    v_next_appointment.start_time,
    v_next_appointment.end_time,
    v_appointment.end_time,
    v_next_appointment.end_time - (v_next_appointment.start_time - v_appointment.end_time),
    now() + interval '30 minutes'
  )
  RETURNING id INTO v_request_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'request_id', v_request_id,
    'next_client_id', v_next_appointment.client_id,
    'next_appointment_id', v_next_appointment.id
  );
END;
$$;


--
-- Name: get_user_business_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_business_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT business_id FROM profiles WHERE id = auth.uid()
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: respond_to_early_arrival_request(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_to_early_arrival_request(p_request_id uuid, p_response text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_request RECORD;
  v_appointment RECORD;
BEGIN
  -- Get the request
  SELECT * INTO v_request
  FROM appointment_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;
  
  -- Check if request has expired
  IF v_request.expires_at < now() THEN
    UPDATE appointment_requests SET status = 'expired', updated_at = now() WHERE id = p_request_id;
    RETURN jsonb_build_object('success', false, 'error', 'Request has expired');
  END IF;
  
  IF p_response = 'accepted' THEN
    -- Update the appointment times
    UPDATE appointments
    SET 
      start_time = v_request.proposed_start_time,
      end_time = v_request.proposed_end_time,
      updated_at = now()
    WHERE id = v_request.appointment_id;
    
    -- Update the request status
    UPDATE appointment_requests
    SET 
      status = 'accepted',
      responded_at = now(),
      updated_at = now()
    WHERE id = p_request_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Appointment time updated');
  ELSIF p_response = 'rejected' THEN
    -- Update the request status
    UPDATE appointment_requests
    SET 
      status = 'rejected',
      responded_at = now(),
      updated_at = now()
    WHERE id = p_request_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Request rejected');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid response. Must be accepted or rejected');
  END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: appointment_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid,
    business_id uuid NOT NULL,
    notification_type text NOT NULL,
    send_at timestamp with time zone,
    sent_at timestamp with time zone,
    status text DEFAULT 'scheduled'::text,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: appointment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    staff_id uuid,
    client_id uuid,
    request_type text DEFAULT 'early_arrival'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    original_start_time time without time zone,
    original_end_time time without time zone,
    proposed_start_time time without time zone,
    proposed_end_time time without time zone,
    message text,
    response_message text,
    expires_at timestamp with time zone,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: appointment_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    slot_duration_minutes integer DEFAULT 30 NOT NULL,
    buffer_minutes integer DEFAULT 0 NOT NULL,
    max_advance_booking_days integer DEFAULT 90 NOT NULL,
    min_advance_booking_hours integer DEFAULT 2 NOT NULL,
    cancellation_policy text,
    allow_same_day_booking boolean DEFAULT true NOT NULL,
    require_deposit boolean DEFAULT false NOT NULL,
    deposit_percentage numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    service_id uuid NOT NULL,
    appointment_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    status public.appointment_status DEFAULT 'pending'::public.appointment_status,
    payment_method public.payment_method,
    payment_amount numeric(10,2),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    business_id uuid,
    inventory_used jsonb
);


--
-- Name: business_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_open boolean DEFAULT true,
    break_start time without time zone,
    break_end time without time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    business_id uuid,
    CONSTRAINT business_hours_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.businesses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    business_name text NOT NULL,
    website text,
    primary_category text NOT NULL,
    secondary_categories text[],
    service_type text NOT NULL,
    team_size text NOT NULL,
    account_type text NOT NULL,
    onboarding_completed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    theme_settings jsonb DEFAULT '{"darkMode": false, "primaryColor": "#9b87f5"}'::jsonb,
    locale_settings jsonb DEFAULT '{"currency": "MXN", "language": "es", "timezone": "America/Mexico_City", "dateFormat": "DD/MM/YYYY", "timeFormat": "12h"}'::jsonb,
    location_details jsonb,
    is_public boolean DEFAULT false,
    slug text,
    description text,
    logo_url text,
    cover_image_url text,
    average_rating numeric(3,2) DEFAULT 0,
    total_reviews integer DEFAULT 0,
    phone text,
    address text,
    latitude numeric(10,8),
    longitude numeric(11,8)
);


--
-- Name: client_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    client_id uuid,
    business_id uuid,
    appointment_id uuid,
    request_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false,
    meta jsonb DEFAULT '{}'::jsonb,
    action_url text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    notes text,
    total_bookings integer DEFAULT 0,
    total_spent numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    business_id uuid,
    allergy_notes text,
    is_blocked boolean DEFAULT false,
    blocked_at timestamp with time zone,
    blocked_reason text
);


--
-- Name: commission_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    service_id uuid,
    commission_percentage numeric(5,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT commission_configs_commission_percentage_check CHECK (((commission_percentage >= (0)::numeric) AND (commission_percentage <= (100)::numeric)))
);


--
-- Name: commission_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_sales numeric(10,2) DEFAULT 0 NOT NULL,
    commission_amount numeric(10,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    paid_at timestamp with time zone,
    payment_method text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT commission_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text])))
);


--
-- Name: establishments; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.establishments WITH (security_invoker='true') AS
 SELECT id,
    id AS establishment_id,
    business_name AS name,
    slug,
    description,
    logo_url AS main_image,
    cover_image_url,
    average_rating,
    total_reviews,
    phone,
    address,
    website,
    is_public,
    primary_category AS category,
    secondary_categories,
    service_type,
    location_details,
    owner_id,
    created_at,
    updated_at
   FROM public.businesses
  WHERE ((is_public = true) AND (onboarding_completed = true));


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    sku text,
    category text,
    current_stock integer DEFAULT 0 NOT NULL,
    min_stock_level integer DEFAULT 5 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    cost_price numeric,
    supplier text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    inventory_id uuid NOT NULL,
    movement_type text NOT NULL,
    quantity integer NOT NULL,
    reference_type text,
    reference_id uuid,
    notes text,
    staff_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    reminder_enabled boolean DEFAULT true,
    reminder_hours_before integer[] DEFAULT ARRAY[24, 1],
    reminder_channels text[] DEFAULT ARRAY['email'::text],
    confirmation_enabled boolean DEFAULT true,
    confirmation_channels text[] DEFAULT ARRAY['email'::text],
    review_request_enabled boolean DEFAULT false,
    review_request_delay_days integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    is_active boolean DEFAULT true,
    instructions text,
    icon text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payment_methods_type_check CHECK ((type = ANY (ARRAY['cash'::text, 'card'::text, 'digital'::text, 'bank_transfer'::text, 'other'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    business_id uuid,
    onboarding_step integer DEFAULT 0
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid NOT NULL,
    client_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    service_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    admin_response text,
    is_addressed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    business_id uuid,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid,
    client_name text NOT NULL,
    client_type text NOT NULL,
    service_id uuid,
    service_name text NOT NULL,
    staff_id uuid,
    price_usd numeric DEFAULT 0 NOT NULL,
    price_mxn numeric DEFAULT 0 NOT NULL,
    tip_amount numeric DEFAULT 0,
    payment_method text,
    sale_date date DEFAULT CURRENT_DATE NOT NULL,
    sale_time time without time zone DEFAULT CURRENT_TIME NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    business_id uuid,
    inventory_used jsonb,
    CONSTRAINT sales_client_type_check CHECK ((client_type = ANY (ARRAY['new'::text, 'existing'::text, 'walk-in'::text]))),
    CONSTRAINT sales_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'online'::text])))
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    duration_minutes integer NOT NULL,
    price numeric(10,2) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    image_url text,
    price_usd numeric,
    price_mxn numeric,
    business_id uuid
);


--
-- Name: sms_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    appointment_id uuid,
    phone_number text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    twilio_sid text,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: sms_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    reminder_24h text,
    reminder_1h text,
    confirmation text,
    review_request text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    full_name text NOT NULL,
    email text,
    phone text,
    avatar_url text,
    bio text,
    specialties text[],
    commission_rate numeric(5,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    business_id uuid
);


--
-- Name: staff_early_departures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_early_departures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    departure_date date NOT NULL,
    original_end_time time without time zone NOT NULL,
    actual_end_time time without time zone NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT early_departure_check CHECK ((actual_end_time < original_end_time))
);


--
-- Name: staff_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    break_start time without time zone,
    break_end time without time zone,
    break_notes text,
    CONSTRAINT staff_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: staff_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_services (
    staff_id uuid NOT NULL,
    service_id uuid NOT NULL
);


--
-- Name: staff_time_off; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_time_off (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now(),
    time_off_type text DEFAULT 'vacation'::text,
    CONSTRAINT staff_time_off_time_off_type_check CHECK ((time_off_type = ANY (ARRAY['vacation'::text, 'sick'::text, 'personal'::text, 'break'::text])))
);


--
-- Name: user_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    email text NOT NULL,
    role public.app_role NOT NULL,
    invited_by uuid,
    status text DEFAULT 'pending'::text,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: appointment_notifications appointment_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_notifications
    ADD CONSTRAINT appointment_notifications_pkey PRIMARY KEY (id);


--
-- Name: appointment_requests appointment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_requests
    ADD CONSTRAINT appointment_requests_pkey PRIMARY KEY (id);


--
-- Name: appointment_settings appointment_settings_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_settings
    ADD CONSTRAINT appointment_settings_business_id_key UNIQUE (business_id);


--
-- Name: appointment_settings appointment_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_settings
    ADD CONSTRAINT appointment_settings_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: business_hours business_hours_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_hours
    ADD CONSTRAINT business_hours_day_of_week_key UNIQUE (day_of_week);


--
-- Name: business_hours business_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_hours
    ADD CONSTRAINT business_hours_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: client_notifications client_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_notifications
    ADD CONSTRAINT client_notifications_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: commission_configs commission_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_configs
    ADD CONSTRAINT commission_configs_pkey PRIMARY KEY (id);


--
-- Name: commission_configs commission_configs_staff_id_service_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_configs
    ADD CONSTRAINT commission_configs_staff_id_service_id_key UNIQUE (staff_id, service_id);


--
-- Name: commission_payments commission_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_business_id_key UNIQUE (business_id);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_appointment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_appointment_id_key UNIQUE (appointment_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: sms_logs sms_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_logs
    ADD CONSTRAINT sms_logs_pkey PRIMARY KEY (id);


--
-- Name: sms_templates sms_templates_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_business_id_key UNIQUE (business_id);


--
-- Name: sms_templates sms_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_pkey PRIMARY KEY (id);


--
-- Name: staff_early_departures staff_early_departures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_early_departures
    ADD CONSTRAINT staff_early_departures_pkey PRIMARY KEY (id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: staff_schedules staff_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_pkey PRIMARY KEY (id);


--
-- Name: staff_services staff_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_services
    ADD CONSTRAINT staff_services_pkey PRIMARY KEY (staff_id, service_id);


--
-- Name: staff_time_off staff_time_off_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_time_off
    ADD CONSTRAINT staff_time_off_pkey PRIMARY KEY (id);


--
-- Name: user_invitations user_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invitations
    ADD CONSTRAINT user_invitations_pkey PRIMARY KEY (id);


--
-- Name: user_invitations user_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invitations
    ADD CONSTRAINT user_invitations_token_key UNIQUE (token);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: businesses_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX businesses_slug_unique ON public.businesses USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: idx_appointment_settings_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointment_settings_business_id ON public.appointment_settings USING btree (business_id);


--
-- Name: idx_appointments_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_client_id ON public.appointments USING btree (client_id);


--
-- Name: idx_appointments_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_date_time ON public.appointments USING btree (appointment_date, start_time);


--
-- Name: idx_appointments_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_staff_id ON public.appointments USING btree (staff_id);


--
-- Name: idx_businesses_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_businesses_location ON public.businesses USING btree (latitude, longitude) WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL));


--
-- Name: idx_clients_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_user_id ON public.clients USING btree (user_id);


--
-- Name: idx_inventory_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_business_id ON public.inventory USING btree (business_id);


--
-- Name: idx_inventory_low_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_low_stock ON public.inventory USING btree (business_id, current_stock) WHERE (current_stock <= min_stock_level);


--
-- Name: idx_inventory_movements_inventory_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_inventory_id ON public.inventory_movements USING btree (inventory_id);


--
-- Name: idx_inventory_movements_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_reference ON public.inventory_movements USING btree (reference_type, reference_id);


--
-- Name: idx_sales_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_client ON public.sales USING btree (client_id);


--
-- Name: idx_sales_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_date ON public.sales USING btree (sale_date);


--
-- Name: idx_sales_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_staff ON public.sales USING btree (staff_id);


--
-- Name: idx_sms_logs_appointment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_logs_appointment_id ON public.sms_logs USING btree (appointment_id);


--
-- Name: idx_sms_logs_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_logs_business_id ON public.sms_logs USING btree (business_id);


--
-- Name: idx_sms_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_logs_created_at ON public.sms_logs USING btree (created_at DESC);


--
-- Name: appointment_settings update_appointment_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_appointment_settings_updated_at BEFORE UPDATE ON public.appointment_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: appointments update_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: business_hours update_business_hours_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_business_hours_updated_at BEFORE UPDATE ON public.business_hours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: businesses update_businesses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: commission_configs update_commission_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_commission_configs_updated_at BEFORE UPDATE ON public.commission_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: commission_payments update_commission_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_commission_payments_updated_at BEFORE UPDATE ON public.commission_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory update_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_settings update_notification_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON public.notification_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_methods update_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sales update_sales_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: services update_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sms_templates update_sms_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sms_templates_updated_at BEFORE UPDATE ON public.sms_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: staff_early_departures update_staff_early_departures_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_staff_early_departures_updated_at BEFORE UPDATE ON public.staff_early_departures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: staff update_staff_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_invitations update_user_invitations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_invitations_updated_at BEFORE UPDATE ON public.user_invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: appointment_notifications appointment_notifications_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_notifications
    ADD CONSTRAINT appointment_notifications_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointment_notifications appointment_notifications_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_notifications
    ADD CONSTRAINT appointment_notifications_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: appointment_requests appointment_requests_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_requests
    ADD CONSTRAINT appointment_requests_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: appointment_requests appointment_requests_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_requests
    ADD CONSTRAINT appointment_requests_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: appointment_requests appointment_requests_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_requests
    ADD CONSTRAINT appointment_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: appointment_requests appointment_requests_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_requests
    ADD CONSTRAINT appointment_requests_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: appointment_settings appointment_settings_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_settings
    ADD CONSTRAINT appointment_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: appointments appointments_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: business_hours business_hours_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_hours
    ADD CONSTRAINT business_hours_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: businesses businesses_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: client_notifications client_notifications_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_notifications
    ADD CONSTRAINT client_notifications_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: client_notifications client_notifications_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_notifications
    ADD CONSTRAINT client_notifications_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: client_notifications client_notifications_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_notifications
    ADD CONSTRAINT client_notifications_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_notifications client_notifications_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_notifications
    ADD CONSTRAINT client_notifications_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.appointment_requests(id) ON DELETE SET NULL;


--
-- Name: client_notifications client_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_notifications
    ADD CONSTRAINT client_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: clients clients_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: clients clients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: commission_configs commission_configs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_configs
    ADD CONSTRAINT commission_configs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commission_configs commission_configs_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_configs
    ADD CONSTRAINT commission_configs_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: commission_configs commission_configs_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_configs
    ADD CONSTRAINT commission_configs_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: commission_payments commission_payments_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: commission_payments commission_payments_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: inventory inventory_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: notification_settings notification_settings_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: payment_methods payment_methods_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: sales sales_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: sales sales_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: sales sales_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: sales sales_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: services services_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: sms_logs sms_logs_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_logs
    ADD CONSTRAINT sms_logs_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id);


--
-- Name: sms_logs sms_logs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_logs
    ADD CONSTRAINT sms_logs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: sms_templates sms_templates_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: staff staff_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: staff_early_departures staff_early_departures_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_early_departures
    ADD CONSTRAINT staff_early_departures_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff_schedules staff_schedules_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff_services staff_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_services
    ADD CONSTRAINT staff_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: staff_services staff_services_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_services
    ADD CONSTRAINT staff_services_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff_time_off staff_time_off_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_time_off
    ADD CONSTRAINT staff_time_off_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_invitations user_invitations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invitations
    ADD CONSTRAINT user_invitations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: user_invitations user_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invitations
    ADD CONSTRAINT user_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: business_hours Admins and managers can manage business hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage business hours" ON public.business_hours USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: staff_early_departures Admins and managers can manage early departures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage early departures" ON public.staff_early_departures USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: reviews Admins and managers can manage reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage reviews" ON public.reviews USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: staff_schedules Admins and managers can manage staff schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage staff schedules" ON public.staff_schedules USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: staff_services Admins and managers can manage staff services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage staff services" ON public.staff_services USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: staff_time_off Admins and managers can manage time off; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage time off" ON public.staff_time_off USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: staff_time_off Admins and managers can view all time off; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can view all time off" ON public.staff_time_off FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: user_roles Admins can manage all user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all user roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: appointment_settings Admins can manage appointment settings in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage appointment settings in their business" ON public.appointment_settings USING (((business_id = public.get_user_business_id()) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))));


--
-- Name: business_hours Admins can manage business hours in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage business hours in their business" ON public.business_hours USING (((business_id = public.get_user_business_id()) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))));


--
-- Name: commission_configs Admins can manage commission configs in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage commission configs in their business" ON public.commission_configs USING (((business_id = public.get_user_business_id()) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))));


--
-- Name: commission_payments Admins can manage commission payments in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage commission payments in their business" ON public.commission_payments USING (((business_id = public.get_user_business_id()) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))));


--
-- Name: inventory Admins can manage inventory in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage inventory in their business" ON public.inventory USING (((business_id = public.get_user_business_id()) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))));


--
-- Name: inventory_movements Admins can manage inventory movements in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage inventory movements in their business" ON public.inventory_movements USING (((business_id = public.get_user_business_id()) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))));


--
-- Name: user_invitations Admins can manage invitations in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage invitations in their business" ON public.user_invitations USING (((business_id = public.get_user_business_id()) AND public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: notification_settings Admins can manage notification settings in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage notification settings in their business" ON public.notification_settings USING (((business_id = public.get_user_business_id()) AND public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: services Admins can manage services in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage services in their business" ON public.services USING (((business_id = public.get_user_business_id()) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))));


--
-- Name: staff Admins can manage staff in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage staff in their business" ON public.staff USING (((business_id = public.get_user_business_id()) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))));


--
-- Name: sms_templates Admins can manage templates in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage templates in their business" ON public.sms_templates USING (((business_id = public.get_user_business_id()) AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))));


--
-- Name: businesses Anyone can view public businesses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view public businesses" ON public.businesses FOR SELECT USING (((is_public = true) AND (onboarding_completed = true)));


--
-- Name: reviews Clients can create reviews for their appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can create reviews for their appointments" ON public.reviews FOR INSERT WITH CHECK ((auth.uid() = client_id));


--
-- Name: services Everyone can view active services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view active services" ON public.services FOR SELECT USING ((is_active = true));


--
-- Name: staff Everyone can view active staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view active staff" ON public.staff FOR SELECT USING ((is_active = true));


--
-- Name: business_hours Everyone can view business hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view business hours" ON public.business_hours FOR SELECT USING (true);


--
-- Name: reviews Everyone can view reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view reviews" ON public.reviews FOR SELECT USING (true);


--
-- Name: staff_schedules Everyone can view staff schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view staff schedules" ON public.staff_schedules FOR SELECT USING (true);


--
-- Name: staff_services Everyone can view staff services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view staff services" ON public.staff_services FOR SELECT USING (true);


--
-- Name: staff_early_departures Staff can view their own early departures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view their own early departures" ON public.staff_early_departures FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.staff
  WHERE ((staff.id = staff_early_departures.staff_id) AND (staff.user_id = auth.uid())))));


--
-- Name: staff_time_off Staff can view their own time off; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view their own time off" ON public.staff_time_off FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.staff
  WHERE ((staff.id = staff_time_off.staff_id) AND (staff.user_id = auth.uid())))));


--
-- Name: appointment_notifications System can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert notifications" ON public.appointment_notifications FOR INSERT WITH CHECK (true);


--
-- Name: client_notifications System can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert notifications" ON public.client_notifications FOR INSERT WITH CHECK (true);


--
-- Name: sms_logs System can insert sms logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert sms logs" ON public.sms_logs FOR INSERT WITH CHECK (true);


--
-- Name: appointment_notifications System can update notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can update notifications" ON public.appointment_notifications FOR UPDATE USING (true);


--
-- Name: appointments Users can create appointments in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create appointments in their business" ON public.appointments FOR INSERT WITH CHECK ((business_id = public.get_user_business_id()));


--
-- Name: clients Users can create clients in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create clients in their business" ON public.clients FOR INSERT WITH CHECK ((business_id = public.get_user_business_id()));


--
-- Name: inventory_movements Users can create inventory movements in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create inventory movements in their business" ON public.inventory_movements FOR INSERT WITH CHECK ((business_id = public.get_user_business_id()));


--
-- Name: appointment_requests Users can create requests in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create requests in their business" ON public.appointment_requests FOR INSERT WITH CHECK ((business_id = public.get_user_business_id()));


--
-- Name: sales Users can create sales in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create sales in their business" ON public.sales FOR INSERT WITH CHECK ((business_id = public.get_user_business_id()));


--
-- Name: businesses Users can create their own business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own business" ON public.businesses FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: user_roles Users can create their own initial role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own initial role" ON public.user_roles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: appointments Users can delete appointments in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete appointments in their business" ON public.appointments FOR DELETE USING ((business_id = public.get_user_business_id()));


--
-- Name: clients Users can delete clients in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete clients in their business" ON public.clients FOR DELETE USING ((business_id = public.get_user_business_id()));


--
-- Name: sales Users can delete sales in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete sales in their business" ON public.sales FOR DELETE USING ((business_id = public.get_user_business_id()));


--
-- Name: payment_methods Users can manage payment methods in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage payment methods in their business" ON public.payment_methods USING ((business_id = public.get_user_business_id())) WITH CHECK ((business_id = public.get_user_business_id()));


--
-- Name: reviews Users can manage reviews in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage reviews in their business" ON public.reviews USING ((business_id = public.get_user_business_id()));


--
-- Name: appointments Users can update appointments in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update appointments in their business" ON public.appointments FOR UPDATE USING ((business_id = public.get_user_business_id()));


--
-- Name: clients Users can update clients in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update clients in their business" ON public.clients FOR UPDATE USING ((business_id = public.get_user_business_id()));


--
-- Name: appointment_requests Users can update requests in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update requests in their business" ON public.appointment_requests FOR UPDATE USING ((business_id = public.get_user_business_id()));


--
-- Name: sales Users can update sales in their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update sales in their business" ON public.sales FOR UPDATE USING ((business_id = public.get_user_business_id()));


--
-- Name: businesses Users can update their own business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own business" ON public.businesses FOR UPDATE USING ((owner_id = auth.uid()));


--
-- Name: client_notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.client_notifications FOR UPDATE USING (((user_id = auth.uid()) OR (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.user_id = auth.uid())))));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: appointment_settings Users can view appointment settings from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view appointment settings from their business" ON public.appointment_settings FOR SELECT USING ((business_id = public.get_user_business_id()));


--
-- Name: appointments Users can view appointments from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view appointments from their business" ON public.appointments FOR SELECT USING (((business_id = public.get_user_business_id()) OR (business_id IS NULL)));


--
-- Name: business_hours Users can view business hours from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view business hours from their business" ON public.business_hours FOR SELECT USING (((business_id = public.get_user_business_id()) OR (business_id IS NULL)));


--
-- Name: clients Users can view clients from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view clients from their business" ON public.clients FOR SELECT USING (((business_id = public.get_user_business_id()) OR (business_id IS NULL)));


--
-- Name: commission_configs Users can view commission configs from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view commission configs from their business" ON public.commission_configs FOR SELECT USING ((business_id = public.get_user_business_id()));


--
-- Name: commission_payments Users can view commission payments from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view commission payments from their business" ON public.commission_payments FOR SELECT USING ((business_id = public.get_user_business_id()));


--
-- Name: inventory Users can view inventory from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view inventory from their business" ON public.inventory FOR SELECT USING ((business_id = public.get_user_business_id()));


--
-- Name: inventory_movements Users can view inventory movements from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view inventory movements from their business" ON public.inventory_movements FOR SELECT USING ((business_id = public.get_user_business_id()));


--
-- Name: user_invitations Users can view invitations from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view invitations from their business" ON public.user_invitations FOR SELECT USING ((business_id = public.get_user_business_id()));


--
-- Name: notification_settings Users can view notification settings from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view notification settings from their business" ON public.notification_settings FOR SELECT USING ((business_id = public.get_user_business_id()));


--
-- Name: appointment_notifications Users can view notifications from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view notifications from their business" ON public.appointment_notifications FOR SELECT USING ((business_id = public.get_user_business_id()));


--
-- Name: payment_methods Users can view payment methods from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view payment methods from their business" ON public.payment_methods FOR SELECT USING ((business_id = public.get_user_business_id()));


--
-- Name: appointment_requests Users can view requests from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view requests from their business" ON public.appointment_requests FOR SELECT USING ((business_id = public.get_user_business_id()));


--
-- Name: reviews Users can view reviews from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view reviews from their business" ON public.reviews FOR SELECT USING (((business_id = public.get_user_business_id()) OR (business_id IS NULL)));


--
-- Name: sales Users can view sales from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view sales from their business" ON public.sales FOR SELECT USING (((business_id = public.get_user_business_id()) OR (business_id IS NULL)));


--
-- Name: services Users can view services from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view services from their business" ON public.services FOR SELECT USING (((business_id = public.get_user_business_id()) OR (business_id IS NULL)));


--
-- Name: sms_logs Users can view sms logs from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view sms logs from their business" ON public.sms_logs FOR SELECT USING ((business_id = public.get_user_business_id()));


--
-- Name: staff Users can view staff from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view staff from their business" ON public.staff FOR SELECT USING (((business_id = public.get_user_business_id()) OR (business_id IS NULL)));


--
-- Name: sms_templates Users can view templates from their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view templates from their business" ON public.sms_templates FOR SELECT USING ((business_id = public.get_user_business_id()));


--
-- Name: businesses Users can view their own business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own business" ON public.businesses FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: client_notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.client_notifications FOR SELECT USING (((user_id = auth.uid()) OR (client_id IN ( SELECT clients.id
   FROM public.clients
  WHERE (clients.user_id = auth.uid())))));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: appointment_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: appointment_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: appointment_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointment_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: business_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

--
-- Name: client_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commission_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_early_departures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_early_departures ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_time_off; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_time_off ENABLE ROW LEVEL SECURITY;

--
-- Name: user_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;