-- Add the 5 new Unsplash campaign categories (idempotent)
INSERT INTO public.comparison_categories (slug, name, emoji_free_label, sort_order, is_active)
VALUES
  ('skincare_ritual', 'Skincare Ritual', 'Skincare Ritual', 10, true),
  ('tech_lifestyle', 'Tech Lifestyle', 'Tech Lifestyle', 20, true),
  ('fitness_action', 'Fitness Action', 'Fitness Action', 30, true),
  ('street_fashion', 'Street Fashion', 'Street Fashion', 40, true),
  ('food_crave', 'Food Crave', 'Food Crave', 50, true)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    emoji_free_label = EXCLUDED.emoji_free_label,
    is_active = true;