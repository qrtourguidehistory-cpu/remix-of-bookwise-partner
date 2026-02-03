-- =====================================================
-- MIGRACIÓN: Crear tabla client_devices con UNIQUE(fcm_token)
-- Propósito: Garantizar que 1 token FCM = 1 usuario
-- =====================================================

-- 1. Crear tabla client_devices si no existe
CREATE TABLE IF NOT EXISTS public.client_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  platform TEXT NOT NULL DEFAULT 'android',
  fcm_token TEXT,
  device_info JSONB,
  is_active BOOLEAN DEFAULT true,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Eliminar tokens duplicados (mantener solo el más reciente por fcm_token)
-- Esto limpia datos existentes antes de agregar el constraint
DELETE FROM public.client_devices a
USING public.client_devices b
WHERE a.fcm_token = b.fcm_token
  AND a.fcm_token IS NOT NULL
  AND a.created_at < b.created_at;

-- 3. Agregar UNIQUE constraint para fcm_token (evitar futuros duplicados)
-- Solo si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'client_devices_fcm_token_unique'
  ) THEN
    ALTER TABLE public.client_devices
    ADD CONSTRAINT client_devices_fcm_token_unique UNIQUE (fcm_token);
  END IF;
END $$;

-- 4. Crear índice para búsquedas rápidas por user_id y role
CREATE INDEX IF NOT EXISTS idx_client_devices_user_role 
ON public.client_devices(user_id, role);

-- 5. Crear índice para búsquedas por is_active
CREATE INDEX IF NOT EXISTS idx_client_devices_active 
ON public.client_devices(is_active) WHERE is_active = true;

-- 6. Habilitar RLS
ALTER TABLE public.client_devices ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS: Usuarios pueden gestionar sus propios dispositivos
DROP POLICY IF EXISTS "Users can manage their own devices" ON public.client_devices;
CREATE POLICY "Users can manage their own devices"
ON public.client_devices FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 8. Política para service role (edge functions)
DROP POLICY IF EXISTS "Service role can manage all devices" ON public.client_devices;
CREATE POLICY "Service role can manage all devices"
ON public.client_devices FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 9. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_client_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_client_devices_updated_at ON public.client_devices;
CREATE TRIGGER update_client_devices_updated_at
BEFORE UPDATE ON public.client_devices
FOR EACH ROW
EXECUTE FUNCTION public.update_client_devices_updated_at();