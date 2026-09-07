DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.drops ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE public.drops SET position = position WHERE id = v_id;
  END IF;
END $$;