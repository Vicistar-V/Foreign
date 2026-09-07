
-- Categories (admin-controlled)
CREATE TABLE public.comparison_categories (
  slug text PRIMARY KEY,
  name text NOT NULL,
  emoji_free_label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comparison_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active categories" ON public.comparison_categories
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage categories" ON public.comparison_categories
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages categories" ON public.comparison_categories
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Images
CREATE TABLE public.comparison_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug text NOT NULL REFERENCES public.comparison_categories(slug) ON DELETE CASCADE,
  image_url text NOT NULL,
  source_prompt text,
  provider text NOT NULL DEFAULT 'civitai',
  elo_score numeric NOT NULL DEFAULT 1200,
  votes_count integer NOT NULL DEFAULT 0,
  wins_count integer NOT NULL DEFAULT 0,
  is_dead boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comparison_images_cat_active ON public.comparison_images(category_slug) WHERE is_dead = false;
ALTER TABLE public.comparison_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view live images" ON public.comparison_images
  FOR SELECT USING (is_dead = false OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage images" ON public.comparison_images
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages images" ON public.comparison_images
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Votes
CREATE TABLE public.comparison_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_slug text NOT NULL,
  image_a_id uuid NOT NULL,
  image_b_id uuid NOT NULL,
  winner_id uuid NOT NULL,
  decision_ms integer NOT NULL,
  task_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Lagos')::date,
  batch_number integer NOT NULL,
  vote_in_batch integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_votes_user_date ON public.comparison_votes(user_id, task_date);
ALTER TABLE public.comparison_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own votes" ON public.comparison_votes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all votes" ON public.comparison_votes
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages votes" ON public.comparison_votes
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Broken reports
CREATE TABLE public.comparison_broken_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id uuid NOT NULL REFERENCES public.comparison_images(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(image_id, reporter_id)
);
ALTER TABLE public.comparison_broken_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own reports" ON public.comparison_broken_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users view own reports" ON public.comparison_broken_reports
  FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Admins view reports" ON public.comparison_broken_reports
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages reports" ON public.comparison_broken_reports
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Auto-flag dead images on 3+ reports
CREATE OR REPLACE FUNCTION public.flag_dead_image_on_reports()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM public.comparison_broken_reports WHERE image_id = NEW.image_id;
  IF c >= 3 THEN
    UPDATE public.comparison_images SET is_dead = true WHERE id = NEW.image_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_flag_dead_image
AFTER INSERT ON public.comparison_broken_reports
FOR EACH ROW EXECUTE FUNCTION public.flag_dead_image_on_reports();

-- Record a comparison vote, update Elo, increment counts
CREATE OR REPLACE FUNCTION public.record_comparison_vote(
  _user_id uuid,
  _category_slug text,
  _image_a uuid,
  _image_b uuid,
  _winner_pick text,        -- 'a' or 'b'
  _decision_ms integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  v_batches_done integer;
  v_votes_today integer;
  v_vote_in_batch integer;
  v_batch_number integer;
  v_winner_id uuid;
  v_loser_id uuid;
  v_elo_a numeric;
  v_elo_b numeric;
  v_expected_a numeric;
  v_expected_b numeric;
  v_k constant numeric := 24;
  v_score_a numeric;
  v_score_b numeric;
BEGIN
  IF _winner_pick NOT IN ('a','b') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_winner');
  END IF;

  v_winner_id := CASE WHEN _winner_pick = 'a' THEN _image_a ELSE _image_b END;
  v_loser_id  := CASE WHEN _winner_pick = 'a' THEN _image_b ELSE _image_a END;

  -- Count votes already today to derive batch_number / vote_in_batch
  SELECT count(*) INTO v_votes_today
    FROM public.comparison_votes WHERE user_id = _user_id AND task_date = v_today;

  v_batch_number := (v_votes_today / 10) + 1;
  v_vote_in_batch := (v_votes_today % 10) + 1;

  INSERT INTO public.comparison_votes
    (user_id, category_slug, image_a_id, image_b_id, winner_id, decision_ms, task_date, batch_number, vote_in_batch)
  VALUES
    (_user_id, _category_slug, _image_a, _image_b, v_winner_id, _decision_ms, v_today, v_batch_number, v_vote_in_batch);

  -- Elo update
  SELECT elo_score INTO v_elo_a FROM public.comparison_images WHERE id = _image_a FOR UPDATE;
  SELECT elo_score INTO v_elo_b FROM public.comparison_images WHERE id = _image_b FOR UPDATE;

  v_expected_a := 1.0 / (1.0 + power(10, (v_elo_b - v_elo_a) / 400.0));
  v_expected_b := 1.0 - v_expected_a;
  v_score_a := CASE WHEN _winner_pick = 'a' THEN 1 ELSE 0 END;
  v_score_b := 1 - v_score_a;

  UPDATE public.comparison_images
     SET elo_score = v_elo_a + v_k * (v_score_a - v_expected_a),
         votes_count = votes_count + 1,
         wins_count = wins_count + (CASE WHEN _winner_pick = 'a' THEN 1 ELSE 0 END)
   WHERE id = _image_a;

  UPDATE public.comparison_images
     SET elo_score = v_elo_b + v_k * (v_score_b - v_expected_b),
         votes_count = votes_count + 1,
         wins_count = wins_count + (CASE WHEN _winner_pick = 'b' THEN 1 ELSE 0 END)
   WHERE id = _image_b;

  RETURN jsonb_build_object(
    'success', true,
    'vote_in_batch', v_vote_in_batch,
    'batch_number', v_batch_number,
    'batch_completed', (v_vote_in_batch = 10)
  );
END;
$$;

-- Seed categories
INSERT INTO public.comparison_categories (slug, name, emoji_free_label, sort_order) VALUES
  ('sneakers', 'Sneakers', 'Sneakers', 1),
  ('coffee', 'Coffee', 'Coffee', 2),
  ('perfume', 'Perfume', 'Perfume', 3),
  ('tech', 'Tech Gadgets', 'Tech Gadgets', 4),
  ('beverage', 'Beverage', 'Beverage', 5),
  ('watch', 'Watches', 'Watches', 6)
ON CONFLICT (slug) DO NOTHING;

-- Seed a handful of demo image URLs per category (Unsplash) so /task works immediately.
INSERT INTO public.comparison_images (category_slug, image_url, source_prompt, provider) VALUES
  ('sneakers','https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800','red nike','seed'),
  ('sneakers','https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800','white sneaker','seed'),
  ('sneakers','https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800','black sneaker','seed'),
  ('sneakers','https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800','colorful sneaker','seed'),
  ('sneakers','https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800','runner','seed'),
  ('sneakers','https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=800','classic sneaker','seed'),
  ('coffee','https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800','latte art','seed'),
  ('coffee','https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800','espresso','seed'),
  ('coffee','https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800','cappuccino','seed'),
  ('coffee','https://images.unsplash.com/photo-1481833761820-0509d3217039?w=800','coffee beans','seed'),
  ('coffee','https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800','black coffee','seed'),
  ('coffee','https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800','coffee cup','seed'),
  ('perfume','https://images.unsplash.com/photo-1541643600914-78b084683601?w=800','perfume bottle','seed'),
  ('perfume','https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800','luxury perfume','seed'),
  ('perfume','https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=800','perfume','seed'),
  ('perfume','https://images.unsplash.com/photo-1588405748880-12d1d2a59d75?w=800','glass perfume','seed'),
  ('perfume','https://images.unsplash.com/photo-1615634260167-c8cdede054de?w=800','clear perfume','seed'),
  ('perfume','https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800','niche perfume','seed'),
  ('tech','https://images.unsplash.com/photo-1518770660439-4636190af475?w=800','circuit','seed'),
  ('tech','https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800','laptop','seed'),
  ('tech','https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800','headphones','seed'),
  ('tech','https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=800','phone','seed'),
  ('tech','https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800','workspace','seed'),
  ('tech','https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800','keyboard','seed'),
  ('beverage','https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800','smoothie','seed'),
  ('beverage','https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=800','cocktail','seed'),
  ('beverage','https://images.unsplash.com/photo-1437418747212-8d9709afab22?w=801','drink','seed'),
  ('beverage','https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800','juice','seed'),
  ('beverage','https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800','bubble tea','seed'),
  ('beverage','https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800','soda','seed'),
  ('watch','https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800','luxury watch','seed'),
  ('watch','https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800','steel watch','seed'),
  ('watch','https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=800','dive watch','seed'),
  ('watch','https://images.unsplash.com/photo-1620625515032-6ed0c1790c75?w=800','smart watch','seed'),
  ('watch','https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=800','minimal watch','seed'),
  ('watch','https://images.unsplash.com/photo-1594534475808-b18fc33b045e?w=800','black watch','seed');
