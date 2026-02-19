-- ============================================
-- MIGRACIÓN: Asegurar RLS para client_name y guest_name en appointments
-- ============================================
-- Fecha: 2026-02-03
-- Objetivo: Verificar y asegurar que las políticas RLS permitan acceso a 
--           las columnas client_name y guest_name en la tabla appointments
-- 
-- IMPORTANTE: client_name y guest_name son columnas DIRECTAS de appointments,
--             no vienen de tablas relacionadas. Si las políticas RLS permiten
--             acceso a appointments, automáticamente permiten acceso a todas
--             sus columnas, incluyendo client_name y guest_name.
-- 
-- Esta migración verifica y crea políticas RLS si no existen, asegurando
-- que los usuarios autenticados con business_id correcto puedan leer
-- todas las columnas de appointments, incluyendo client_name y guest_name.
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Habilitar RLS en appointments si no está habilitado
-- ============================================
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 2: Verificar/Crear política para Partners (business owners)
-- ============================================
-- Partners deben poder ver todas las citas de su negocio
-- Esto incluye automáticamente client_name y guest_name

DROP POLICY IF EXISTS "Partners can view their business appointments" ON public.appointments;

CREATE POLICY "Partners can view their business appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  -- Verificar que el usuario es owner del negocio
  business_id IN (
    SELECT id FROM public.businesses 
    WHERE owner_id = auth.uid()
  )
  OR
  -- O que el usuario es staff del negocio
  business_id IN (
    SELECT business_id FROM public.staff 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
);

-- ============================================
-- PASO 3: Verificar/Crear política para Partners (INSERT/UPDATE/DELETE)
-- ============================================
DROP POLICY IF EXISTS "Partners can manage their business appointments" ON public.appointments;

CREATE POLICY "Partners can manage their business appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (
  -- Verificar que el usuario es owner del negocio
  business_id IN (
    SELECT id FROM public.businesses 
    WHERE owner_id = auth.uid()
  )
  OR
  -- O que el usuario es staff del negocio
  business_id IN (
    SELECT business_id FROM public.staff 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
)
WITH CHECK (
  -- Misma verificación para INSERT/UPDATE
  business_id IN (
    SELECT id FROM public.businesses 
    WHERE owner_id = auth.uid()
  )
  OR
  business_id IN (
    SELECT business_id FROM public.staff 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
);

-- ============================================
-- PASO 4: Verificar/Crear política para Clientes
-- ============================================
-- Clientes deben poder ver sus propias citas
-- Esto incluye automáticamente client_name y guest_name

DROP POLICY IF EXISTS "Clients can view their own appointments" ON public.appointments;

CREATE POLICY "Clients can view their own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  -- Verificar que el appointment pertenece a un cliente del usuario
  client_id IN (
    SELECT id FROM public.clients 
    WHERE user_id = auth.uid()
  )
  OR
  -- O que el appointment tiene el user_id del cliente
  user_id = auth.uid()
);

-- ============================================
-- PASO 5: Verificar/Crear política para Service Role
-- ============================================
-- Service role (Edge Functions) necesita acceso completo
-- para poder leer client_name y guest_name

DROP POLICY IF EXISTS "Service role can access all appointments" ON public.appointments;

CREATE POLICY "Service role can access all appointments"
ON public.appointments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================
-- Verificar que las políticas fueron creadas:
-- 
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE tablename = 'appointments'
-- ORDER BY policyname;
--
-- Debe mostrar al menos:
-- 1. "Partners can view their business appointments" (SELECT)
-- 2. "Partners can manage their business appointments" (ALL)
-- 3. "Clients can view their own appointments" (SELECT)
-- 4. "Service role can access all appointments" (ALL)
--
-- Verificar que RLS está habilitado:
-- 
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename = 'appointments';
--
-- Debe mostrar: rowsecurity = true

COMMIT;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. client_name y guest_name son columnas DIRECTAS de appointments
--    No vienen de tablas relacionadas, por lo que no requieren políticas
--    RLS adicionales más allá de las que permiten acceso a appointments.
--
-- 2. Las políticas RLS se aplican a nivel de FILA, no de columna.
--    Si una política permite acceso a una fila de appointments,
--    automáticamente permite acceso a TODAS sus columnas, incluyendo
--    client_name y guest_name.
--
-- 3. Los joins implícitos de PostgREST (como clients:client_id(...))
--    SÍ requieren políticas RLS en la tabla relacionada (clients),
--    pero client_name y guest_name NO son parte de esos joins.
--
-- 4. Esta migración asegura que:
--    - Partners pueden leer todas las columnas de appointments de su negocio
--    - Clientes pueden leer todas las columnas de sus propias citas
--    - Service role puede leer todas las columnas para Edge Functions
--    - Todo esto incluye automáticamente client_name y guest_name



