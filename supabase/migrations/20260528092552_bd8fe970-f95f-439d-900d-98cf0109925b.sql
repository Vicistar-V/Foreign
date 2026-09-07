CREATE POLICY "Admins can view all payment attempts"
ON public.payment_attempts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));