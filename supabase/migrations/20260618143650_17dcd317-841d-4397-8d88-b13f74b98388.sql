
CREATE TABLE public.weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  weight_kg numeric(6,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_entries TO authenticated;
GRANT ALL ON public.weight_entries TO service_role;

ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own weight entries"
  ON public.weight_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER weight_entries_set_updated_at
  BEFORE UPDATE ON public.weight_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX weight_entries_user_date_idx ON public.weight_entries (user_id, entry_date DESC);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weight_goal_kg numeric(6,2) CHECK (weight_goal_kg IS NULL OR (weight_goal_kg > 0 AND weight_goal_kg < 500)),
  ADD COLUMN IF NOT EXISTS weight_goal_date date,
  ADD COLUMN IF NOT EXISTS weight_unit text NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg','lbs'));
