-- Create payment_attempts table to track payment attempts before completion
CREATE TABLE public.payment_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tx_ref TEXT NOT NULL UNIQUE,
  amount NUMERIC(12, 2) NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('membership', 'deposit')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  flutterwave_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment attempts
CREATE POLICY "Users can view their own payment attempts"
ON public.payment_attempts
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can manage all payment attempts
CREATE POLICY "Service role can manage payment attempts"
ON public.payment_attempts
FOR ALL
USING (auth.role() = 'service_role');

-- Index for faster lookups
CREATE INDEX idx_payment_attempts_user_id ON public.payment_attempts(user_id);
CREATE INDEX idx_payment_attempts_tx_ref ON public.payment_attempts(tx_ref);
CREATE INDEX idx_payment_attempts_status ON public.payment_attempts(status);