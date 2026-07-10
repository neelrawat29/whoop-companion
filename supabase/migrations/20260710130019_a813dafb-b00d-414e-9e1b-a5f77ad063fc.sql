-- Extend profiles with target/personalization fields (all nullable, additive)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS birth_year int,
  ADD COLUMN IF NOT EXISTS activity_level text,
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS kcal_target int,
  ADD COLUMN IF NOT EXISTS protein_target int,
  ADD COLUMN IF NOT EXISTS carbs_target int,
  ADD COLUMN IF NOT EXISTS fat_target int,
  ADD COLUMN IF NOT EXISTS sleep_target_hours numeric;

-- Pinned insights (assistant messages a user has pinned to Home)
CREATE TABLE IF NOT EXISTS public.pinned_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pinned_insights TO authenticated;
GRANT ALL ON public.pinned_insights TO service_role;

ALTER TABLE public.pinned_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own pinned insights"
  ON public.pinned_insights FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS pinned_insights_user_created_idx
  ON public.pinned_insights (user_id, created_at DESC);