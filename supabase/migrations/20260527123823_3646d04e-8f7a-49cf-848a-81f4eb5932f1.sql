
UPDATE public.profiles
SET has_seen_explainer = false
WHERE has_seen_explainer = true
  AND COALESCE(metadata->>'explainer_status', '') = '';
