ALTER TABLE public.user_supplements
  ADD CONSTRAINT user_supplements_name_not_blank CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  ADD CONSTRAINT user_supplements_brand_len     CHECK (brand IS NULL OR length(brand) <= 60),
  ADD CONSTRAINT user_supplements_serving_len   CHECK (serving_size IS NULL OR length(serving_size) <= 30),
  ADD CONSTRAINT user_supplements_calories_rng  CHECK (calories IS NULL OR (calories >= 0 AND calories <= 2000)),
  ADD CONSTRAINT user_supplements_protein_rng   CHECK (protein_g IS NULL OR (protein_g >= 0 AND protein_g <= 500)),
  ADD CONSTRAINT user_supplements_carbs_rng     CHECK (carbs_g   IS NULL OR (carbs_g   >= 0 AND carbs_g   <= 500)),
  ADD CONSTRAINT user_supplements_fat_rng       CHECK (fat_g     IS NULL OR (fat_g     >= 0 AND fat_g     <= 500)),
  ADD CONSTRAINT user_supplements_notes_len     CHECK (notes IS NULL OR length(notes) <= 500);

CREATE UNIQUE INDEX user_supplements_user_name_uniq
  ON public.user_supplements (user_id, lower(name));