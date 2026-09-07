CREATE OR REPLACE FUNCTION public.get_restores_today_count()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    COUNT(DISTINCT user_id)::int,
    0
  )
  FROM public.transactions
  WHERE metadata->>'purpose' = 'restore_capacity_lock'
    AND COALESCE((metadata->>'actual_bought')::int, 0) > 0
    AND created_at > (now() AT TIME ZONE 'Africa/Lagos')::date AT TIME ZONE 'Africa/Lagos';
$$;

GRANT EXECUTE ON FUNCTION public.get_restores_today_count() TO authenticated, anon;