-- Add is_premium column to profiles table for RevenueCat integration
-- This column tracks whether the user has premium access via Google Play subscriptions

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false NOT NULL;

-- Add index for faster queries on premium status
CREATE INDEX IF NOT EXISTS idx_profiles_is_premium 
ON profiles(is_premium) 
WHERE is_premium = true;

-- Add comment to document the column
COMMENT ON COLUMN profiles.is_premium IS 'Indicates if user has premium access via RevenueCat/Google Play subscription';

