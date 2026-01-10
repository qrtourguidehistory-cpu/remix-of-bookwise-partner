-- Table for account deletion requests with 7-day grace period
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID,
  requested_at TIMESTAMPTZ DEFAULT now(),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'completed')),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own deletion requests
CREATE POLICY "Users can view their own deletion requests"
ON public.account_deletion_requests
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own deletion requests"
ON public.account_deletion_requests
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own deletion requests"
ON public.account_deletion_requests
FOR UPDATE USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_account_deletion_requests_updated_at
BEFORE UPDATE ON public.account_deletion_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();