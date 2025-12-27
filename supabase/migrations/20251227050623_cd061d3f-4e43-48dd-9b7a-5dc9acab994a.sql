-- Add approval_status column to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'draft';

-- Add push_token column to profiles table for push notifications
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS push_token text;

-- Create business_approval_requests table
CREATE TABLE IF NOT EXISTS public.business_approval_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  rejection_reason text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on business_approval_requests
ALTER TABLE public.business_approval_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Business owners can view their own requests
CREATE POLICY "Business owners can view their approval requests"
ON public.business_approval_requests
FOR SELECT
USING (owner_id = auth.uid());

-- Policy: Business owners can create requests for their business
CREATE POLICY "Business owners can create approval requests"
ON public.business_approval_requests
FOR INSERT
WITH CHECK (owner_id = auth.uid());

-- Policy: Admins/Hub managers can view all requests
CREATE POLICY "Hub admins can view all approval requests"
ON public.business_approval_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Admins/Hub managers can update requests (approve/reject)
CREATE POLICY "Hub admins can update approval requests"
ON public.business_approval_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_business_approval_requests_business_id 
ON public.business_approval_requests(business_id);

CREATE INDEX IF NOT EXISTS idx_business_approval_requests_status 
ON public.business_approval_requests(status);

-- Add trigger for updated_at
CREATE OR REPLACE TRIGGER update_business_approval_requests_updated_at
BEFORE UPDATE ON public.business_approval_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();