-- Ensure authenticated users can read their own profile, especially is_premium
-- This fixes the issue where normal users lose premium access when Admin logs out
-- The is_premium field must be readable by the user themselves for subscription validation

-- Enable RLS on profiles if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (to recreate with correct permissions)
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;

-- Create policy: Authenticated users can read their own profile
-- This includes the is_premium field which is critical for subscription validation
CREATE POLICY "Users can read their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Also ensure users can read is_premium from their own profile
-- This is a redundant check but ensures the field is accessible
COMMENT ON COLUMN profiles.is_premium IS 'Indicates if user has premium access via RevenueCat/Google Play subscription. Readable by the user themselves.';

