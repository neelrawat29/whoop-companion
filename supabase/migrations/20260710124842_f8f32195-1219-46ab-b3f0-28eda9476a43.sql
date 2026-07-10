
-- Meals: add photo + barcode source columns
ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS barcode text;

-- Meal presets (user-defined quick-log templates)
CREATE TABLE IF NOT EXISTS public.meal_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  kcal integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_presets TO authenticated;
GRANT ALL ON public.meal_presets TO service_role;

ALTER TABLE public.meal_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meal presets"
  ON public.meal_presets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS meal_presets_user_idx ON public.meal_presets(user_id, created_at DESC);

DROP TRIGGER IF EXISTS meal_presets_touch ON public.meal_presets;
CREATE TRIGGER meal_presets_touch
  BEFORE UPDATE ON public.meal_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for the meal-photos bucket (bucket itself created via tool).
-- Files are stored under <user_id>/<filename> so owners can only see their own.
CREATE POLICY "Users read own meal photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own meal photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own meal photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
