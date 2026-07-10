ALTER TABLE public.user_supplements
  ADD COLUMN IF NOT EXISTS time_of_day text
    CHECK (time_of_day IS NULL OR time_of_day IN ('morning','afternoon','evening','night','anytime'));