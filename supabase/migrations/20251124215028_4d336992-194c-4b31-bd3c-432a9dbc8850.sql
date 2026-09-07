-- Secure function to fetch banks by country
CREATE OR REPLACE FUNCTION public.get_banks(_country TEXT DEFAULT 'NG')
RETURNS TABLE (
  id UUID,
  code TEXT,
  name TEXT,
  country TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, code, name, country, created_at, updated_at
  FROM public.banks
  WHERE country = _country
  ORDER BY name ASC;
$$;