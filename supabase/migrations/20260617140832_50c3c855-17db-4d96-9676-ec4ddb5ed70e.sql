ALTER TABLE public.user_supplements
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS serving_size text,
  ADD COLUMN IF NOT EXISTS calories numeric,
  ADD COLUMN IF NOT EXISTS protein_g numeric,
  ADD COLUMN IF NOT EXISTS carbs_g numeric,
  ADD COLUMN IF NOT EXISTS fat_g numeric,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS nutrients jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_user_supplements_updated_at ON public.user_supplements;
CREATE TRIGGER set_user_supplements_updated_at
  BEFORE UPDATE ON public.user_supplements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.habits_log
  ADD COLUMN IF NOT EXISTS strain numeric;